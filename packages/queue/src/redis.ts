import Redis, { RedisOptions } from 'ioredis';

// Redis connection options mapping environment variables to connection strings
const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  // Prevent BullMQ from complaining about max retries for queue clients
  maxRetriesPerRequest: null,
};

let redisClientInstance: Redis | null = null;

/**
 * Returns a shared Redis instance.
 */
export function getRedisClient(): Redis {
  if (!redisClientInstance) {
    // Determine if we should attempt connection.
    // Usually environment should have REDIS_HOST configured if explicitly running.
    redisClientInstance = new Redis(redisOptions);

    // Log failures, but don't crash everything if Redis isn't up locally
    redisClientInstance.on('error', (err) => {
      console.warn('Redis Connection Error:', err.message);
    });
  }
  return redisClientInstance;
}

export type RedisHealthStatus = 'HEALTHY' | 'NOT_CONFIGURED' | 'UNAVAILABLE';

/**
 * Perform a real ping to evaluate Redis health
 */
export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  // If host is explicitly 'not-configured' (or similar logic)
  if (process.env.REDIS_HOST === 'NOT_CONFIGURED') {
    return 'NOT_CONFIGURED';
  }

  const client = getRedisClient();
  try {
    const pingResult = await client.ping();
    if (pingResult === 'PONG') {
      return 'HEALTHY';
    }
    return 'UNAVAILABLE';
  } catch {
    return 'UNAVAILABLE';
  }
}
