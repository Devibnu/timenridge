/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-catch */

import { DeviceAdapter } from './interface';

export type AdapterConstructor = new (config: any) => DeviceAdapter;

export class DeviceAdapterRegistry {
  private static adapters: Map<string, AdapterConstructor> = new Map();

  /**
   * Generates a canonical key for the registry lookup.
   * If protocol is provided, it returns 'vendor:protocol'.
   * Otherwise it just returns 'vendor'.
   */
  private static getKey(vendor: string, protocol?: string | null): string {
    const v = vendor.toLowerCase().trim();
    if (protocol) {
      const p = protocol.toLowerCase().trim();
      return `${v}:${p}`;
    }
    return v;
  }

  /**
   * Registers a new adapter class.
   * Extensibility point for future vendors.
   * @param vendor - e.g. "ZKTeco"
   * @param adapterClass - The adapter class constructor
   * @param protocol - e.g. "push", "standalone"
   */
  public static register(
    vendor: string,
    adapterClass: AdapterConstructor,
    protocol?: string,
  ): void {
    const key = this.getKey(vendor, protocol);
    this.adapters.set(key, adapterClass);
  }

  /**
   * Resolves a registered adapter based on vendor and optional protocol.
   * Returns undefined if not found.
   */
  public static resolve(vendor: string, protocol?: string | null): AdapterConstructor | undefined {
    // First try vendor:protocol
    if (protocol) {
      const specificKey = this.getKey(vendor, protocol);
      if (this.adapters.has(specificKey)) {
        return this.adapters.get(specificKey);
      }
    }

    // Fallback to vendor-only
    const generalKey = this.getKey(vendor);
    return this.adapters.get(generalKey);
  }

  /**
   * Lists all available adapter keys
   */
  public static list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Checks if an adapter exists
   */
  public static has(vendor: string, protocol?: string | null): boolean {
    return this.resolve(vendor, protocol) !== undefined;
  }

  /**
   * Clears the registry (useful for testing)
   */
  public static clear(): void {
    this.adapters.clear();
  }
}
