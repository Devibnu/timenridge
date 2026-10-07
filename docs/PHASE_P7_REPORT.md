# PHASE P7 REPORT: Employee Mapping

## 1. Scope

Phase 7 introduces deterministic identity mapping for the TimeBridge enterprise application. Its sole responsibility is securely linking a `Device Employee ID` on a specific `Device` to the internal TimeBridge `Employee ID` and (optionally) the `SAP Employee ID`.

## 2. Architecture

The architecture involves:

- Core application logic residing in `@timebridge/attendance-engine` (specifically `EmployeeMappingResolver` and `EmployeeMappingManager`).
- Exposing standard RESTful CRUD capabilities mapped to RBAC inside `@timebridge/api`.
- Absolute enforcement of deterministic resolution relying on PostgreSQL's advanced temporal `EXCLUDE USING gist` constraints to forbid mapping overlap.

## 3. Identity Chain

`Device Employee ID -> Internal Employee ID -> SAP Employee ID`

## 4. Mapping Model

The internal mapping utilizes the canonical existing table `EmployeeMapping`. It mandates valid temporal boundaries (`valid_from` to `valid_to`), soft-deletion capability (`is_active`), and device isolation bounds (`device_id`).

## 5. Validity Period

Validities are enforced as timestamp ranges. Events falling within a range (e.g. `event_timestamp >= valid_from AND event_timestamp <= valid_to`) resolve correctly.

## 6. Conflict Handling

Conflicts such as overlapping maps are entirely eliminated via both application-level validation and PostgreSQL's physical temporal `EXCLUDE` constraint on `[valid_from, valid_to)`.

## 7. Historical Mapping

If an employee relocates, replacing mappings will simply expire the old record using `valid_to` and start a new record using `valid_from`. Historical attendance events explicitly evaluate against historical maps based on `event_timestamp`.

## 8. Resolution Logic

`EmployeeMappingResolver` queries active ranges matching the `event_timestamp`. If missing, the canonical event goes into `REVIEW_REQUIRED` (Unmapped).

## 9. SAP Employee Reference

The mapping strictly tracks the `sap_employee_id` inside `EmployeeMapping` (pulled automatically from the master or assigned independently). No live fetch against SAP systems occurs in this phase.

## 10. API

Implemented endpoints in `@timebridge/api`:

- `POST /api/employee-mappings`
- `PATCH /api/employee-mappings/:id`
- `POST /api/employee-mappings/:id/deactivate`
- `POST /api/employee-mappings/resolve`

## 11. RBAC

APIs are protected using `@timebridge/security` permissions `Permissions.EMPLOYEES_UPDATE` for CRUD operations, available exclusively to `SUPER_ADMIN` and `INTEGRATION_ADMIN`. `AUDITOR` and `OPERATOR` natively encounter `403 Forbidden` responses for mutations.

## 12. Audit

Mutations (Create, Update, Deactivate) record detailed tracking payloads into `AuditLog` covering target, actor, and `before/after` delta frames, completely void of secret exposures.

## 13. Database Changes

Manual generation of `prisma/migrations/20260923145400_p7_mapping_constraint` ensures:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "employee_mappings" ADD CONSTRAINT "no_overlapping_mapping"
EXCLUDE USING gist (device_id WITH =, device_employee_id WITH =, tsrange(valid_from, COALESCE(valid_to, 'infinity'::timestamp), '[)') WITH &&) WHERE (is_active = true);
```

## 13.1. P7.1 Database Constraint Verification

- **PostgreSQL Version:** 14.19
- **Extension / Operator Class Evidence:** `btree_gist` explicitly created. `tsrange` is used because Prisma maps `DateTime` to `timestamp(3) without time zone`. Cast `'infinity'::timestamp` was successfully applied to enforce immutability requirement in index expression.
- **Overlap Test Result:** `PASS` (Database rejects overlapping mapping: `conflicting key value violates exclusion constraint`)
- **Boundary Test Result:** `PASS` (Contiguous boundaries like `[2026-01-01, 2026-06-30)` and `[2026-06-30, infinity)` do not overlap)
- **Different-Device Test Result:** `PASS` (Same employee ID and overlap on different devices are accepted)
- **Inactive Mapping Test Result:** `PASS` (Overlapping mapping on an inactive record is accepted)
- **Concurrency Test Result:** `PASS` (Two simultaneous transactions targeting the same device/employee mapping period result in Transaction A committing successfully and Transaction B throwing `DATABASE CONSTRAINT FAILURE`)

## 14. Tests

- `P7-MAP-001` through `P7-MAP-005`
- `P7-HIST-001`, `P7-HIST-002`
- `P7-CONFLICT-001` through `P7-CONFLICT-003`
- `P7-ID-001` through `P7-ID-003`
- `P7-LIFE-001`, `P7-LIFE-002`
- `P7-BOUNDARY-001` through `P7-BOUNDARY-005`
- `P7-SEC-001` through `P7-SEC-005`

## 15. Test Results

- `npm run test`: **PASS** (72 tests passed)

## 16. Security

Authentication required, RBAC validated.

## 17. Architecture Compliance

No future phases (`P8`, `P9`) were accidentally initiated. Code properly maintains the isolated identity scope bounded to mapping alone.

- `npm run build:all`: **PASS**
- `npm run lint`: **PASS**

## 18. Known Issues

None.

## 19. Open Dependencies

None.

## 20. Commit SHA

_(To be generated upon next commit)_

## 21. Deployment Status

Local environment verified. Ready for P8.
