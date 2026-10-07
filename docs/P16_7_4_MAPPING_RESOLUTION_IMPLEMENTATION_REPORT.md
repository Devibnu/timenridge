# P16.7.4 Mapping Resolution Implementation Report

**Final status: PASS WITH ENVIRONMENT LIMITATION**
**SA closure decision:** pending SA review; this report does not declare P16.7.4 closed.

## 1. Objective

Make `EmployeeMappingResolver` read-only, carry mapping identity without changing canonical attendance events, and preserve mapped identity through rule, cycle, SAP batch, and event reconciliation processing using existing persistence structures.

## 2. SA Architecture Decision Implemented

Implemented the approved `MappingResolution` value with `MAPPED`, `UNMAPPED`, and `AMBIGUOUS` statuses, and a typed `AttendanceProcessingContext` tied to `attendanceEventId`. The context is persisted inside the existing `AttendanceRuleResult.input_data` JSON. No new resolution table or schema field was added.

## 3. Current Flow Before Change

Canonical event → resolver read mapping and updated `AttendanceEvent` identity/status → Rule Engine read `AttendanceEvent.employee_id` → Cycle Engine accepted employee ID separately and read SAP ID from event fields → Batch read identity from the cycle → event reconciliation read identity from the canonical event.

The resolver route was the only production caller found for the resolver. No production application call site chained the Rule, Cycle, or Batch engines.

## 4. Final Flow After Change

Canonical event → pure resolver returns `MappingResolution` → Rule Engine consumes the supplied context (or resolves it itself when omitted) → Rule Engine persists context in the existing rule-result JSON → Cycle Engine reads mapped employee/SAP identity from that context → Batch uses the persisted cycle SAP identity → Reconciliation reads the rule-result context and exposes it in the existing trace metadata field.

Cycle generation rejects missing, unresolved, or conflicting contexts with the existing `ERROR` result instead of creating a cycle under an invented or ambiguous identity. The Cycle, Batch, and Reconciliation engine methods remain independently invoked components; no production orchestrator was found, and none was invented because event grouping/business-date trigger policy is not specified in the repository.

## 5. Files Changed

