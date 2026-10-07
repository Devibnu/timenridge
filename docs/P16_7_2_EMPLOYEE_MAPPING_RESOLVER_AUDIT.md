# P16.7.2 Employee Mapping Resolver Audit

**Audit mode:** read-only source and documentation inspection
**Decision status:** awaiting SA
**Implementation/UAT:** not performed
**Attendance data:** not changed

## 1. Current Resolver Behavior

`EmployeeMappingResolver.resolve(eventId)` first reads the canonical `AttendanceEvent` by ID. If it does not exist, it throws an error rather than returning the declared `INVALID` result. It then queries `EmployeeMapping` by device, device employee ID, `is_active: true`, `valid_from <= event_timestamp`, and `valid_to IS NULL OR valid_to > event_timestamp` ([resolver](../packages/attendance-engine/src/mapping/EmployeeMappingResolver.ts:19)). This query applies a half-open `[valid_from, valid_to)` period and evaluates against the event timestamp.

The current result handling is:

| Query result | Returned status | Current database side effect |
| --- | --- | --- |
| No mappings | `UNMAPPED` | Updates `AttendanceEvent.status` to `REVIEW_REQUIRED` |
| More than one mapping | `AMBIGUOUS` | Updates `AttendanceEvent.status` to `REVIEW_REQUIRED` |
| Exactly one mapping | `MAPPED` | Updates `AttendanceEvent.employee_id`, `sap_employee_id`, and `status` to `MAPPED` |

The interface also declares `INVALID`, but this implementation never returns it. It returns neither a mapping identifier nor the matched validity period. Inactive mappings are filtered out, so an event that only matches an inactive record is reported as `UNMAPPED`; there is no distinct inactive result. A historical event can resolve as `MAPPED` if an active mapping covers its timestamp, but the resolver does not return a distinct historical status.

## 2. Call Graph

The only application runtime caller found is the authenticated `POST /api/employee-mappings/resolve` route. It validates `canonical_event_id`, calls `resolver.resolve(...)`, and returns the result ([route](../apps/api/src/routes/employee-mappings.ts:228)). The route requires `authenticate` and `Permissions.ATTENDANCE_PROCESS` authorization.

The mapping UI calls that endpoint and displays the returned status; it does not inspect or depend on an `AttendanceEvent` update ([service](../frontend/src/services/employeeMappings.ts:100), [view](../frontend/src/views/mappings/EmployeeMappingList.vue:276)). Unit tests call the resolver directly. No worker or automatic attendance processing call site for this resolver was found. A root-level `test-e2e-final.ts` script calls it, but that standalone script is not an application runtime caller.

## 3. AttendanceEvent Mutation Path

The resolver contains three direct calls to `prisma.attendanceEvent.update`: the unmapped branch, ambiguous branch, and mapped branch ([resolver](../packages/attendance-engine/src/mapping/EmployeeMappingResolver.ts:53)). Consequently, a successful resolve request mutates the canonical row even though the HTTP response is constructed from a separate result object. The API and UI do not surface whether that write occurred.

The resolver itself does not update raw attendance, rule results, cycles, batches, or audit logs. This audit made no API resolve request and performed no mutation UAT.

## 4. Why Mutation Occurs

The resolver’s own documentation says it “Updates the attendance event with the mapped employee ID and status.” Existing tests encode that behavior: mapped, unmapped, and ambiguous cases all assert `attendanceEvent.update` calls ([mapping tests](../packages/attendance-engine/src/tests/mapping.test.ts:91)). This indicates that the write is intentional in the current implementation and is consistent with the P7 report’s statement that an unmapped canonical event goes to `REVIEW_REQUIRED` ([P7 report](PHASE_P7_REPORT.md:37)).

However, the inspected sources contain no approval artifact establishing an exception to the canonical-event immutability requirement. The P7 narrative describes status and identity persistence, but that description alone does not settle the later immutability decision.

## 5. P7 Architecture Alignment

The temporal predicate in the resolver uses `valid_from <= event_timestamp < valid_to`, with no upper bound when `valid_to` is null. This agrees with the current database exclusion constraint’s `[)` range convention ([migration](../packages/database/prisma/migrations/20260923224227_p7_restore_gist_constraint/migration.sql:7)). The resolver also checks device employee identity and active state in addition to device ID.

Two material inconsistencies need SA review:

1. `docs/PHASE_P7_REPORT.md` says `event_timestamp <= valid_to` in its validity example ([P7 report](PHASE_P7_REPORT.md:25)), while the current resolver and exclusion constraint treat `valid_to` as exclusive.
2. The P7 report’s reproduced constraint is scoped by device and device employee ID and filtered to active mappings ([P7 report](PHASE_P7_REPORT.md:63)); the current migration’s constraint shown above is scoped by device and time range only, with no such predicate. This audit does not propose changing the schema, migration, or constraint.

The normalizer creates canonical events with null `employee_id` and `sap_employee_id` ([normalizer](../packages/attendance-engine/src/normalizer/AttendanceNormalizer.ts:140)). That fits a mapping-as-a-separate-resolution concept, but the present resolver later writes those fields.

## 6. Immutability Violation

The resolver’s three `AttendanceEvent.update` operations conflict with the immutability rule recorded in `AttendanceRuleEngine.persistResult()`, which explicitly says it does not mutate `AttendanceEvent.status` to preserve canonical event immutability ([rule engine](../packages/attendance-engine/src/rules/AttendanceRuleEngine.ts:108)). On an unmapped or ambiguous resolution, the resolver changes status; on a mapped resolution, it changes status and identity fields.

