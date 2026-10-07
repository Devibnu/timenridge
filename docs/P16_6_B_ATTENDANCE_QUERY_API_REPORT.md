# P16.6-B Attendance Query API Report

## 1. Objective

Expose existing attendance processing records through authenticated, paginated, read-only HTTP APIs. This implementation adds no attendance processing behavior, schema changes, or frontend changes.

## 2. Existing Domain Model Audit

The Prisma schema defines `AttendanceRawEvent`, `AttendanceEvent`, `AttendanceRuleResult`, and `AttendanceCycle` in `packages/database/prisma/schema.prisma`.

- `AttendanceRawEvent`: device and device employee identifiers, event timestamp, raw JSON payload, source hash, received and created timestamps. The raw payload is excluded from API output.
- `AttendanceEvent`: event UID, device and employee identifiers, SAP employee identifier, event date/time/timestamp, event type, source, status, and timestamps. Relations exist to `Device`, optional `Employee`, and rule results.
- `AttendanceRuleResult`: parent event ID, rule code, JSON input, decision, reason, and creation timestamp. JSON input is excluded.
- `AttendanceCycle`: employee and SAP employee identifiers, business date, shift and event references, sequence, status, reason, and timestamps. It relates to `Employee` and batch records.

None of these models has a tenant or organization identifier. The API therefore applies the existing global RBAC boundary; organization scoping cannot be added from the current schema.

## 3. Existing Service/Repository Audit

Attendance normalization and cycle engines remain the authoritative writers. `ReconciliationService` supplies reconciliation/operations reads for traces, summaries, batches, and orphans; it does not supply paginated list reads for these four models. The new endpoints query the existing Prisma models directly and do not duplicate processing logic.

## 4. Endpoint Design

All endpoints are GET-only and mounted at `/api/attendance`. They use bounded Prisma `skip`/`take`, a count query, explicit `select` projections, and deterministic order clauses. There is no arbitrary Prisma or SQL input.

## 5. Final Route Names

- `GET /api/attendance/raw`
- `GET /api/attendance/events`
- `GET /api/attendance/rule-results`
- `GET /api/attendance/cycles`

These match the conceptual routes and existing router convention.

## 6. Request Parameters

All routes accept `page` and `pageSize`. Other parameters are validated as strings and only applied to models that own the corresponding field:

- Raw: `deviceId`, `deviceEmployeeId`, `dateFrom`, `dateTo`.
- Events: `deviceId`, `deviceEmployeeId`, `employeeId`, `status`, `eventType`, `dateFrom`, `dateTo`.
- Rule results: `attendanceEventId`, `ruleCode`, `decision`, `dateFrom`, `dateTo` (dates target `created_at`).
- Cycles: `employeeId`, `status`, `dateFrom`, `dateTo` (dates target `business_date`).

Unknown parameters, empty filters, invalid ISO datetimes, invalid enum values, and reversed date ranges are rejected. `status` is validated against `EventStatus` for events and `CycleStatus` for cycles. `eventType` is validated against `EventType`.

## 7. Response Contracts

Successful responses use `{ "success": true, "data": [], "meta": { ... } }`. Query errors use `{ "success": false, "error": { "code": "...", "message": "...", "details": ... }, "meta": {} }`. Database failures return a generic message without database exception or stack details.

## 8. Pagination

Default `pageSize` is 20 and the maximum is 100. `page` must be a positive integer. `pageSize` must be positive; values above the maximum are capped at 100. Metadata includes `page`, effective `pageSize`, `total`, and `totalPages`.

## 9. Filtering

Filters map only to actual model fields listed above. Datetime filtering uses inclusive `gte`/`lte` bounds. No raw payload, JSON path, or arbitrary expression filtering is accepted.

## 10. Sorting

Caller-controlled sorting is not exposed. Each endpoint has a fixed descending primary timestamp/date sort and descending `id` tie-breaker for deterministic pagination.

## 11. Authentication

All routes reuse the existing `authenticate` bearer-token middleware.

## 12. RBAC

All routes require the existing `Permissions.ATTENDANCE_READ` permission. This permission is present in the current RBAC model and granted to the existing relevant roles; no permission was introduced.

## 13. Security

Projections are explicit. Arbitrary query keys are rejected, enum filters use generated enum values, and database errors do not expose exception messages or stack traces. No credentials or device credential relation is selected.

## 14. Sensitive Field Handling

`AttendanceRawEvent.raw_payload` is not returned because no approved safe projection exists in the domain. `AttendanceRuleResult.input_data` is also excluded. Operational identity fields and non-secret event metadata are selected explicitly.

## 15. Performance

Every collection query applies server-side count plus bounded `skip`/`take` and avoids loading the complete dataset. Related employee/device projections select only names and identifiers. No collection relations are expanded, and no N+1 lookups are introduced.

## 16. Tests

`apps/api/src/routes/attendance.test.ts` covers authentication/RBAC middleware behavior, the four paginated reads, date and enum validation, invalid pagination, maximum page-size cap, deterministic order, generic database errors, sensitive field omission, response metadata, and absence of mutation routes.

## 17. Regression and Verification Repair

### Root cause

The test files correctly pass Express application functions to Supertest. The installed `supertest@7.3.0` wraps those functions in `http.createServer` and starts an ephemeral listener. In the restricted execution sandbox, Node cannot bind the listener (`listen EPERM`); Supertest then observes `app.address() === null` while constructing the request and throws before sending HTTP. This was not an attendance route defect. Outside the sandbox, no test harness source correction is necessary.

The initial report called this a pre-existing harness failure without evidence. The successful repeat of the same full test command with local socket access shows the failure was an environment limitation affecting shared API tests, not an established pre-existing code regression.

### Results with local socket access

- `npm test`: passed; 24 test files, 219 tests.
- `npx vitest run apps/api/src/routes/attendance.test.ts`: passed; 1 file, 14 tests.
- `npm run build:all`: passed, including TypeScript and frontend production build.
- `npm run lint`: passed.
- `npm run format:check`: passed.

The attendance tests issue actual Supertest HTTP requests through the Express app and assert handler responses, pagination metadata, validation errors, RBAC outcomes, deterministic Prisma query order, and sensitive field exclusion. The DB is mocked at the Prisma boundary; HTTP routing and middleware are exercised.

### Failure classification

- A. P16.6-B implementation defect: none found during verification.
- B. Existing test infrastructure defect: none established; Supertest usage follows its supported Express-app API.
- C. Existing unrelated regression: none; full suite passes when the environment permits local sockets.
- D. Environment limitation: sandbox denied local socket binding, causing Supertest requests to fail before reaching handlers. Verification was rerun with local socket access and passed.

## 18. Files Changed

- `apps/api/src/routes/attendance.test.ts`
- `docs/P16_6_B_ATTENDANCE_QUERY_API_REPORT.md`

The attendance route implementation was not modified during this verification repair.

## 19. Frontend Protection

No file under `frontend/src/` was modified.

## 20. P17 Protection

No file under `packages/device-adapters/` was modified. Device adapter contracts, registry/factory, Fingerspot placeholder, and P17 reports remain untouched.

## 21. Known Limitations

- The schema has no organization/tenant field for per-organization scoping.
- Rule-result date filtering is based on the rule result's `created_at`, not its parent event timestamp.
- Sorting is fixed; clients cannot select alternate ordering.
- The complete raw device payload and rule input JSON are intentionally unavailable.
