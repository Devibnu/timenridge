# P17.2-R — Real Device Validation Report

**Validation date:** 2026-10-07
**Target named by the request:** Fingerspot Vida W-2411M
**Validation disposition:** Physical-device tests could not be executed from this host because no target address, device identity output, official connection method/tool, authentication method, or safe test employee was available. No endpoint, port, protocol, vendor payload, or credential was guessed. The report separates this limitation from repository regression results.

## 1. Executive Summary

The requested physical device was not reachable for evidence-based validation during this run. The user confirmed that the device IP/approved hostname, LAN reachability, official Fingerspot method/tool, serial, firmware, safe test employee/device ID, and authentication method are all not yet available or identified. Repository evidence in the earlier P17.2 connectivity report also lists these device-specific facts and all physical tests as unavailable/not executed.

Accordingly, this report does **not** establish that the named model has any particular network protocol, endpoint, port, authentication mechanism, event format, cloud integration, webhook, or attendance retrieval capability. No physical-device attendance was created, retrieved, or altered. No network scan or speculative port probe was run. RF888 is treated only as legacy context and provides no Vida protocol evidence.

Repository regression checks completed: `npm test` passed (237 tests across 26 files), `npm run build:all` passed, and `npm run lint` passed. These software checks are not evidence of physical device compatibility.

**RECOMMENDATION FOR SA REVIEW:** Keep P17.4 adapter implementation locked. P17.2-R physical validation remains inconclusive/not executed pending actual device access and official-method evidence. No final integration path is selected here.

## 2. Device Identity

The target model **Vida W-2411M** is the model named by the user; physical identity was not independently confirmed because the device UI or official software output was not available to inspect.

| Field                    | Result            | Evidence                                                                                                                 |
| ------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Brand/model              | **INCONCLUSIVE**  | User named Fingerspot Vida W-2411M; no device screen, label photo, or official software output was supplied in this run. |
| Serial/device identifier | **NOT AVAILABLE** | User confirmed the serial/device identifier is not yet available.                                                        |
| Firmware/version         | **NOT AVAILABLE** | User confirmed firmware is not yet available.                                                                            |
| MAC address              | **NOT AVAILABLE** | No device UI, label, DHCP record, or official software output available.                                                 |
| Evidence reference       | **NOT AVAILABLE** | No device screenshot, official output, or physical log was supplied. No image/log was fabricated.                        |

## 3. Network Environment

| Field                                           | Observed value                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| TimeBridge validation host                      | `Nanangs-MacBook-Air.local`                                                                               |
| Host OS                                         | macOS 26.6.2, build 25G83                                                                                 |
| Active default-route interface                  | `en0`                                                                                                     |
| Host interface address                          | `192.168.100.113`                                                                                         |
| Default gateway                                 | `192.168.100.1`                                                                                           |
| Link type (LAN/Wi-Fi)                           | **INCONCLUSIVE** — not established from supplied evidence                                                 |
| Device address / device subnet / device gateway | **NOT AVAILABLE**                                                                                         |
| Same-subnet or routed reachability              | **NOT TESTED**                                                                                            |
| Topology                                        | The host has a default route on `en0`; the device's network attachment and path to this host are unknown. |

The host values above came from read-only local OS route/address queries. No device discovery scan, broadcast probing, subnet sweep, or port scan was performed. User confirmed that LAN reachability from this host has not yet been tested.

## 4. Communication Discovery

**Status: INCONCLUSIVE.** No official Fingerspot tool or connection method has been identified or made available for this run. Direct LAN/TCP, HTTP/HTTPS, SDK, Fingerspot.io/cloud, webhook/realtime, and official middleware therefore remain candidates only, not findings.

No TCP port or HTTP endpoint was tested or discovered. No port was inferred from another vendor/model or legacy RF888 context. The earlier repository report [P17_2_REAL_DEVICE_CONNECTIVITY_REPORT.md](./P17_2_REAL_DEVICE_CONNECTIVITY_REPORT.md) likewise records the device communication mode, address, port, and firmware as unavailable; this run adds the current host context and user-confirmed access gaps, but does not convert that historical report into physical evidence.

## 5. Authentication

**Status: NOT EXECUTED.** The authentication mechanism and safe local credential-entry method are not yet identified. No credentials were supplied or entered, and no authentication attempt—valid or invalid—was performed. Secrets must be entered only through an approved local official tool once identified; no secret belongs in this report or repository.

## 6. Device Information

