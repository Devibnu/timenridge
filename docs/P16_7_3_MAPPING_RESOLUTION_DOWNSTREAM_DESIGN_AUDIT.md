# P16.7.3 Mapping Resolution Downstream Design Audit

**Audit mode:** source and schema inspection only
**Implementation:** none
**Database or attendance records changed:** none
**Mutation UAT / tests:** not run
**Decision:** awaiting SA review

## 1. Executive Summary

The current `EmployeeMappingResolver.resolve(eventId)` returns a resolution value and also mutates `AttendanceEvent`. The only application call site found is the manual authenticated employee-mappings resolve API. Its frontend caller displays the returned status; it does not depend on or expose the database write.

No runtime call chain was found that invokes the resolver and then passes its result to `AttendanceRuleEngine`, `AttendanceCycleEngine`, or `AttendanceBatchEngine`. These engines are separate APIs in the package. Their code nevertheless reveals downstream identity dependencies: the rule engine reads `AttendanceEvent.employee_id`; the cycle engine receives `employeeId` as an argument and reads `sap_employee_id` from the event list; the batch engine takes both SAP ID and payload fields from the persisted cycle. Reconciliation gets event-level mapping identity from `AttendanceEvent` and cycle/batch status from those downstream records.

`AttendanceRuleResult.input_data` is an existing JSON field that can technically carry mapping details without a schema migration, but current consumers use only its `decision` and do not read identity from that JSON. It is therefore a possible carrier, not an existing end-to-end solution. The `AttendanceCycle` model already persists `employee_id` and `sap_employee_id` for subsequent batch preparation. SA needs to decide how identity and resolution evidence should cross these boundaries while keeping `AttendanceEvent` immutable.

## 2. Current Resolver Flow

`EmployeeMappingResolver.resolve(eventId)` reads one canonical event, queries active mappings against `(device_id, device_employee_id, event_timestamp)` with `[valid_from, valid_to)` semantics, and returns one of `MAPPED`, `UNMAPPED`, or `AMBIGUOUS` in the current branches ([resolver](../packages/attendance-engine/src/mapping/EmployeeMappingResolver.ts:19)). The interface also declares `INVALID`, but no branch returns it.

The only application caller found is `POST /api/employee-mappings/resolve`: it validates `canonical_event_id`, calls the resolver, and sends the returned value ([route](../apps/api/src/routes/employee-mappings.ts:228)). This route is protected by `authenticate` and `Permissions.ATTENDANCE_PROCESS`. The mapping page invokes the API and displays the result status ([frontend service](../frontend/src/services/employeeMappings.ts:100), [view](../frontend/src/views/mappings/EmployeeMappingList.vue:276)).

Repository search found no production caller chaining this route/resolver to the rule, cycle, or batch engines. Their methods have no callers in `apps/` or `packages/` beyond their own definitions and tests. Thus the end-to-end arrow sequence in the request is not currently implemented as a single in-repository runtime pipeline. The sections below distinguish code-level input/output dependencies from actual calls.

## 3. AttendanceEvent Mutation Path

The resolver writes in three branches ([resolver](../packages/attendance-engine/src/mapping/EmployeeMappingResolver.ts:53)):

| Resolution branch | `AttendanceEvent.update()` fields |
| --- | --- |
| No matching mapping (`UNMAPPED`) | `status = REVIEW_REQUIRED` |
| More than one match (`AMBIGUOUS`) | `status = REVIEW_REQUIRED` |
| One match (`MAPPED`) | `employee_id`, `sap_employee_id`, `status = MAPPED` |

The direct caller is the API route above. No caller code checks the updated row after the call. The resolver’s own method comment says it updates the event; P7 documentation also describes an unmapped canonical event going to `REVIEW_REQUIRED` ([P7 report](PHASE_P7_REPORT.md:37)). The existing resolver unit tests assert these writes ([mapping tests](../packages/attendance-engine/src/tests/mapping.test.ts:91)). These are evidence of current intended implementation behavior, but the API/UI caller itself only consumes the returned `ResolutionResult`.

