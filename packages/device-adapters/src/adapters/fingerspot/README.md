# Fingerspot Device Adapter (Placeholder)

**STATUS: PENDING REAL DEVICE PROTOCOL VALIDATION**

This directory is prepared for the future implementation of the Fingerspot Vida W-2411M device adapter.
No production logic, API endpoints, SDK calls, or real authentication methods are implemented here yet.

## Architecture Guidelines

- Must implement the `DeviceAdapter` interface.
- Must handle its own specific connection methods (LAN vs Cloud).
- Must normalize Fingerspot error states to generic TimeBridge error types.
- Must return `RawAttendanceEvent[]`.

_Do NOT implement until P17.2-R validation yields concrete protocol evidence._
