# P16.7.5 Employee Mapping Mutation UAT Report

**Status: REQUESTED MUTATION UAT MATRIX COMPLETE — HARD STOP FOR SA REVIEW**
This is not a final P16.7.5 PASS and does not close the scope. The SA-requested mutation scenarios are recorded below as complete. UAT-05 (ambiguous resolution) remains unexecuted because the validated database exclusion constraint prevents the overlapping mappings needed to represent ambiguity. Stop here for SA review.

## 1. Objective

Run the P16.7.5 Employee Mapping mutation UAT against the dedicated P16.7.5-R2 fixture, with special attention to proving that live `RESOLVE` returns a `MappingResolution` and never changes its `AttendanceEvent`.

## 2. Environment

- PostgreSQL target verified before access: `127.0.0.1:5432/timebridge_dev`.
- Local API started on `127.0.0.1:3000`; `GET /health` returned HTTP 200 and `status: healthy` after UAT.
- Local API authentication succeeded using the existing local test account. The credential value is intentionally omitted from this report.
- Auditor denial requests used a short-lived locally signed `AUDITOR` role claim for the existing local test user ID. No user row or stored role was changed. This exercised the API's actual authentication and authorization middleware, but was not a login as a separately provisioned Auditor account.
- No production/staging database, remote API, or external SAP endpoint was accessed.
- No source, schema, migration, API contract, or architecture file was changed. No build, lint, or regression suite was run because application code was not changed.

## 3. Fixture and Final Mapping State

The original dedicated device, employee, and canonical event were retained:

| Entity | ID | Identity |
| --- | --- | --- |
| Device | `4581b3bd-ad45-44aa-a810-dfb65c144ce0` | `P1675-UAT-DEVICE-001` |
| Employee | `62a36ed5-c978-4f63-b45c-e479028a1bee` | `P1675-UAT-001` |
| Canonical event | `bb51f9b9-6d90-4995-a406-b67b1aee4e2c` | `P1675-UAT-001`, `P1675-SAP-001` |

For the exclusive-end and adjacent-period tests, the original mapping was split at the event timestamp. The final fixture resolution uses the right-hand mapping:

| Mapping ID | Device employee ID | SAP employee ID | Validity `[from, to)` | Active | Purpose |
| --- | --- | --- | --- | --- | --- |
| `72ab9833-1465-49fa-8fec-3404411c2161` | `P1675-UAT-001` | `P1675-SAP-001` | `[2026-01-01T00:00:00.000Z, 2026-10-05T02:00:00.000Z)` | Yes | Left interval; original R2 mapping |
| `adfd29ef-b27a-470c-91d0-18d9dd362490` | `P1675-UAT-001` | `P1675-SAP-001` | `[2026-10-05T02:00:00.000Z, 2027-01-01T00:00:00.000Z)` | Yes | Adjacent right interval; created through the API |
| `22c43edc-b668-4d63-bc44-47db98bf2225` | `P1675-UAT-CREATE-001` | `P1675-SAP-CREATE-UPDATED-001` | `[2020-01-01T00:00:00.000Z, 2022-01-01T00:00:00.000Z)` | No | Dedicated API CREATE/UPDATE/DEACTIVATE test mapping |

The helper mapping is deliberately retained as inactive; no cleanup was performed. The pre-existing non-fixture mapping remains unchanged.

## 4. AttendanceEvent Identity and RESOLVE Immutability

| Field | Value |
| --- | --- |
| Event ID | `bb51f9b9-6d90-4995-a406-b67b1aee4e2c` |
| Event UID | `eec8ebfef3ff3546493d243cd43d8b9cac73161cd4d3ecf2803ce2aa79281fa1` |
| Device ID | `4581b3bd-ad45-44aa-a810-dfb65c144ce0` |
| Device employee ID | `P1675-UAT-001` |
| `employee_id` | `62a36ed5-c978-4f63-b45c-e479028a1bee` |
| `sap_employee_id` | `P1675-SAP-001` |
| `event_timestamp` | `2026-10-05T02:00:00.000Z` |
| `event_date` / `event_time` | `2026-10-05` / `09:00:00` (Asia/Jakarta) |
| `event_type` / `status` | `IN` / `RECEIVED` |
| `source` | `P16.7.5_UAT_FIXTURE` |
| `created_at` | `2026-10-06T00:40:55.973Z` |
| `updated_at` | `2026-10-06T00:40:55.973Z` |