Downstream code that currently reads the fields written by the mapped branch:

- `AttendanceRuleEngine.evaluateEvent()` reads `event.employee_id`, returns `UNMAPPED_EMPLOYEE` when it is null, uses it for shift resolution, and queries prior events by that employee ID ([rule engine](../packages/attendance-engine/src/rules/AttendanceRuleEngine.ts:21)). It does not read `sap_employee_id` and does not call `EmployeeMappingResolver`.
- `AttendanceCycleEngine.generateCycles(employeeId, businessDate, events)` takes internal employee identity as an explicit parameter. It takes SAP identity from `validEvents[0]?.sap_employee_id` ([cycle engine](../packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts:27)).
- `ReconciliationService.getEventTrace()` reads both `employee_id` and `sap_employee_id` from the canonical event to build its event mapping trace ([reconciliation](../packages/attendance-engine/src/reconciliation/ReconciliationService.ts:16)).

## 4. Rule Engine Dependency

- **Reads `employee_id` from `AttendanceEvent`?** Yes. A null value short-circuits to `REVIEW_REQUIRED / UNMAPPED_EMPLOYEE`; otherwise the ID is passed to `ShiftResolver` and used in the prior-event query ([rule engine](../packages/attendance-engine/src/rules/AttendanceRuleEngine.ts:21)).
- **Reads SAP employee ID?** No read of `event.sap_employee_id` was found in `AttendanceRuleEngine`.
- **Calls `EmployeeMappingResolver`?** No. It has no resolver import or call.
- **Expects resolver side effects?** There is no explicit resolver dependency or stated contract. In practice, because it reads `event.employee_id` and the resolver currently populates that field, a preceding resolver write would affect its behavior. No in-repository orchestration proving such ordering was found.
- **Can `MappingResolution` be passed directly?** Not with the current method signature: `evaluateEvent(eventId)` loads its own canonical event. Passing resolution would require a signature/input change or a separate context-aware method, and the prior-event lookup would still need a non-mutating way to identify other events for the same employee.
- **Can `AttendanceRuleResult` store identity today?** Its `input_data` field is required Prisma `Json` and `persistResult()` accepts arbitrary `inputData` and stores it. There are no typed `employee_id`, `sap_employee_id`, `mapping_id`, or mapping-status columns on the model ([schema](../packages/database/prisma/schema.prisma:187)). The rule engine’s current persisted `input_data` is for rule inputs such as shift/rule data; no mapping identity is added by current code. JSON could carry it without schema migration, but consumers would need explicit contract and parsing changes.

## 5. Attendance Cycle Dependency

There is no discovered application call site that invokes `generateCycles`; so no actual runtime source currently feeds it employee identity or events. Its method contract requires `employeeId`, `businessDate`, and event rows with `rule_results` ([cycle engine](../packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts:27)).

- **Employee ID:** caller-supplied `employeeId` argument; this value becomes the cycle’s `employee_id` in `upsertCycle()` ([cycle engine](../packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts:138)).
- **Business date:** caller-supplied `businessDate` argument, persisted on the cycle. The engine does not derive it from mapping or `AttendanceEvent.event_date` in the shown method.
- **Event identity:** event rows are sorted using `event_timestamp` and `event_uid`; paired event `id` values are stored as `check_in_event_id` / `check_out_event_id` ([cycle engine](../packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts:34), [cycle persistence](../packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts:138)).
- **Rule result dependency:** the engine uses `rule_results[].decision` for event pairing, falling back to `event_type`; it does not read `input_data` ([cycle engine](../packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts:46)).
- **SAP employee ID:** currently sourced from the first valid event’s `sap_employee_id`, then persisted onto the cycle ([cycle engine](../packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts:63)).

