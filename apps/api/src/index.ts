import "dotenv/config";

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRouter from './routes/auth';
import { devicesRouter } from './routes/devices';
import eventsRouter from './routes/events';
import employeeMappingsRouter from './routes/employee-mappings';
import { reconciliationRouter } from './routes/reconciliation';
import { operationsRouter } from './routes/operations';
import { monitoringRouter } from './routes/monitoring';
import { attendanceRouter } from './routes/attendance';
import { checkRedisHealth } from '@timebridge/queue';
import { PrismaClient } from '@timebridge/database';

const app = express();
const port = process.env.API_PORT || 3000;

// Security Middlewares
app.use(helmet());

// CORS - Restricted to allowed origins in prod, but allowing all for dev in P2
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        console.log('BLOCKED CORS ORIGIN:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());

// Public health checks
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'timebridge-api',
    },
    meta: {},
  });
});

app.get('/ready', async (req, res) => {
  try {
    const prisma = new PrismaClient();

    // Bounded timeout for database health check
    const dbPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database timeout')), 3000),
    );

    await Promise.race([dbPromise, timeoutPromise]);

    // Check Redis health dynamically
    const redisHealth = await checkRedisHealth();

    res.status(200).json({
      success: true,
      data: {
        status: 'ready',
        dependencies: {
          database: 'healthy',
          redis: redisHealth,
          queue: redisHealth, // If redis is healthy, queue infrastructure is accessible
        },
      },
      meta: {},
    });
  } catch {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_READY',
        message: 'One or more required dependencies are unavailable.',
        details: {
          database: 'unavailable',
          redis: 'UNAVAILABLE',
          queue: 'UNAVAILABLE',
        },
      },
      meta: {},
    });
  }
});

// Auth Routes
app.use('/api/auth', authRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/employee-mappings', employeeMappingsRouter);
app.use('/api/reconciliation', reconciliationRouter);
app.use('/api/operations', operationsRouter);
app.use('/api/operational', monitoringRouter);
app.use('/api/attendance', attendanceRouter);

// Root route intentionally removed so it can be overridden by desktop/frontend

export { app };

if (require.main === module) {

const server = app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

// Graceful Shutdown
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received. Initiating graceful shutdown...`);

  try {
    const prisma = new PrismaClient();
    await prisma.$disconnect();
    console.log('PostgreSQL (Prisma) disconnected.');

    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
