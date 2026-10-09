import Database from 'better-sqlite3';
import path from 'path';
import { EventEmitter } from 'events';

export const queueEvents = new EventEmitter();

let db: Database.Database;

export function getQueueDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.QUEUE_DB_PATH || path.resolve(process.cwd(), 'queue.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        queue_name TEXT NOT NULL,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        opts TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(queue_name, status);
    `);
  }
  return db;
}

export async function checkRedisHealth(): Promise<string> {
  // Stub for backward compatibility. In SQLite context, if we can read DB, we are OK.
  try {
    getQueueDb().pragma('journal_mode');
    return 'OK';
  } catch (err) {
    return 'ERROR';
  }
}

export function closeQueueDb() {
  if (db) {
    db.close();
    (db as any) = null;
  }
}