**Status: NOT AVAILABLE.** No proven communication method was available to retrieve model, serial, firmware, online status, device time, capacity, or other metadata. No raw device response exists for this run.

## 7. Device Time

**Status: NOT EXECUTED.** Device time/timezone could not be read, so no offset against the TimeBridge host can be calculated. No time synchronization was attempted.

## 8. Controlled Attendance

**Status: NOT EXECUTED.** No safe test employee/device ID was available. No IN or OUT punch was made. No attendance timestamp, event type, transaction/log identifier, or source representation was created or claimed.

## 9. Attendance Retrieval

**Status: NOT EXECUTED.** No device method or real attendance event was available to retrieve. No request mechanism, query/filter, response structure, timestamp representation, employee identifier, or event identifier is evidenced.

## 10. Historical Retrieval

**Status: INCONCLUSIVE.** No method or authorized historical dataset was available to test retrieval by date range, cursor, transaction ID, timestamp, page, offset, or device log ID.

## 11. Incremental Retrieval

**Status: INCONCLUSIVE.** No official incremental API/SDK behavior, transaction watermark, cursor, or timestamp checkpoint was available to inspect. Full-download versus incremental capability is unknown.

## 12. Duplicate Behavior

**Status: NOT EXECUTED.** There was no retrieval method with which to request the same real event twice. Stable transaction identity, source hash suitability, and device-versus-TimeBridge duplicate responsibility remain unknown. No duplicate event was fabricated.

## 13. Employee Identity

**Status: INCONCLUSIVE.** No real device event or official payload was available. The device employee identifier's representation (numeric/string/fixed length), mutability, and uniqueness are unknown. Employee names are not treated as identity keys.

## 14. Event Type

**Status: INCONCLUSIVE.** No event was retrieved. Whether the device supplies IN/OUT, another attendance state, verification mode, punch type, or only a timestamp is unknown. No event type was inferred.

## 15. Offline Behavior

**Status: NOT EXECUTED.** Network disconnection and offline punching were not attempted. Operational safety and a controlled user were not established; disconnecting a business device without those prerequisites would be unsafe.

## 16. Reconnect Behavior

**Status: NOT EXECUTED.** No controlled disconnect/reconnect, retry, or recovery test was performed. No operational retry behavior is claimed.

## 17. Error Behavior

**Status: NOT EXECUTED.** An unreachable-device test, invalid-auth test, and malformed-request test were not performed because no confirmed endpoint, authentication method, or safe official request mechanism was available. No status code, protocol error, timeout, or retry behavior is claimed.

## 18. Integration Path Evidence

No final choice among the three candidates is made. The feasibility status for each is **INCONCLUSIVE** until evidence is collected from the actual Vida W-2411M and its official supported method.

| Candidate                              | Evidence available                                                                                                     | Evidence missing / feasibility                                                                                                                   | Security considerations                                                                                                                                                            | Incremental retrieval                                                                                         | Operational dependency                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **A. Direct device integration**       | The host has a local interface and default route; no device address or route is known.                                 | **INCONCLUSIVE.** No target reachability, vendor-documented endpoint/port, SDK, authentication, device info, or attendance retrieval was tested. | Establish supported authentication, credential handling, transport protection, and network segmentation from official/device evidence before assessment. No credentials were used. | **Unknown.** No cursor/transaction/time watermark or history query tested.                                    | Would depend on actual device network reachability and supported local method if evidenced; neither is established. |
| **B. Fingerspot.io/cloud integration** | No cloud account, official tool output, API documentation tied to this device, or authenticated session was supplied.  | **INCONCLUSIVE.** No device-to-cloud linkage, supported API, account authorization, or retrieval test.                                           | Cloud identity, token scope/lifetime, TLS, secret storage, and tenant/device authorization cannot be assessed without the real official flow.                                      | **Unknown.** No official incremental mechanism tested.                                                        | Internet/cloud service and account dependency are unverified.                                                       |
| **C. Webhook/realtime integration**    | No webhook configuration screen, official event delivery documentation/output, or received real callback was supplied. | **INCONCLUSIVE.** No callback configuration, signing/authentication, delivery, retry, or event payload tested.                                   | Callback authentication/signature, transport protection, replay controls, and endpoint exposure are unverified.                                                                    | **Unknown.** Push delivery would not by itself establish historical or replay capability; neither was tested. | Requires an evidenced device/service webhook capability and network route; neither is established.                  |

## 19. Security

