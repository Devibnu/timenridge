/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-catch */

export type DeviceAdapterErrorCode =
  | 'ADAPTER_NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'CONNECTION_TIMEOUT'
  | 'AUTHENTICATION_FAILED'
  | 'DEVICE_OFFLINE'
  | 'PROTOCOL_ERROR'
  | 'INVALID_RESPONSE'
  | 'COLLECTION_FAILED'
  | 'UNSUPPORTED_OPERATION';

export class DeviceAdapterError extends Error {
  public readonly code: DeviceAdapterErrorCode;
  public readonly deviceId?: string;
  public readonly isRetryable: boolean;

  constructor(
    code: DeviceAdapterErrorCode,
    message: string,
    deviceId?: string,
    isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'DeviceAdapterError';
    this.code = code;
    this.deviceId = deviceId;
    this.isRetryable = isRetryable;

    // Maintain V8 stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DeviceAdapterError);
    }
  }

  // Helper to ensure sensitive info (like passwords) are not accidentally serialized
  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      deviceId: this.deviceId,
      isRetryable: this.isRetryable,
    };
  }
}
