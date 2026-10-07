# P17.1 Device Discovery Report

## 1. Objective

Perform a discovery and feasibility analysis for integrating the Fingerspot Vida W-2411M attendance device into the existing TimeBridge architecture. This phase focuses on gathering evidence, reviewing existing architecture constraints, evaluating vendor documentation, and defining a physical testing matrix. No adapter implementation is performed in this step.

## 2. Target Device

- **Vendor:** Fingerspot
- **Model:** Vida W-2411M
- **Supported Capabilities:** TCP/IP (LAN), WiFi, Web Service, Fingerspot SDK, Fingerspot.io Cloud.

## 3. Current Legacy Device

- **Vendor:** Solution
- **Model:** RF888
- **Legacy Environment Context:**
  - Uses Ethernet/LAN.
  - Exposes port 4370.
  - Managed by a legacy application downloading attendance logs (Get Attlog).

## 4. Existing TimeBridge Adapter Architecture

The TimeBridge architecture strictly abstracts device connectivity via the `DeviceAdapter` interface.

- **Flow:** Device → `DeviceAdapter` → `RawAttendanceCollector` → PostgreSQL (Raw) → Transactional Outbox → BullMQ → Worker → `AttendanceNormalizer` → `AttendanceRuleEngine` → Cycle → Batch → SAP Transport.
- **Constraints:**
  - Adapter logic must remain isolated within `packages/device-adapters/src`.
  - The adapter must implement standard methods: `connect`, `disconnect`, `testConnection`, `getDeviceInfo`, `getDeviceStatus`, and `getAttendanceEvents(options)`.
  - It must return canonical `RawAttendanceEvent` payloads. It must NOT handle business logic, timezone shifting (handled by normalizer), or SAP rules.

## 5. Repository Audit

**A. Files inspected:**

- `packages/device-adapters/src/interface.ts`
- `packages/device-adapters/src/registry.ts`
- `packages/database/prisma/schema.prisma` (Device model)

**B. Relevant interfaces:**

- `DeviceAdapter` interface mandates connection management and historical data collection (`getAttendanceEvents`).
- `DeviceAdapterRegistry` supports dynamic registration of `vendor:protocol`.

**C. Existing extension points:**

- A new adapter (e.g., `FingerspotAdapter`) can be created in `packages/device-adapters/src/adapters/` and registered in `registry.ts` as `Fingerspot:LAN` or `Fingerspot:Cloud`.

**D. Required configuration for a real adapter:**

- The `Device` schema supports `host`, `port`, `protocol`, `vendor`, `model`, `serial_number`, and `encrypted_credential`. This covers most standard TCP/IP and Cloud API key requirements.

**E. Any architectural gap:**

- The current architecture explicitly supports polling/pull-based integration via `RawAttendanceCollector` calling `getAttendanceEvents`.
- If the Vida W-2411M requires a pure Webhook (Push) model, an architectural gap exists because TimeBridge currently pulls data on a schedule. An ingress webhook controller and routing to the Outbox would need to be designed.

## 6. Official Vendor Documentation Findings

Based on official Fingerspot documentation and developer portal (developer.fingerspot.io):

- **Vida W-2411M** supports TCP/IP (LAN) and Wi-Fi.
- **Developer Access:** Fingerspot.io offers a cloud-based Developer API and Webhook integration.
- **Web Service:** The device has built-in web service capabilities for direct LAN management without cloud dependency.
- **SDK:** A desktop/LAN SDK is provided by Fingerspot for direct TCP/IP socket/HTTP communication.
- **Data:** Provides real-time scan logs, user management, and device control capabilities.

**Discrepancy Warning:** While Fingerspot.io supports many devices, explicit support for the specific Vida W-2411M model's advanced features via Cloud API vs Local WebService requires physical validation to confirm which protocol is most reliable.

## 7. Communication Options

**OPTION A: Direct LAN/TCP/IP Integration (Web Service / SDK)**

- **Officially supported?** Yes.
- **Documented for Vida W-2411M?** Yes.
- **Authentication mechanism?** Local device password / SDK key.
- **Network requirement?** Direct LAN/VPN visibility to the device.
- **Internet requirement?** No.
- **Realtime capability?** Polling required, or SDK socket listener.
- **Historical Get Attlog capability?** Yes.
- **Suitability for TimeBridge architecture?** HIGH. Matches existing scheduled polling mechanism natively.
- **Evidence/Source:** Fingerspot official specs and SDK documentation.

**OPTION B: Fingerspot.io Developer API (Cloud Polling)**

- **Officially supported?** Yes.
- **Documented for Vida W-2411M?** Yes.
- **Authentication mechanism?** Bearer Token (API Key).
- **Network requirement?** Device must have outbound internet access.
- **Internet requirement?** Yes.
- **Historical Get Attlog capability?** Yes (via Cloud API).
- **Suitability for TimeBridge architecture?** HIGH.
- **Evidence/Source:** developer.fingerspot.io.