The cycle engine therefore depends on persisted SAP identity in its event input unless its contract changes. Internal employee identity arrives separately through its argument, so a possible upstream orchestrator may supply it without changing the event row, but no such caller was found. Schema already persists `employee_id` and `sap_employee_id` on `AttendanceCycle` ([schema](../packages/database/prisma/schema.prisma:165)).

## 6. SAP Batch Dependency

The implementation has no discovered caller chaining `AttendanceCycleEngine` to `AttendanceBatchEngine`. At the component boundary, however, `AttendanceBatchEngine.prepareBatch(cycles, batchIdentity)` accepts full cycle rows ([batch engine](../packages/attendance-engine/src/batch/AttendanceBatchEngine.ts:27)).

The current path is:

1. Cycle row contains `sap_employee_id` and `business_date`.
2. `SAPPreparationValidator` rejects a missing SAP ID or business date and requires a complete cycle with both event references ([validator](../packages/attendance-engine/src/batch/SAPPreparationValidator.ts:13)).
3. Batch preparation copies `cycle.sap_employee_id` to `AttendanceBatchRecord.sap_employee_id` and, for valid records, builds payload data from the cycle ([batch engine](../packages/attendance-engine/src/batch/AttendanceBatchEngine.ts:62)).
4. `transformToSAPCanonical()` places `cycle.sap_employee_id` under `sapEmployeeId`, along with cycle business date, check-in/out event IDs, and cycle ID ([batch engine](../packages/attendance-engine/src/batch/AttendanceBatchEngine.ts:132)).

Thus SAP identity in batch preparation depends on the identity already being available on the cycle. The inspected code prepares an internal canonical payload; this audit does not claim that a live SAP transport is invoked by this method.

## 7. Reconciliation Dependency

`ReconciliationService.getEventTrace()` obtains the canonical event by ID and includes employee and mapping relations in the database read. The mapping trace itself is populated from the canonical row’s `device_employee_id`, `employee_id`, and `sap_employee_id`; its `mappingStatus` is computed solely from whether `canonical.sap_employee_id` is truthy ([reconciliation](../packages/attendance-engine/src/reconciliation/ReconciliationService.ts:16)). Although employee mappings are included in the query, this method does not use those mapping rows to calculate the trace.

The same event trace separately follows event IDs into `AttendanceCycle`, then to `AttendanceBatchRecord` and `AttendanceBatch`, and uses those records for downstream statuses. It does not use `AttendanceRuleResult.input_data` to reconstruct mapping identity. Batch trace reads SAP ID from each batch record ([reconciliation](../packages/attendance-engine/src/reconciliation/ReconciliationService.ts:154)).

Therefore, current mapping identity evidence in **event trace** comes from `AttendanceEvent`; cycle/batch trace information comes from `AttendanceCycle` and `AttendanceBatchRecord`. Rule result JSON is not a current reconciliation source.

## 8. Existing Data Structures

| Structure | Existing relevant fields | Current use / limitation |
| --- | --- | --- |
| Resolver `ResolutionResult` (TypeScript) | `status`, `canonical_event_id`, `device_id`, `device_employee_id`, nullable `employee_id`, nullable `sap_employee_id`, optional `reason`, `resolved_at` | Already a non-persistent value carrying the core decision and identity. No `mapping_id` or validity period. It is returned by the API but is not passed to other engines. |
| `AttendanceRuleResult` | `attendance_event_id`, `rule_code`, `input_data: Json`, `decision`, `reason` | `input_data` can technically carry a JSON snapshot without schema change. Current cycle engine uses only `decision`; no downstream code reads mapping identity from `input_data`. |
| `AttendanceCycle` | `employee_id`, nullable `sap_employee_id`, `business_date`, check-in/out event IDs, status | Existing durable structure consumed by batch preparation. It stores cycle-level identity, not the per-event resolution status, reason, or mapping ID. |
| `AttendanceBatchRecord` | nullable `sap_employee_id`, JSON payload, status, reason, cycle ID | Existing batch preparation carries SAP ID and payload forward. It does not hold internal employee ID or mapping ID. |
| `EmployeeMapping` | mapping ID, identity IDs, validity bounds, active flag | Source lookup. Persisting a resolution as a separate historical fact is not a current model responsibility. |