The live `POST /api/employee-mappings/resolve` route returned resolution data and was checked against a full-row event snapshot on every invocation:

| Resolve case | HTTP | Resolution | Resolved mapping | `employee_id`, `sap_employee_id`, `updated_at` unchanged |
| --- | ---: | --- | --- | --- |
| Initial mapped fixture (UAT-03) | 200 | `MAPPED`, employee `62a36ed5-c978-4f63-b45c-e479028a1bee`, SAP `P1675-SAP-001` | `72ab9833-1465-49fa-8fec-3404411c2161` | Yes |
| After temporary SAP mapping update (UAT-06) | 200 | `MAPPED`, employee `62a36ed5-c978-4f63-b45c-e479028a1bee`, SAP `P1675-SAP-UPDATED-001` | `72ab9833-1465-49fa-8fec-3404411c2161` | Yes |
| At the exclusive `valid_to` before the adjacent mapping was added (UAT-04) | 200 | `UNMAPPED`; employee and SAP resolution fields null | None | Yes |
| At the exact shared boundary after adding the adjacent mapping (UAT-07) | 200 | `MAPPED`, employee `62a36ed5-c978-4f63-b45c-e479028a1bee`, SAP `P1675-SAP-001` | `adfd29ef-b27a-470c-91d0-18d9dd362490` | Yes |
| Final resolve after update, deactivation, and history setup (UAT-13) | 200 | `MAPPED`, employee `62a36ed5-c978-4f63-b45c-e479028a1bee`, SAP `P1675-SAP-001` | `adfd29ef-b27a-470c-91d0-18d9dd362490` | Yes |

For every resolve above, the event's before/after values were identical:

```text
employee_id:     62a36ed5-c978-4f63-b45c-e479028a1bee
sap_employee_id: P1675-SAP-001
updated_at:      2026-10-06T00:40:55.973Z
```

The serialized full event row also compared equal in the before/after Prisma snapshots at every resolve. Across the UAT, `AttendanceEvent` remained at 2 rows with identical full-table SHA-256:

```text
before = after = b72db6c7f74079c53528249c62deda9b62df6c50d9882de28e4c8f9e08e85cb9
```

## 5. UAT Test Matrix