**OPTION C: Fingerspot.io Webhook (Realtime Push)**

- **Officially supported?** Yes.
- **Realtime capability?** Yes.
- **Suitability for TimeBridge architecture?** LOW. Requires architectural change (building a new ingress route to bypass the scheduled Collector and inject directly into the Transactional Outbox).

## 8. API/SDK/Webhook Findings

- **API (Cloud):** Uses standard REST JSON with Bearer tokens. Can pull historical logs.
- **Webhook (Cloud):** Pushes JSON payloads. Requires internet-accessible TimeBridge endpoint.
- **Local Web Service / SDK:** Proprietary protocol or HTTP-based local endpoints. Avoids cloud dependency but requires VPN/LAN access.

## 9. Vida W-2411M Compatibility Status

- **TCP/IP Polling:** DOCUMENTED
- **Cloud API:** DOCUMENTED
- **Cloud Webhook:** DOCUMENTED
- **Incremental retrieval:** OPEN ITEM (requires physical test to confirm cursor/pagination behavior).

## 10. Legacy RF888 Findings

- The legacy Solution RF888 uses Ethernet and operates on port 4370.
- **DO NOT** assume the Vida W-2411M uses port 4370.
- **DO NOT** assume the ZK protocol used by Solution devices applies to Fingerspot devices.

## 11. Unknown / Open Items

- **Local API Protocol:** What is the exact local HTTP/TCP payload format for the Vida W-2411M without using the cloud?
- **Incremental Sync:** Does the device support clearing logs after read, or does it support querying by timestamp/index?
- **Timezone:** Does the device return timestamps in UTC or Local Time?
- **Event Types:** What integer/string codes represent IN vs OUT?

## 12. Physical Verification Checklist

Required checks when the physical Vida W-2411M is available:

1. [ ] Device model confirmed.
2. [ ] Firmware version recorded.
3. [ ] Device serial / identifier retrieved.
4. [ ] LAN/Wi-Fi configuration set.
5. [ ] IP address identified.
6. [ ] Network reachability (ping/telnet) verified.
7. [ ] Device time accuracy verified.
8. [ ] Device timezone setting verified.
9. [ ] Attendance test event triggered physically.
10. [ ] Employee/device ID format verified.
11. [ ] Timestamp format returned by device verified.
12. [ ] Event type / verification mode codes mapped.
13. [ ] Historical attendance retrieval tested.
14. [ ] Incremental retrieval capability tested.
15. [ ] Duplicate retrieval behavior tested.
16. [ ] Offline device storage behavior verified.
17. [ ] Reconnect behavior verified.
18. [ ] Cloud/API registration tested (if using Option B).
19. [ ] API credentials/token generated.
20. [ ] Webhook availability checked (if applicable).

## 13. P17 Device Test Matrix

| ID      | Test Case                     | Status                                  |
| ------- | ----------------------------- | --------------------------------------- |
| P17-D01 | Device reachable              | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D02 | Device identity               | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D03 | Authentication                | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D04 | Device time                   | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D05 | Generate one attendance event | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D06 | Retrieve attendance           | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D07 | Verify employee/device ID     | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D08 | Verify timestamp              | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D09 | Verify event type             | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D10 | Retrieve historical events    | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D11 | Incremental retrieval         | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D12 | Duplicate retrieval           | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D13 | Offline/reconnect             | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D14 | Multiple attendance events    | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |
| P17-D15 | Collector integration         | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |

## 14. Security Considerations

- Ensure device credentials (local password or Cloud API Bearer Token) are stored securely in `encrypted_credential` within the PostgreSQL `Device` table.
- If using Local LAN (Option A), ensure the TimeBridge worker environment is placed in a secure VLAN that can route to the device.
- If using Cloud API (Option B), validate TLS/SSL certificate trust and secure API key management.
- **NO SECRETS** shall be committed to the repository.

## 15. Recommendation for Next SA Decision

**RECOMMENDED DECISION REQUIRED:**
The SA must decide between **Option A (Direct LAN)** and **Option B (Fingerspot.io Cloud API)**.

- Option A is preferred if TimeBridge strictly requires air-gapped or on-premise execution without third-party cloud dependencies.
- Option B is preferred if the deployment requires managing devices across multiple remote branches without setting up complex VPN routing.

Once the protocol is chosen and the physical device is available, the physical validation matrix can be executed to answer all open items.

## 16. Explicit Scope Boundary

- The adapter `FingerspotAdapter` is **NOT** implemented in this phase.
- No production database schema changes were made.
- This report constitutes the entirety of P17.1.
