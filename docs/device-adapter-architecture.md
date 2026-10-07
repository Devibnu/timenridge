# Device Adapter Architecture

TimeBridge uses an **Adapter Pattern** to isolate vendor-specific communication logic from the core application. The core application (API, Attendance Engine, Workers) is entirely agnostic of device manufacturers, protocols, or connection details.

## Core Components

The architecture relies on the following central components in `packages/device-adapters`:

### 1. Adapter Interface (`DeviceAdapter`)

A strict canonical contract that all vendor adapters must implement.

- `connect()`
- `disconnect()`
- `testConnection()`
- `getDeviceInfo()`
- `getDeviceStatus()`
- `getAttendanceEvents()`

**Crucial Constraint**: The adapter translates raw device bytes into canonical data. It _never_ implements business logic such as determining whether an employee is late, what shift they belong to, or converting a punch to an "IN" or "OUT" payroll decision.

### 2. Registry (`DeviceAdapterRegistry`)

The central directory of available adapters. When a new vendor adapter is created (e.g., `ZKTecoAdapter`), it is registered here, mapped by `vendor` or `vendor:protocol`. The rest of the application never instantiates vendor classes directly.

### 3. Factory (`DeviceAdapterFactory`)

The instantiation layer. Given a `Device` record's configuration (vendor, host, port, credentials), the factory resolves the appropriate adapter from the Registry and returns a `DeviceAdapter` instance.

### 4. Error Model (`DeviceAdapterError`)

A highly typed error classification system. Vendor-specific socket exceptions, timeout errors, or HTTP errors must be caught within the adapter and mapped to a canonical `DeviceAdapterErrorCode` (e.g., `CONNECTION_TIMEOUT`, `DEVICE_OFFLINE`, `AUTHENTICATION_FAILED`). This ensures the API and Workers can gracefully handle failures without knowing the underlying protocol.

## Guidelines for Implementing Future Adapters

When extending TimeBridge to support a new vendor (e.g., Suprema, Hikvision):

1. **Implement `DeviceAdapter`**: Create a new class implementing the interface.
2. **Handle Timeouts**: Ensure all network calls have explicit boundaries. Do not block the worker indefinitely.
3. **Handle Disconnections Safely**: The `disconnect()` method must clean up sockets, even if the connection failed midway.
4. **Isolate Connections**: Never use global mutable state for connections. Each `DeviceAdapter` instance must be strictly isolated to the device it was constructed for.
5. **Protect Credentials**: Do not log plaintext passwords, API keys, or raw secrets. Ensure `DeviceAdapterError` payloads omit secrets.
6. **Register**: Call `DeviceAdapterRegistry.register('VendorName', NewAdapterClass)`.

## Mocking and Testing

A `MockDeviceAdapter` is included in the framework. It simulates successful connections, timeouts, and device offline states based on the requested host configuration. It is used extensively for unit and integration testing without requiring physical hardware.