| ID | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| UAT-01 | Create dedicated valid mapping | **PASS** | `POST` returned 201; created mapping `22c43edc-b668-4d63-bc44-47db98bf2225`, bounded `[2020-01-01, 2021-01-01)`. |
| UAT-02 | Read/list fixture | **PASS** | List and detail returned 200 and the exact R2 identity, mapping, employee, and device. |
| UAT-03 | Resolve mapped fixture; compare event before/after | **PASS** | `MAPPED` to original mapping; full `AttendanceEvent` row unchanged. |
| UAT-04 | Resolve unmapped event | **PASS** | Temporarily set original mapping's exclusive end to the event timestamp; resolver returned `UNMAPPED`, created no mapping, and left the event unchanged. |
| UAT-05 | Resolve ambiguous identity | **NOT EXECUTED** | A matching ambiguity would require overlapping same-device mapping ranges. The validated exclusion constraint prevents this; it was not bypassed. |
| UAT-06 | Update fixture mapping | **PASS** | Updated SAP ID through `PATCH`; resolver returned the updated mapping SAP ID. Restored the original SAP ID. Also updated the helper mapping's SAP ID and end date. |
| UAT-07 | Adjacent historical periods/shared boundary | **PASS** | A later staged run moved only the mapping interval endpoints around the existing fixture event timestamp, resolved on the left interval, resolved on the exact right-hand boundary, and restored the original interval endpoints. `AttendanceEvent` was unchanged throughout. |
| UAT-08 | Overlap rejection | **PASS** | Overlapping `POST` returned 400 with `Overlapping mapping found for this device validity period`; no overlap-test row was stored. |
| UAT-09 | Deactivate fixture mapping | **PASS** | Deactivated isolated API-created helper mapping; response showed `is_active: false`. Primary event mapping intervals remain active and resolve the event. |
| UAT-10 | Auditor CREATE/UPDATE/DEACTIVATE | **PASS WITH TEST-TOKEN LIMITATION** | All three API requests returned 403. AuditLog count did not change during denied attempts. Used a short-lived local `AUDITOR` JWT claim; no account role was changed. |
| UAT-11 | Attendance immutability | **PASS** | Raw events, canonical events, rule results, cycles, integration records, and SAP responses had no unexpected row changes. Each resolve also preserved the event. |
| UAT-12 | CREATE/UPDATE/DEACTIVATE audit trail | **PASS** | Seven expected Employee Mapping audit entries recorded with before/after values; IDs and actions are listed below. |
| UAT-13 | Final resolve after update/deactivate/history | **PASS** | Final result `MAPPED` to `adfd29ef-b27a-470c-91d0-18d9dd362490`; event remained unchanged. |

### Overlap/ambiguity behavior

The overlap CREATE was rejected at HTTP 400 before insertion. PostgreSQL still reports `no_overlapping_mapping` as a validated GiST exclusion constraint:

```text
EXCLUDE USING gist (
  device_id WITH =,
  tsrange(valid_from, COALESCE(valid_to, 'infinity'), '[)') WITH &&
)
```

Constraint type was `x`, `convalidated` was `true`, and no overlap pairs existed after UAT. No invalid overlapping rows were inserted.

### Mapping audit entries

All seven API mapping mutations produced an `AuditLog` entry with target `employee_mappings` and before/after data where applicable:

| Audit ID | Action | Mapping ID |
| --- | --- | --- |
| `ac4d8bee-c15f-4180-83b1-61d8ddffb0b1` | `EMPLOYEE_MAPPING_CREATED` | `22c43edc-b668-4d63-bc44-47db98bf2225` |
| `22276c35-6187-49b8-a475-a1ad75e52944` | `EMPLOYEE_MAPPING_UPDATED` | `72ab9833-1465-49fa-8fec-3404411c2161` |
| `059815fd-a38e-4a3a-8ac9-1e02b2f430d8` | `EMPLOYEE_MAPPING_UPDATED` | `72ab9833-1465-49fa-8fec-3404411c2161` |
| `eb54a1d2-45c9-47b9-b06b-88db11fe0957` | `EMPLOYEE_MAPPING_UPDATED` | `72ab9833-1465-49fa-8fec-3404411c2161` |
| `7fdc202a-7e59-4d21-b829-5e1bcfc74ba8` | `EMPLOYEE_MAPPING_CREATED` | `adfd29ef-b27a-470c-91d0-18d9dd362490` |
| `d134eca1-fc17-4a97-8a2a-35db727f3e2a` | `EMPLOYEE_MAPPING_UPDATED` | `22c43edc-b668-4d63-bc44-47db98bf2225` |
| `d3b51cec-611b-4a17-b2db-b600f5e5f121` | `EMPLOYEE_MAPPING_DEACTIVATED` | `22c43edc-b668-4d63-bc44-47db98bf2225` |

The API wrote `API_USER` as the audit actor because the route falls back to that value when the authenticated token has no email claim. This is recorded as existing API behavior; no contract or source changes were made.

## 6. Before/After Data Snapshot

The baseline was captured immediately before the first UAT login/mutation at `2026-10-06T00:50:27.791Z`. Full-row hashes of the original rows were compared after all UAT operations.

