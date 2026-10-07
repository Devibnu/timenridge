export interface TransportUploadRequest {
  filename: string;
  content: Buffer | string;
}

export interface TransportUploadResult {
  success: boolean;
  uploadedPath?: string;
  error?: string;
}

export interface TransportAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;

  upload(request: TransportUploadRequest): Promise<TransportUploadResult>;

  exists(remotePath: string): Promise<boolean>;

  download(remotePath: string): Promise<Buffer>;

  checksum(localPath: string): Promise<string>;
}