The database model contains no `MappingResolution` model/table. The immutable canonical event model itself has nullable identity columns, but writing them is explicitly out of bounds for this design. The current cycle and batch structures can carry identity after cycle generation, but are not by themselves a per-event resolution handoff before rules run.

## 9. Option A — Pure Resolver → MappingResolution → Rule Engine Context

**Flow:** make the resolver return a pure resolution value; an orchestrator passes that value (or a typed context derived from it) to rule evaluation; a later cycle call receives employee identity and per-event identity context without reading mutated canonical fields. The existing `AttendanceRuleResult` can continue to persist rule outcome and may carry resolution facts in its JSON input if explicitly agreed.

- **Affected modules:** resolver/result type, rule engine interface and its prior-event lookup, pipeline/orchestration boundary (currently not found), cycle engine input/data sourcing, and likely reconciliation read model.
- **Immutability:** compatible if no downstream code writes canonical events and identity lookup for prior events is also redesigned to avoid reliance on `AttendanceEvent.employee_id`.
- **Migration:** none if only runtime context and existing `AttendanceRuleResult.input_data` / `AttendanceCycle` fields are used.
- **Backward compatibility:** existing `evaluateEvent(eventId)` and `generateCycles(employeeId, businessDate, events)` callers could be affected by signature changes. No production callers were found, but test and external package consumers still need inventory.
- **Reconciliation:** event mapping trace cannot continue deriving mapped identity from canonical identity columns; it would need to consume the approved resolution evidence/context or existing downstream cycle information. If per-event resolution must survive process restarts, a pure in-memory context alone is insufficient.
- **Testing:** unit tests for resolver no-write guarantee; rule-engine context and duplicate lookup; orchestration flow; cycle identity handoff; batch payload continuity; reconciliation mapping trace; and boundary/history behavior.

## 10. Option B — Pure Resolver → Existing AttendanceRuleResult Fields

**Flow:** make resolution pure, then place resolution status, employee ID, SAP ID, mapping ID, and reason into the existing `AttendanceRuleResult.input_data` JSON for that event. Downstream code would explicitly extract the approved shape. Cycle generation would need to read that value (currently it only reads `decision`) and still receive or derive the internal employee ID required by its method argument.

- **Affected modules:** resolver, rule engine persistence/input handling, the JSON contract and versioning, cycle engine extraction, reconciliation, and API/UI types only if the manual resolver response changes.
- **Immutability:** compatible; the writes would be to `AttendanceRuleResult`, not `AttendanceEvent`. The request only locks the canonical event; the data lifecycle/immutability policy for result rows still needs confirmation.
- **Migration:** none for a JSON payload change. Existing rows will lack mapping keys, so downstream behavior needs a defined legacy/missing-data fallback.
- **Backward compatibility:** the Prisma type remains `Json`, but application readers and reports may encounter old payload shapes. `input_data` is currently rule-engine input context, so adding mapping fields needs namespacing/versioning and must not overwrite existing rule inputs.
- **Reconciliation:** current event trace does not inspect result `input_data`; it would require a new read/parse path. Batch trace can continue using cycle and batch records after those are populated.
- **Testing:** all Option A flow tests plus JSON schema/version, old-row fallback, malformed/partial JSON, and reconciliation extraction tests.

This option uses an existing persistence slot, but current code does not yet make `AttendanceRuleResult` a mapping-resolution record.

## 11. Option C — Separate Mapping-Resolution Persistence

**Flow:** make resolution pure and persist a dedicated per-event resolution record containing status, identity, mapping ID, reason, and any approved trace metadata. Rule, cycle, batch, and reconciliation consumers query that record or receive it through an orchestrator.