| Table | Before → after | Expected delta | Existing rows |
| --- | ---: | ---: | --- |
| `AttendanceRawEvent` | 1 → 1 | 0 | Unchanged; SHA-256 `8c5d0c439e374e2150b9cb9088b5d9eb91b1d698d6a49bd63b5d210e21ce30eb` |
| `AttendanceEvent` | 2 → 2 | 0 | Unchanged; SHA-256 `b72db6c7f74079c53528249c62deda9b62df6c50d9882de28e4c8f9e08e85cb9` |
| `AttendanceRuleResult` | 1 → 1 | 0 | Unchanged; SHA-256 `a5cbe9ccb94f066c09e256c8440bcaeb969bf61db61090a6fa43a6efaaeb319c` |
| `AttendanceCycle` | 1 → 1 | 0 | Unchanged; SHA-256 `817001d95131de33e6fd5a58828a31b06529f109312b95794cd6abf6f680277d3` |
| `IntegrationBatch` | 0 → 0 | 0 | Unchanged |
| `IntegrationFile` | 0 → 0 | 0 | Unchanged |
| `SapResponse` | 0 → 0 | 0 | Unchanged |
| `SecurityAuditLog` | 38 → 40 | +2 successful local API logins | Original 38 rows unchanged; SHA-256 `b6550e2ee0560e45d288dc89c8e0ad1a428c25211328ba327d67dc16d59531b3` |
| `EmployeeMapping` | 2 → 4 | +2 mapping rows | The pre-existing non-fixture mapping is unchanged. Original R2 mapping was intentionally updated and split; the two new P16.7.5 UAT mappings are listed above. |
| `Device` | 5 → 5 | 0 | Unchanged; SHA-256 `924a3f2d56e640ae7771ec14eedbbaaed1994d10cb5e6efcb918203010806578` |
| `Employee` | 5 → 5 | 0 | Unchanged; SHA-256 `8baee95d0e6af957529e387f79e5043d4f0a472f47a6b6dc26fd8dbf78573f68` |
| `AuditLog` | 14 → 21 | +7 expected mapping mutations | Original 14 rows unchanged; SHA-256 `8d5e9ca3d2127f3676af42d716c9a70c9c76a1450f231791579b4b54b386f411` |

The two additional `SecurityAuditLog` rows correspond to the two successful local UAT logins. No login failure or mutation attempt by the Auditor token changed either mapping data or the mapping `AuditLog`.

## 7. Execution Note

The first UAT run stopped after successful UAT-07 boundary resolution because a test-harness assertion expected three mappings intersecting the fixture's 2026–2027 period, but the correct result was two: the separate CREATE helper mapping was bounded to 2020–2021. No application or database invariant failed. The count assertion was corrected conceptually to count the two fixture-identity intervals; the remaining UPDATE, DEACTIVATE, final RESOLVE, and read-only verification then completed. No data was rolled back or cleaned up.

## 8. Staged Re-check

On 2026-10-06, the local API and the retained final fixture state were checked again in stages. This re-check was read-only apart from the RESOLVE request and did not repeat CREATE, UPDATE, or DEACTIVATE.

| Stage | Result | Evidence |
| --- | --- | --- |
| 1. `GET /health` | **PASS** | HTTP 200; `status: healthy` from `http://127.0.0.1:3000/health`. |
| 2. READ mapping list and detail | **PASS** | Both HTTP 200. Mapping `72ab9833-1465-49fa-8fec-3404411c2161` remained active with `[2026-01-01T00:00:00.000Z, 2026-10-05T02:00:00.000Z)`. Active fixture mappings were `72ab9833-1465-49fa-8fec-3404411c2161` and `adfd29ef-b27a-470c-91d0-18d9dd362490`. |
| 3. `POST /api/employee-mappings/resolve` | **PASS** | HTTP 200; `MAPPED` to `adfd29ef-b27a-470c-91d0-18d9dd362490`, employee `62a36ed5-c978-4f63-b45c-e479028a1bee`, SAP `P1675-SAP-001`. |
| 4. Event immutability around re-check RESOLVE | **PASS** | Fixture event `bb51f9b9-6d90-4995-a406-b67b1aee4e2c` had identical serialized full-row snapshots. `employee_id` remained `62a36ed5-c978-4f63-b45c-e479028a1bee`, `sap_employee_id` remained `P1675-SAP-001`, and `updated_at` remained `2026-10-06T00:40:55.973Z`. |