This is a source-level finding, not a claim about production or local database state. No attendance row was read or changed as part of this audit.

## 7. Proposed Pure Resolution Contract

For SA consideration only; no contract or code was changed:

- Treat the canonical event as read-only input to resolution.
- Return the resolution decision and relevant mapping data as a value, without issuing any `AttendanceEvent` write.
- Preserve the existing `MAPPED`, `UNMAPPED`, and `AMBIGUOUS` meaning unless SA approves a different vocabulary. The existing `INVALID` status should be clarified because it is declared but not currently produced.
- Consider adding `mapping_id` and the matched `valid_from` / `valid_to` to the result for traceability, subject to SA approval of the API response contract. The current response does not include these fields.
- Decide separately whether an inactive-only match should remain `UNMAPPED` or have a distinct result. Do not infer a new status from current code.
- Keep authentication, RBAC, mapping create/update/deactivate behavior, audit logging, schema, and exclusion constraint out of the resolver remediation scope.

## 8. Historical Mapping Behavior

Resolution uses the canonical event’s `event_timestamp`, not the current wall clock, to test the mapping interval. Therefore, an active mapping whose half-open validity interval contains an older event timestamp can resolve that event as `MAPPED`; the existing `P7-HIST-001` unit test checks this general case ([test](../packages/attendance-engine/src/tests/mapping.test.ts:165)).

Because the query also requires `is_active: true`, a mapping that has since been deactivated will not be considered even if its validity interval covers the historical event. The current code therefore preserves time-based lookup only for mappings still active. SA should decide whether that behavior is intended for historical resolution; this audit does not change it.

At the exact `valid_to` timestamp, the mapping does not match because the query uses `gt`, consistent with `[valid_from, valid_to)`. Existing “boundary” coverage is not an actual boundary assertion: `P7-BOUNDARY-001 to 005` currently contains only `expect(true).toBe(true)` ([test](../packages/attendance-engine/src/tests/mapping.test.ts:197)).

## 9. Test Design

If SA approves remediation, the following test coverage is recommended:

1. Assert the resolver returns mapped, unmapped, and ambiguous values while `attendanceEvent.update`, `create`, and `delete` are never called.
2. Assert the half-open boundaries exactly: timestamp equal to `valid_from` matches; timestamp equal to `valid_to` does not; null `valid_to` remains open-ended.
3. Assert historical resolution uses the event timestamp and explicitly decide/test whether a currently inactive mapping may resolve a historical event.
4. Assert the result includes any SA-approved mapping identifier and validity metadata.
5. Keep API route tests for authentication/RBAC and validate the approved response shape; current API tests mock the resolver and do not verify database writes.
6. Add downstream rule/cycle/reconciliation coverage for the approved way resolution context reaches consumers without mutating the canonical event.

No tests were run during this audit, as no implementation or runtime verification was requested.

## 10. Required Implementation Changes

If remediation is approved, likely work will be required in the resolver and its unit tests, plus the resolution result type and frontend/API types if the response shape changes. Downstream integration also needs an explicit design: the rule engine currently reads `AttendanceEvent.employee_id` and immediately marks an event unmapped when it is null ([rule engine](../packages/attendance-engine/src/rules/AttendanceRuleEngine.ts:21)); reconciliation derives mapping status and employee IDs from persisted canonical fields ([reconciliation](../packages/attendance-engine/src/reconciliation/ReconciliationService.ts:63)). A pure resolver alone would stop new writes but would not populate those downstream inputs.

SA should determine whether callers pass a separate resolution context, persist mapping results in an already-approved separate domain, or use another mechanism. This audit does not select among those options. Any approved implementation should leave the existing P7 constraint and schema untouched unless a separate decision authorizes otherwise.

## 11. Risks

- Removing resolver writes without changing downstream data flow would cause rule evaluation to treat newly normalized events with null employee IDs as unmapped; reconciliation would likewise continue to report missing mapping fields.
- Keeping the current writes means the stated canonical immutability rule remains violated.
- The existing boundary test gives no evidence for the claimed boundary cases, and P7 prose conflicts with the actual half-open comparison.
- Excluding inactive mappings may be correct for current operational resolution but may be unsuitable for historical trace/replay needs; this remains a policy decision.
- Extending the response can affect API consumers and frontend types, even if fields are additive. Contract compatibility requires an SA decision.

## 12. SA Decision Required

1. Confirm that `AttendanceEvent` is immutable for mapping resolution, including `status`, `employee_id`, and `sap_employee_id`.
2. Define how rule evaluation, cycles, and reconciliation receive a mapping result when it is not stored on `AttendanceEvent`.
3. Decide historical behavior for mappings that are currently inactive but were valid at the event timestamp.
4. Confirm the half-open `[valid_from, valid_to)` interpretation and whether P7 documentation should be corrected in a separately authorized documentation task.
5. Approve whether the resolver response may add mapping ID and matched-period fields, and clarify `INVALID`/inactive status semantics.

**Audit conclusion:** Current resolver code mutates `AttendanceEvent` in each resolution branch. A pure resolver is feasible as a lookup/result operation, but end-to-end behavior requires an SA decision for consumers that currently read employee identity from the canonical row. No implementation, test run, mutation UAT, or attendance-data change was performed. Awaiting SA review.