- **Affected modules:** a new persistence model/repository and resolver service, Prisma/schema/migration, rule and cycle data flow, reconciliation, API behavior if exposed, and operational retention/audit policy.
- **Immutability:** compatible with canonical event immutability if the new record is kept separate and no hidden event writes occur.
- **Migration:** a new table/model requires a schema migration. A backfill or legacy-event strategy would be needed if existing events must appear resolved without rerunning resolution.
- **Backward compatibility:** additive table design can preserve old API behavior, but consumers need a missing-resolution fallback; retaining both canonical identity and resolution record would create divergent-source risk unless explicitly addressed.
- **Reconciliation:** can provide durable per-event mapping history and mapping ID, but reconciliation must use this record as an approved source and define how it relates to cycle/batch snapshots.
- **Testing:** migration constraints and referential behavior; idempotent resolution persistence; concurrency/replay; no-write assertions for `AttendanceEvent`; all rule/cycle/batch/reconciliation paths; and migration/backfill validation.

This is the only option here that creates a dedicated durable resolution fact, but it adds database scope and operational lifecycle decisions.

## 12. Comparison

| Dimension | Option A: runtime context | Option B: RuleResult JSON | Option C: separate persistence |
| --- | --- | --- | --- |
| Canonical-event immutability | Preserved if every consumer avoids writes | Preserved if only result JSON is written | Preserved if only separate record is written |
| Migration | No, if existing storage suffices | No | Yes, new schema object |
| Per-event durability | Only if another existing record stores it | Yes, on `AttendanceRuleResult` | Yes, dedicated resolution record |
| Existing consumer fit | Rule signature and cycle handoff need changes | JSON storage exists, but current consumers do not read mapping fields | Explicit new read/write integration required |
| Rule result coupling | Optional | Strong; mapping and rule outcome share one row | Separate concerns and records |
| Cycle/batch identity handoff | Needs explicit context; cycle can persist final IDs | Cycle must extract JSON or receive derived values | Cycle can read or receive persisted resolution |
| Reconciliation impact | Must gain context/source for event mapping trace | Must parse `input_data` | Must query the new resolution record |
| Main risk | In-memory context loss and unresolved prior-event lookup | Unversioned/legacy JSON and mixed rule-input semantics | Migration, backfill, lifecycle, and source-of-truth complexity |

## 13. Recommended Design Candidate

**Candidate for SA review only; no option is selected or approved by this audit:** examine Option A first as the resolver contract, because `ResolutionResult` already exists as a value and this avoids immediately introducing schema scope. This is viable only if SA also approves a complete downstream handoff: rule-engine access to identity without canonical writes, prior-event duplicate evaluation without `AttendanceEvent.employee_id`, cycle population from the same resolution context, and an immutable/readable source for reconciliation after the in-memory call ends.

If resolution must be durable and independently traceable per event across process restarts, Option A alone does not meet that requirement. Option B reuses `AttendanceRuleResult.input_data` but couples mapping facts to rule input and requires explicit versioning. Option C provides dedicated durability at the cost of a migration. SA should decide the durability and audit requirements before authorizing an implementation option.

## 14. Required Files for Implementation

Based on inspected dependencies, likely files/modules for a later approved implementation include:

- `packages/attendance-engine/src/mapping/EmployeeMappingResolver.ts`
- `packages/attendance-engine/src/rules/AttendanceRuleEngine.ts`
- `packages/attendance-engine/src/cycle/AttendanceCycleEngine.ts`
- `packages/attendance-engine/src/batch/AttendanceBatchEngine.ts` only if its input/payload contract changes; current batch code already reads identity from cycle rows
- `packages/attendance-engine/src/reconciliation/ReconciliationService.ts` and `packages/attendance-engine/src/reconciliation/types.ts`
- A pipeline/orchestration module, if SA identifies or authorizes one; no current resolver-to-engine orchestrator was found
- `packages/attendance-engine/src/tests/mapping.test.ts`, `rules.test.ts`, `cycle.test.ts`, `batch.test.ts`, and `reconciliation.test.ts`
- API route/service types only if the resolve response contract changes: `apps/api/src/routes/employee-mappings.ts`, its route tests, and `frontend/src/services/employeeMappings.ts`
- Option C only: `packages/database/prisma/schema.prisma` and a new Prisma migration, with explicit authorization