- No password, token, API key, or private credential was requested in chat, used, printed, or written to the repository.
- No authentication attempt occurred.
- No device probing, port scanning, or malformed request was sent.
- No real or synthetic vendor payload was introduced.
- Any future credentials should be entered locally through the verified official tool and must not be copied to reports, logs, or source.
- No change was made to the DeviceAdapter contract, raw-event immutability, collector pipeline, database/schema, API, or production adapter implementation.

## 20. Regression

All requested repository regression commands completed. No physical-device or network service was used by these software checks.

| Command                         | Result           | Evidence                                                                                                                                          |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                      | **PASS**         | Vitest: 26 test files passed; 237 tests passed; exit code 0. Includes mock adapter/unit and API tests; it does not validate the real Vida device. |
| `npm run build:all`             | **PASS**         | Root TypeScript build and frontend `vue-tsc`/Vite production build completed; exit code 0.                                                        |
| `npm run lint`                  | **PASS**         | ESLint completed; exit code 0.                                                                                                                    |
| Services required by regression | **NOT EXECUTED** | No physical device, production API, or device network endpoint was accessed; software tests used repository test configuration.                   |

## 21. Evidence Matrix

| ID          | Objective                      | Status            | Evidence / limitation                                                                                  |
| ----------- | ------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------ |
| P17.2-R-001 | Device identity                | **INCONCLUSIVE**  | Model named by user only; serial, firmware, and device-originated evidence unavailable.                |
| P17.2-R-002 | Network connectivity           | **NOT EXECUTED**  | No device IP/hostname. Host route/address observed; device reachability not tested.                    |
| P17.2-R-003 | Communication method discovery | **INCONCLUSIVE**  | Official device tool/method not identified. No protocol or port guessed/probed.                        |
| P17.2-R-004 | Authentication                 | **NOT EXECUTED**  | Authentication method and local credential-entry path unavailable; no secrets used.                    |
| P17.2-R-005 | Device information             | **NOT AVAILABLE** | No proven device access method or device output.                                                       |
| P17.2-R-006 | Device time                    | **NOT EXECUTED**  | Device time/timezone unavailable; no sync attempted.                                                   |
| P17.2-R-007 | Controlled attendance          | **NOT EXECUTED**  | Safe test employee/device ID unavailable; no punch performed.                                          |
| P17.2-R-008 | Attendance retrieval           | **NOT EXECUTED**  | No proven method/event to retrieve.                                                                    |
| P17.2-R-009 | Historical retrieval           | **INCONCLUSIVE**  | No official retrieval method/data available to test selectors.                                         |
| P17.2-R-010 | Incremental retrieval          | **INCONCLUSIVE**  | No cursor, watermark, transaction ID, or official incremental method evidenced.                        |
| P17.2-R-011 | Duplicate behavior             | **NOT EXECUTED**  | No real event retrieval to repeat; no duplicate fabricated.                                            |
| P17.2-R-012 | Employee ID                    | **INCONCLUSIVE**  | No real attendance response/payload available.                                                         |
| P17.2-R-013 | Event type                     | **INCONCLUSIVE**  | No real event fields available; no IN/OUT inference made.                                              |
| P17.2-R-014 | Offline behavior               | **NOT EXECUTED**  | Safety and test user not established; device was not disconnected.                                     |
| P17.2-R-015 | Reconnect behavior             | **NOT EXECUTED**  | No disconnect/reconnect/retry test.                                                                    |
| P17.2-R-016 | Error behavior                 | **NOT EXECUTED**  | No confirmed endpoint/auth/request method for safe error testing.                                      |
| P17.2-R-017 | Integration path evidence      | **INCONCLUSIVE**  | Direct LAN, cloud, and webhook candidates all lack device-originated evidence; no final path selected. |
| Regression  | Repository tests/build/lint    | **PASS**          | `npm test`: 237/237; `npm run build:all`: pass; `npm run lint`: pass.                                  |

### RECOMMENDATION FOR SA REVIEW

Maintain the P17.4 lock. Physical P17.2-R validation remains **INCONCLUSIVE / NOT EXECUTED** because the current host run has no confirmed device address, official access method, credentials-entry path, or safe test identity. Resume device testing only after these are available and the real unit can be safely accessed. Then gather device-originated identity/network/auth/device-time/attendance evidence before assessing candidate integration paths. This report does not authorize P17.4, declare adapter implementation ready, or select an integration architecture.

**HARD STOP. Await SA review.**
