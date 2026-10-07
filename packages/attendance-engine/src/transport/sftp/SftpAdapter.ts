import SftpClient from 'ssh2-sftp-client';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  TransportAdapter,
  TransportUploadRequest,
  TransportUploadResult,
} from '../TransportAdapter';

export interface SftpConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  remoteBasePath: string;
  timeout?: number;
}

export class SftpAdapter implements TransportAdapter {
  private client: SftpClient;
  private config: SftpConfig;

  constructor(config: SftpConfig) {
    this.client = new SftpClient();
    this.config = {
      port: 22,
      timeout: 10000,
      ...config,
    };
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        privateKey: this.config.privateKey,
        readyTimeout: this.config.timeout,
      });
    } catch (error: unknown) {
      // Mask credentials in error logs
      const safeError = new Error(
        `SFTP Connection failed to ${this.config.host}:${this.config.port}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw safeError;
    }
  }

  public async disconnect(): Promise<void> {
    await this.client.end();
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  public async upload(request: TransportUploadRequest): Promise<TransportUploadResult> {
    const remotePath = path.posix.join(this.config.remoteBasePath, request.filename);
    const tmpPath = `${remotePath}.tmp`;

    try {
      const buffer =
        typeof request.content === 'string' ? Buffer.from(request.content) : request.content;
      // Atomic Upload: write to tmp, then rename
      await this.client.put(buffer, tmpPath);

      const exists = await this.client.exists(remotePath);
      if (exists) {
        await this.client.delete(remotePath);
      }

      await this.client.rename(tmpPath, remotePath);

      return {
        success: true,
        uploadedPath: remotePath,
      };
    } catch (error: unknown) {
      // Ensure tmp file is cleaned up if it failed partway
      try {
        await this.client.delete(tmpPath);
      } catch {
        /* ignore cleanup error */
      }

      return {
        success: false,
        error: `SFTP Upload failed for file ${request.filename}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  public async exists(remotePath: string): Promise<boolean> {
    return (
      (await this.client.exists(path.posix.join(this.config.remoteBasePath, remotePath))) !== false
    );
  }

  public async download(remotePath: string): Promise<Buffer> {
    const fullPath = path.posix.join(this.config.remoteBasePath, remotePath);
    return (await this.client.get(fullPath)) as Buffer;
  }

  public async checksum(localPath: string): Promise<string> {
    const content = await fs.readFile(localPath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Helper to compute checksum from memory buffer/string
   */
  public checksumContent(content: Buffer | string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
