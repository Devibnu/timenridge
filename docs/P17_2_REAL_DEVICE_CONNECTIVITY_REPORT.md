# P17.2 Real Device Connectivity & Protocol Validation

## 1. Objective

Validate the REAL physical attendance machine (Fingerspot Vida W-2411M) to obtain runtime evidence and determine the integration path (Option A, B, or C). This decision must be based on actual device capabilities, network connectivity, API/SDK behavior, and data retrieval characteristics.

## 2. Physical Device Information

- **Brand:** Fingerspot
- **Model:** Vida W-2411M
- **IP Address:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Subnet/Network:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Communication Mode:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Port:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Firmware:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Device Identifier:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 3. Test Environment

- **OS:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Hostname:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Local Network Interface:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Relevant Local IP:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED
- **Target Device IP:** NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 4. Network Connectivity

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 5. Authentication

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 6. Device Information

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 7. Device Time & Timezone

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 8. Controlled Attendance Event

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 9. Attendance Retrieval

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 10. Historical Retrieval

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 11. Incremental Retrieval

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 12. Duplicate Retrieval

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 13. Employee ID Findings

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 14. Event Type Findings

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 15. Offline/Reconnect Findings

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 16. Option A — Direct LAN

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 17. Option B — Cloud API

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 18. Option C — Webhook

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 19. Legacy RF888 Boundary

- The Solution RF888 is a legacy reference only.
- It operates on port 4370 via Ethernet.
- There is no evidence suggesting Vida W-2411M uses the same protocol or port.

## 20. Security Findings

- No credentials or sensitive network details have been exposed.
- Secrets must use environment variables or secure local configurations and never be printed or committed.

## 21. Test Matrix

| ID        | Objective                      | Preconditions        | Action                             | Actual Result | Evidence | Status                                  | Notes |
| --------- | ------------------------------ | -------------------- | ---------------------------------- | ------------- | -------- | --------------------------------------- | ----- |
| P17.2-001 | Physical device identity       | Device powered on    | Identify vendor, model, serial     | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-002 | Network reachability           | Known IP             | Ping/TCP check                     | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-003 | TCP/API connectivity           | Known Port/Endpoint  | Check port/HTTP response           | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-004 | Authentication                 | Credentials provided | Authenticate                       | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-005 | Device information             | Authenticated        | Retrieve device metadata           | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-006 | Device time/timezone           | Authenticated        | Retrieve clock info                | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-007 | Controlled attendance creation | Test user enrolled   | Create scan                        | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-008 | Attendance retrieval           | Scan exists          | Fetch recent log                   | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-009 | Historical retrieval           | Logs exist           | Fetch past logs                    | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-010 | Incremental retrieval          | Multiple scans       | Fetch since last point             | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-011 | Duplicate retrieval            | Scans fetched        | Fetch same period again            | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-012 | Employee/device ID             | Log fetched          | Inspect user ID field              | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-013 | Event type                     | Log fetched          | Inspect IN/OUT/Verify mode         | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-014 | Offline/reconnect              | Safe to disconnect   | Disconnect, scan, reconnect, fetch | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-015 | Option A feasibility           | -                    | Assess LAN SDK/API                 | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-016 | Option B feasibility           | -                    | Assess Cloud API                   | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |
| P17.2-017 | Option C feasibility           | -                    | Assess Webhook                     | N/A           | N/A      | NOT EXECUTED — PHYSICAL DEVICE REQUIRED |       |

## 22. Evidence

NOT AVAILABLE — PHYSICAL DEVICE / CONFIGURATION REQUIRED

## 23. Open Items

- Is the real device connected locally (Option A) or strictly via Fingerspot Cloud (Option B/C)?
- What authentication strategy is actually used in the environment?
- What payload structure is returned by the device for attendance?

## 24. Architecture Impact

- P0–P16 Architecture remains LOCKED.
- No `DeviceAdapter` has been implemented or modified yet.

## 25. SA Decision Required

| Capability            | Option A (Direct LAN) | Option B (Cloud API) | Option C (Webhook) |
| --------------------- | --------------------- | -------------------- | ------------------ |
| Physical connectivity | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Authentication        | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Attendance retrieval  | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Historical retrieval  | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Incremental retrieval | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Duplicate behavior    | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Event type            | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Employee ID           | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Network dependency    | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Internet dependency   | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Vendor dependency     | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |
| Evidence status       | NOT AVAILABLE         | NOT AVAILABLE        | NOT AVAILABLE      |

SA DECISION REQUIRED

## 26. Scope Boundary

- The `FingerspotAdapter` was NOT implemented.
- Production architecture boundaries were not bypassed.
- No credentials or fabricated data were included.