| Path                                                                     | Purpose                        | Change                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/attendance-engine/src/mapping/EmployeeMappingResolver.ts`      | Mapping lookup                 | Replaced event-mutating resolver with a read-only `MappingResolution`; retains `valid_from <= event_timestamp < valid_to` behavior and returns `mappingId`.                                     |
| `packages/attendance-engine/src/rules/AttendanceRuleEngine.ts`           | Rule processing                | Accepts/obtains processing context, passes `employeeId` to shift resolution, resolves prior events without relying on mutated canonical identity, and persists mapping context in `input_data`. |
| `packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts`          | Cycle processing               | Reads identity from persisted processing contexts; refuses unresolved or conflicting context groups.                                                                                            |
| `packages/attendance-engine/src/reconciliation/ReconciliationService.ts` | Traceability                   | Reads resolution from rule-result JSON, fills existing employee trace fields, and adds resolution details to the already-supported optional trace metadata.                                     |
| `apps/api/src/routes/employee-mappings.ts`                               | Resolve endpoint               | Preserves existing response fields and authorization; adapts the pure result to the established snake-case response and adds `mapping_id`. No attendance write.                                 |
| `packages/attendance-engine/src/tests/mapping.test.ts`                   | Resolver regression tests      | Checks mapped/unmapped/ambiguous results, mapping identity, temporal filters, and no event update.                                                                                              |
| `packages/attendance-engine/src/tests/rule-mapping-context.test.ts`      | Rule context tests             | Checks mapped identity reaches shift evaluation and unresolved statuses remain unresolved in stored rule results.                                                                               |
| `packages/attendance-engine/src/tests/cycle.test.ts`                     | Cycle regression tests         | Supplies persisted mapping context, checks employee/SAP identity on cycle, and rejects unresolved mappings.                                                                                     |
| `packages/attendance-engine/src/tests/reconciliation.test.ts`            | Reconciliation regression test | Checks mapping identity and mapping ID remain visible from immutable canonical fields via trace metadata.                                                                                       |
| `docs/P16_7_4_MAPPING_RESOLUTION_IMPLEMENTATION_REPORT.md`               | Required deliverable           | This report.                                                                                                                                                                                    |

No UI source was changed.

## 6. Pure Resolver Verification

`EmployeeMappingResolver.resolve()` reads the canonical event and matching employee mappings only. Source search for `attendanceEvent.update` and `attendanceEvent.updateMany` under the resolver/downstream implementation found no code matches. The only matches in the attendance-engine tree are negative assertions in resolver tests. Resolver tests confirm `attendanceEvent.update` is never called for mapped, unmapped, ambiguous, or historical resolution.

## 7. MappingResolution Contract

- **MAPPED:** includes `employeeId`, optional `sapEmployeeId`, and `mappingId` from the single active mapping. A missing SAP ID remains absent rather than being fabricated.
- **UNMAPPED:** includes a traceable reason and no employee/SAP/mapping identity.
- **AMBIGUOUS:** includes a traceable reason and no employee/SAP/mapping identity.

The resolver returns no new domain status. The manual resolve endpoint retains the established response fields (`status`, `canonical_event_id`, device identity, employee/SAP IDs, reason, and `resolved_at`) and adds `mapping_id`.

## 8. Processing Context Integration

`AttendanceProcessingContext` carries `attendanceEventId`, status, employee/SAP IDs, mapping ID, and reason. `AttendanceRuleEngine.evaluateEvent(eventId, context?)` verifies the context event ID. If no context is supplied, it calls the pure resolver. It writes the context into the existing `AttendanceRuleResult.input_data.mappingResolution` JSON alongside the existing rule inputs. For prior-event duplicate checks, it reads candidate events by timestamp and resolves each mapping read-only; it no longer filters by `AttendanceEvent.employee_id`.

## 9. Rule Engine Integration

For MAPPED, Rule Engine uses `employeeId` for shift resolution and preserves all resolution fields in the stored input JSON. For UNMAPPED, it persists `REVIEW_REQUIRED`; for AMBIGUOUS, it persists `AMBIGUOUS`. Both retain their resolution reason/context and are not promoted to MAPPED. Canonical event identity/status fields are not updated.

## 10. Downstream Identity Trace

- **MappingResolution → RuleResult:** JSON context contains employee ID, SAP ID, mapping ID, status, and reason where supplied.
- **RuleResult → Cycle:** Cycle extracts the context from each `CORE_TOLERANCE_V1` rule result, requires a mapped and consistent employee/SAP identity, then writes `employee_id` and `sap_employee_id` to the existing cycle columns. Each source event’s mapping ID remains on its linked rule result.
- **Cycle → SAP Batch:** Batch preparation continues to use `AttendanceCycle.sap_employee_id` for the batch record and existing SAP payload. No SAP payload contract changed.
- **RuleResult → Reconciliation:** Event trace uses resolution identity instead of relying on canonical event writes. The mapping ID/status/reason are included in `TraceEntity.metadata`, an optional field already present in the trace type. Existing `EmployeeTrace.mappingStatus` remains `MAPPED` or `REVIEW_REQUIRED`; the detailed rule trace metadata retains `AMBIGUOUS` distinctly.

The repository still has no production orchestration caller for Rule → Cycle → Batch. The component boundaries and data carrier are implemented and covered by unit tests; a live end-to-end processing trigger remains an application-level limitation for SA review.

## 11. Test Matrix

| ID          | Scenario                                     | Result                           | Evidence                                                                                               |
| ----------- | -------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| P16.7.4-001 | MAPPED resolution                            | PASS                             | Resolver test checks employee, SAP, and mapping IDs.                                                   |
| P16.7.4-002 | UNMAPPED resolution                          | PASS                             | Resolver test checks no identity and a reason.                                                         |
| P16.7.4-003 | AMBIGUOUS resolution                         | PASS                             | Resolver test checks no identity and a reason.                                                         |
| P16.7.4-004 | Resolver does not mutate event               | PASS                             | Negative `update` assertions for all resolution outcomes.                                              |
| P16.7.4-005 | Mapped identity reaches Rule Engine          | PASS                             | `rule-mapping-context.test.ts` asserts ShiftResolver receives `employeeId`.                            |
| P16.7.4-006 | `employeeId` preserved                       | PASS                             | Rule JSON and cycle persistence assertions.                                                            |
| P16.7.4-007 | `sapEmployeeId` preserved                    | PASS                             | Rule JSON, cycle persistence, existing batch SAP payload test.                                         |
| P16.7.4-008 | `mappingId` preserved where supported        | PASS                             | Rule JSON and Reconciliation trace metadata assertion.                                                 |
| P16.7.4-009 | UNMAPPED not forced to MAPPED                | PASS                             | Rule result remains `REVIEW_REQUIRED`; cycle refuses unresolved context.                               |
| P16.7.4-010 | AMBIGUOUS not forced to MAPPED               | PASS                             | Rule result remains `AMBIGUOUS`; cycle refuses unresolved context.                                     |
| P16.7.4-011 | AttendanceEvent remains unchanged            | PASS                             | Rule integration test starts with null event identity and verifies it remains null.                    |
| P16.7.4-012 | Cycle receives correct identity              | PASS                             | Cycle create assertion checks employee and SAP IDs from context.                                       |
| P16.7.4-013 | SAP Batch receives correct SAP ID            | PASS                             | Existing Batch Engine test asserts `sapEmployeeId` in the unchanged payload.                           |
| P16.7.4-014 | Reconciliation retains identity traceability | PASS                             | Reconciliation test checks employee/SAP IDs and mapping ID in metadata.                                |
| P16.7.4-015 | P7 `[valid_from, valid_to)` remains intact   | PASS                             | Resolver query uses `lte` lower bound and `gt` upper bound; no P7 code/schema changed.                 |
| P16.7.4-016 | Existing regression suite                    | PASS WITH ENVIRONMENT LIMITATION | 173 passed; 64 API tests fail before HTTP dispatch because loopback listener creation returns `EPERM`. |

Focused engine regression: **5 files passed, 68 tests passed** (mapping, Rule Engine context, Cycle, Batch, Reconciliation).

## 12. Regression

- `npm test -- --reporter=dot`: **173 passed, 64 failed (237 total; 19 files passed, 7 failed).** All 64 failures are in API suites and report `TypeError: Cannot read properties of null (reading 'address')` from Supertest `Test.serverAddress()` before route assertions.
- Environment evidence: a standalone Express `listen(0)` probe returned `address null` and `EPERM listen EPERM: operation not permitted 0.0.0.0`. The same socket restriction causes the Supertest setup failure; this run did not execute those API assertions. The 68 focused engine tests passed.
- `npm run build:all`: **PASS** after implementation and test changes.
- `npm run lint`: **PASS**.
- `npm run format:check`: **FAIL** on four existing unrelated files: `docs/evidence/P16_6_D/uat-observations.json`, `docs/P16_6_D_ATTENDANCE_OPERATIONS_UAT_REPORT.md`, `docs/P16_7_2_EMPLOYEE_MAPPING_RESOLVER_AUDIT.md`, and `docs/P16_7_3_MAPPING_RESOLUTION_DOWNSTREAM_DESIGN_AUDIT.md`. Changed source files and this report were formatted; unrelated files were left untouched.

## 13. Schema / Migration Impact

- **schema changed:** NO
- **migration created:** NO
- `AttendanceRuleResult.input_data` and existing cycle identity columns are reused.
- P7 temporal mapping and the existing exclusion constraint are unchanged.

## 14. Security / Immutability Review

The authenticated resolve endpoint retains `authenticate` and `Permissions.ATTENDANCE_PROCESS`. No RBAC change was made. The resolver and Rule Engine do not write attendance events. No database was changed, no attendance data was seeded or mutated, and no Employee Mapping mutation UAT was performed. No audit logs were deleted. No SAP payload contract changed.

## 15. Known Limitations

- API route tests cannot run in this environment because local TCP listener creation is prohibited (`EPERM`). Their assertions remain unverified in an environment with socket access.
- The workspace has no discovered production orchestrator that invokes Rule Engine → Cycle → Batch. No trigger or business-date grouping policy was invented. Component-level downstream context transfer is tested; live end-to-end processing is not.
- The global format check remains red due to the four unrelated existing documents listed above.

## 16. Final Status

**PASS WITH ENVIRONMENT LIMITATION** — pure resolution and component-level context transfer are implemented and focused tests pass. Full API regression is blocked by the demonstrated socket restriction; the current lack of a production orchestration caller is recorded for SA review. This is not a CLOSED decision.