This is an impact inventory, not an implementation plan approval. No file above was changed in this audit.

## 15. Migration Requirement

Options A and B do not inherently require a schema migration if they use runtime values, `AttendanceRuleResult.input_data` JSON, and the existing `AttendanceCycle` identity fields. Option C requires a new Prisma model/table and migration. Any option that adds typed columns (for example `mapping_id` on an existing model) also requires a schema migration and is outside this audit’s authorization.

No schema, migration, validity behavior, or exclusion constraint change is proposed. The current mapping interval remains `[valid_from, valid_to)` and the no-overlap exclusion constraint remains untouched.

## 16. Testing Impact

No tests were run. After SA selects and authorizes a design, minimum regression coverage should include:

1. Resolver returns each applicable status and never invokes `AttendanceEvent.update`, `create`, or `delete`.
2. Exact `[valid_from, valid_to)` boundaries and the approved historical behavior remain unchanged.
3. Rule evaluation receives employee identity without reading a mutated event; duplicate/prior-event logic remains correct without querying by an unpopulated canonical `employee_id`.
4. Cycle generation receives the correct employee ID, business date, event IDs, rule decisions, and SAP ID, then stores the expected cycle snapshot.
5. Batch validation/payload continues using cycle SAP ID and required cycle fields.
6. Reconciliation reports approved mapping evidence without depending on mutated `AttendanceEvent` identity fields.
7. Legacy/no-resolution rule result handling and any API response compatibility behavior are tested.
8. Option C additionally tests migration application, referential integrity, idempotent resolution persistence, and any approved backfill policy.

## 17. Risks

- Removing the resolver’s write without replacing the identity handoff leaves `AttendanceRuleEngine` returning `UNMAPPED_EMPLOYEE` for normalized events whose employee ID is null.
- Rule-engine prior-event duplicate checks currently filter canonical events by `employee_id`, which is another hidden consequence of treating canonical identity as mutable.
- Cycle generation has no discovered production caller; current signatures alone do not establish the real business-date or event grouping orchestration.
- Current reconciliation’s event mapping status is based on canonical `sap_employee_id`, so immutable null fields would appear `REVIEW_REQUIRED` even if another context had resolved the mapping.
- RuleResult JSON is flexible but unversioned for mapping metadata and ignored by current cycle/reconciliation consumers.
- A separate resolution table adds schema and operational complexity, including backfill, idempotency, retention, and source-of-truth rules.
- SAP preparation will reject cycles without SAP employee ID; downstream identity continuity must be verified end to end.

## 18. SA Decision Required

1. Confirm canonical `AttendanceEvent` remains immutable for all fields, including status and identity.
2. Choose whether mapping resolution needs durable per-event persistence or can be carried in a runtime context and existing result data.
3. Decide how prior-event matching works when canonical employee IDs remain null.
4. Define who orchestrates resolver → rule engine → cycle engine; no such caller was found in this repository.
5. Decide the authoritative reconciliation source for mapping identity and status.
6. Select among Options A, B, or C (or provide another approved design) and authorize the exact modules/files and migration scope.
7. Confirm that `[valid_from, valid_to)` and the existing no-overlap exclusion constraint remain unchanged.

**Audit conclusion:** Current code does not implement a connected resolver-to-rule-to-cycle-to-batch pipeline. It exposes independent component methods with the dependencies documented above. `AttendanceEvent` mutation is the current bridge for some downstream reads, but there is no explicit orchestrator proving the resolver is expected to run before them. The audit proposes design candidates and consequences only; it does not select or implement an option. Awaiting SA review.
