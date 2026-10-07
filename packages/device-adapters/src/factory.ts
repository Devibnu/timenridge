/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-catch */

import { DeviceAdapterRegistry } from './registry';
import { DeviceAdapter } from './interface';
import { DeviceAdapterError } from './errors';

export interface DeviceAdapterConfig {
  device_id: string;
  vendor?: string | null;
  protocol?: string | null;
  host?: string | null;
  port?: number | null;
  credential?: string | null;
}

export class DeviceAdapterFactory {
  /**
   * Creates a new instance of a DeviceAdapter for the specified configuration.
   * Throws ADAPTER_NOT_FOUND if the registry cannot resolve the vendor/protocol.
   *
   * @param config Configuration parameters derived from the Device record.
   * @returns DeviceAdapter instance
   */
  public static create(config: DeviceAdapterConfig): DeviceAdapter {
    if (!config.vendor) {
      throw new DeviceAdapterError(
        'ADAPTER_NOT_FOUND',
        'Device has no vendor configured',
        config.device_id,
      );
    }

    const Constructor = DeviceAdapterRegistry.resolve(config.vendor, config.protocol);

    if (!Constructor) {
      const target = config.protocol ? `${config.vendor}:${config.protocol}` : config.vendor;
      throw new DeviceAdapterError(
        'ADAPTER_NOT_FOUND',
        `No adapter registered for ${target}`,
        config.device_id,
      );
    }

    return new Constructor(config);
  }
}
