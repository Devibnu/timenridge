import { app as electronApp, BrowserWindow } from 'electron';
import path from 'path';
import express from 'express';
import getPort from 'get-port';

import fs from 'fs';

// Set up environment variables before importing anything else from our monorepo
const userDataPath = electronApp.getPath('userData');
const dbPath = path.join(userDataPath, 'timebridge.db');

if (!fs.existsSync(dbPath)) {
  const templatePath = electronApp.isPackaged
    ? path.join(process.resourcesPath, 'template.db')
    : path.join(__dirname, 'template.db');

  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, dbPath);
  } else {
    console.warn(`Template database not found at ${templatePath}`);
  }
}

process.env.DATABASE_URL = `file:${dbPath}`;
process.env.QUEUE_DB_PATH = path.join(userDataPath, 'queue.db');
process.env.NODE_ENV = 'production';

// Now we can safely import the backend components
import { app as apiApp } from '@timebridge/api';
import { startWorker } from '@timebridge/worker';
import { startScheduler } from '@timebridge/scheduler';

let mainWindow: BrowserWindow | null = null;
let serverPort: number;

async function startBackend() {
  serverPort = await getPort({ port: 3000 });
  process.env.API_PORT = serverPort.toString();

  // Add static file serving to the Express app
  const frontendPath = electronApp.isPackaged
    ? path.join(process.resourcesPath, 'frontend')
    : path.join(__dirname, '../../../frontend/dist');
  console.log('Serving frontend from:', frontendPath);
  apiApp.use(express.static(frontendPath));

  apiApp.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  return new Promise<void>((resolve) => {
    apiApp.listen(serverPort, '127.0.0.1', () => {
      console.log(`Backend listening on 127.0.0.1:${serverPort}`);
      resolve();
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the combined backend/frontend server
  await mainWindow.loadURL(`http://localhost:${serverPort}`);
}

electronApp.whenReady().then(async () => {
  try {
    await startBackend();
    console.log('Backend started');

    await startWorker();
    console.log('Worker started');

    await startScheduler();
    console.log('Scheduler started');

    await createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    electronApp.quit();
  }

  electronApp.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    electronApp.quit();
  }
});