The previously recorded mutation UAT evidence remains the evidence for CREATE/UPDATE/DEACTIVATE, overlap rejection, authorization and audit behavior; these mutation stages were not repeated in this read-only re-check.

## 9. SA-Directed Remaining Mutation Matrix

On 2026-10-07, the remaining mutation scenarios requested by SA were run against the existing R2 device/employee/event. No Device, Employee, AttendanceEvent, AttendanceRuleResult, AttendanceCycle, IntegrationBatch, IntegrationFile, or SapResponse was created or changed. One mapping row was created through the API for CREATE/UPDATE/DEACTIVATE verification; it uses the existing fixture Device and Employee, is retained inactive, and is not a new attendance fixture.

### Stage results

| Stage | Result | Evidence |
| --- | --- | --- |
| Local API health | **PASS** | `GET http://127.0.0.1:3000/health` returned HTTP 200, `healthy`. |
| CREATE | **PASS** | API returned 201 for mapping `daef53cc-109a-405c-a067-36ebe0fc5b4a`; bounded `[2018-01-01, 2019-01-01)`, device employee ID `P1675-UAT-ROUND2-001`. |
| UPDATE | **PASS** | API returned 200; SAP ID changed to `P1675-SAP-ROUND2-UPDATED` and `valid_to` to `2020-01-01T00:00:00.000Z`. |
| DEACTIVATE | **PASS** | API returned 200; the same mapping is now inactive and retained. |
| UNMAPPED | **PASS** | The right interval start was temporarily shifted one second after the unchanged event timestamp, producing a gap. Resolve returned `UNMAPPED`; event remained unchanged. |
| Historical boundary | **PASS** | The left interval was temporarily extended to one second after the event time; resolve at the existing event timestamp selected left mapping `72ab9833-1465-49fa-8fec-3404411c2161`. At the exact restored shared boundary it selected right mapping `adfd29ef-b27a-470c-91d0-18d9dd362490`. Original bounds were restored. |
| Overlap rejection | **PASS** | Overlapping CREATE returned HTTP 400 (`Overlapping mapping found for this device validity period`); no row was written. |
| Auditor mutations | **PASS** | CREATE, UPDATE, and DEACTIVATE all returned HTTP 403. AuditLog count did not change during the denied requests; no attempted CREATE row exists. |
| Audit trail | **PASS** | Seven mapping audit entries for the successful API mutations were found with before/after state. |
| Attendance immutability | **PASS** | Fixture event full-row digest stayed `8d39f88970dad8dc8a9eb505a0f777a2ce8a9abdf01a4256e0ca06fc8f40e068`; `employee_id`, `sap_employee_id`, and `updated_at` remained unchanged. |

The seven `AuditLog` entries for this run:

| Audit ID | Action | Mapping ID |
| --- | --- | --- |
| `6b8f62f7-7757-445e-9759-a242b4f7ad13` | `EMPLOYEE_MAPPING_CREATED` | `daef53cc-109a-405c-a067-36ebe0fc5b4a` |
| `d43d2558-5bb8-48d2-8be1-099967f5a625` | `EMPLOYEE_MAPPING_UPDATED` | `daef53cc-109a-405c-a067-36ebe0fc5b4a` |
| `88d83ad5-b400-4ddc-a1a8-877154fcf157` | `EMPLOYEE_MAPPING_UPDATED` | `adfd29ef-b27a-470c-91d0-18d9dd362490` |
| `d21b82f2-1940-42f1-ac1f-fe41de3d2f14` | `EMPLOYEE_MAPPING_UPDATED` | `72ab9833-1465-49fa-8fec-3404411c2161` |
| `2a97085f-2943-4759-8eba-8e1dd54ed3a8` | `EMPLOYEE_MAPPING_UPDATED` | `72ab9833-1465-49fa-8fec-3404411c2161` |
| `5cf9202a-2969-4964-b567-2896169ff4fe` | `EMPLOYEE_MAPPING_UPDATED` | `adfd29ef-b27a-470c-91d0-18d9dd362490` |
| `9163395d-037f-44c1-a571-198a54f12c19` | `EMPLOYEE_MAPPING_DEACTIVATED` | `daef53cc-109a-405c-a067-36ebe0fc5b4a` |

### Final snapshot for this run

Baseline was captured at `2026-10-07T02:59:38.599Z`. Protected table counts and full-row hashes were identical in the post-run read-only verification:

| Table | Count before → after | SHA-256 (before = after) |
| --- | ---: | --- |
| `AttendanceRawEvent` | 1 → 1 | `8c5d0c439e374e2150b9cb9088b5d9eb91b1d698d6a49bd63b5d210e21ce30eb` |
| `AttendanceEvent` | 2 → 2 | `b72db6c7f74079c53528249c62deda9b62df6c50d9882de28e4c8f9e08e85cb9` |
| `AttendanceRuleResult` | 1 → 1 | `a5cbe9ccb94f066c09e256c8440bcaeb969bf61db61090a6fa43a6efaaeb319c` |
| `AttendanceCycle` | 1 → 1 | `817001d95131de33e6fd5a58828a31b06529f109312b95794cd6abf6f680277d3` |
| `IntegrationBatch` | 0 → 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `IntegrationFile` | 0 → 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `SapResponse` | 0 → 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `SecurityAuditLog` | 40 → 40 | `0486cd235fa1d39d0b63d8fa1efff795355d325b6db279d4436f5e1a44c7665f` |

The R2 intervals were restored to `[2026-01-01T00:00:00.000Z, 2026-10-05T02:00:00.000Z)` and `[2026-10-05T02:00:00.000Z, 2027-01-01T00:00:00.000Z)`, both active. The new UAT mapping `daef53cc-109a-405c-a067-36ebe0fc5b4a` remains inactive at `[2018-01-01T00:00:00.000Z, 2020-01-01T00:00:00.000Z)`. The `no_overlapping_mapping` exclusion constraint remained type `x`, validated, and no mapping overlap pairs were present.

The first run's final evidence collector stopped on a test-harness assertion after all endpoint calls had completed. No rollback or cleanup followed. The final mapping state, all seven audit entries, the restored bounds, and protected table hashes were then verified using separate read-only database queries.

## 10. Regression and Cleanup

- Build/lint/regression suites: **not run**; no code changed.
- Fixture cleanup: **not performed**.
- No UAT event or additional fixture event was created.
- The API remained healthy on local port 3000 at final verification.

## 11. Recommendation and Stop

**REQUESTED MUTATION UAT MATRIX COMPLETE — HARD STOP FOR SA REVIEW.** The requested CREATE, UPDATE, DEACTIVATE, UNMAPPED, historical-boundary, overlap-rejection, Auditor 403, and audit-trail scenarios are recorded as complete in Section 9. P16.7.5 is not declared PASS or closed. UAT-05 (ambiguous resolution) remains unexecuted because the validated device-scoped exclusion constraint prevents the overlapping mappings required to create ambiguity; no bypass was attempted.

During reconciliation of the SA instruction, the live local database was checked read-only. It confirmed the existing R2 final mapping intervals and inactive CREATE/UPDATE/DEACTIVATE helper mapping, the recorded mapping audit entries, the validated `no_overlapping_mapping` constraint, and unchanged protected-table counts. Since the requested mutation results were already present in the report and durable audit state, no duplicate mutations were issued.

Stop here for SA review. Do not declare P16.7.5 closed or run further mutations without SA direction.
