# P16.7 DISCOVERY AUDIT REPORT

**Audit date:** 2026-09-29 (Asia/Jakarta)
**Scope:** Read-only discovery of the existing TimeBridge application. No implementation scope for P16.7 is selected in this report.

## A. Current Application Overview

TimeBridge is a Vue 3/Vite frontend and Express/TypeScript API backed by PostgreSQL through Prisma. Local UI: [http://localhost:5173/login](http://localhost:5173/login). API: `http://localhost:3000`. The local frontend and API are running and the login page is open in Chrome for SA inspection.

Live `GET /health` and `GET /ready` returned HTTP 200. An isolated, short-lived local Bearer token was used only to inspect authenticated read-only routes and pages. Password login was not submitted: the login endpoint writes login/audit state, and no credentials were supplied. All inspection requests were GET; no schema, source, or application data was changed.

The active local database has one device, employee, employee mapping, shift, shift rule, shift assignment, and one row each in raw attendance, attendance events, cycles, and rule results. IntegrationBatch/File/SAPResponse counts are zero; attendance export batch, record, acknowledgement, and outbox counts are one each. Full sanitized observations are in [`P16_7_DISCOVERY_AUDIT.json`](evidence/P16_7_DISCOVERY_AUDIT.json).

## B. Available Menus

| Menu                                     | UI location         | Current contents                                                                              |
| ---------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| Login                                    | Standalone `/login` | Email/password form.                                                                          |
| Dashboard                                | Sidebar             | Welcome text and role badge; no operational metric widgets.                                   |
| Attendance                               | Sidebar section     | Raw Attendance, Attendance Events, Rule Results, Attendance Cycles.                           |
| Devices                                  | Sidebar             | Device list; list actions link to detail/edit, and Add Device is role-gated in the component. |
| Employee Mapping                         | Not present         | No menu item or frontend route.                                                               |
| Operations / Monitoring / Reconciliation | Not present         | Backend APIs exist, but no frontend pages/menu.                                               |
| SAP / Integration                        | Not present         | No frontend SAP or export/reconciliation menu.                                                |

The currently rendered authenticated sidebar contained Dashboard, the four attendance links, and Devices. The standalone Login page is outside the sidebar. Menu construction is in `frontend/src/layouts/AppLayout.vue:10-83`.

## C. Frontend Routes

| Route                      | View                 | Purpose and available functions                                                            | API integration/status                                                                                                                             | Data and completeness                                                                                                                           |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                   | `Login.vue`          | Email/password login, loading and human-readable error.                                    | `POST /api/auth/login` via auth store; not submitted during this audit. `GET /api/auth/me` returned 200 with the existing short-lived audit token. | Real auth path in source; login submission not runtime-tested. Implemented, auth journey not fully exercised.                                   |
| `/`                        | `Dashboard.vue`      | Authenticated welcome text and user role.                                                  | Route guard calls `GET /api/auth/me` when profile is not loaded; returned 200. No dashboard metrics API.                                           | Profile/role real; dashboard content static. Partial/foundation page.                                                                           |
| `/devices`                 | `DeviceList.vue`     | Device table, add link, view/edit links; loading/error/empty states. No filter/pagination. | `GET /api/devices` returned 401.                                                                                                                   | Device exists in DB, but real device list cannot render because request fails. Partial/unavailable in current live path.                        |
| `/devices/new`             | `DeviceForm.vue`     | Device code/name/vendor/model/host/port/protocol/lifecycle/credential/active fields.       | `POST /api/devices`; form was inspected only and not submitted.                                                                                    | Form is present; mutation not exercised. Partial.                                                                                               |
| `/devices/:id`             | `DeviceDetail.vue`   | Device details, edit link, test connection action, last error/health.                      | `GET /api/devices/:id` returned 401. Test connection POST was not called.                                                                          | Page renders its API error state; detail unavailable. Partial.                                                                                  |
| `/devices/:id/edit`        | `DeviceForm.vue`     | Loads and edits device fields; blanks credential rather than displaying secret.            | `GET /api/devices/:id`, `PUT /api/devices/:id`; not submitted.                                                                                     | Implemented form path; dependent read API currently fails. Partial.                                                                             |
| `/attendance/raw`          | `AttendanceList.vue` | Read-only raw attendance view; device/date filters; page sizes 20/50/100.                  | `GET /api/attendance/raw` returned 200, one real row.                                                                                              | Real DB response; loading, empty, error, pagination and filtering present. Complete for current read-only scope; no live empty/multi-page data. |
| `/attendance/events`       | `AttendanceList.vue` | Canonical events view; device, employee, status, type and date filters; pagination.        | `GET /api/attendance/events` returned 200, one real row.                                                                                           | Real DB response; common loading/empty/error/pagination/filter behavior. Complete for current read-only scope.                                  |
| `/attendance/rule-results` | `AttendanceList.vue` | Rule outcome view; event, rule, decision and date filters; pagination.                     | `GET /api/attendance/rule-results` returned 200, one real row.                                                                                     | Real DB response. `input_data` is excluded from the UI projection. Complete for current read-only scope.                                        |
| `/attendance/cycles`       | `AttendanceList.vue` | Employee/business-date/status cycle view; pagination.                                      | `GET /api/attendance/cycles` returned 200, one real row.                                                                                           | Real DB response. Complete for current read-only scope.                                                                                         |
| `/employee-mappings`       | No view/route        | No mapping page or UI functions.                                                           | `GET /api/employee-mappings` returned 404; backend exposes mutation/resolve operations only.                                                       | Not implemented in frontend.                                                                                                                    |

The router table and auth guard are in `frontend/src/router/index.ts:11-94`. The Attendance view is shared through a `kind` prop and service mapping in `frontend/src/views/attendance/AttendanceList.vue` and `frontend/src/services/attendance.ts:84-100`. Attendance has accessible loading/empty/error states, supported API filters, server pagination, and no mutation controls. Its date range now uses the P16.6-D.1 Jakarta business-day boundary fix in this working copy.

## D. Backend APIs

All paths below are mounted by `apps/api/src/index.ts:41-107`.

| API group              | Routes/methods                                                                                                                                                    | Auth/RBAC                                                       | Live status / implementation                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health                 | `GET /health`, `GET /ready`, `GET /`                                                                                                                              | Public                                                          | `/health` 200; `/ready` 200 (database and Redis readiness probe succeeded).                                                                                                                                 |
| Auth                   | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`                                                                                               | Login rate-limited; logout/me Bearer authenticated              | `GET /me` 200. Password login and logout were not called to avoid audit writes.                                                                                                                             |
| Devices                | `GET /api/devices`, `GET /api/devices/:id`, `POST /api/devices`, `PUT /api/devices/:id`, `DELETE /api/devices/:id`, `POST /:id/test-connection`, `POST /:id/sync` | Route calls `authorize(...)` but omits `authenticate`           | List and detail GET returned 401 with a valid Bearer token. Create/update/delete/sync/test were not called. Device route definitions are in `apps/api/src/routes/devices.ts:71-365`.                        |
| Event normalization    | `POST /api/events/normalize`                                                                                                                                      | `authenticate` + `attendance.process`                           | Implemented but mutating; not called. `apps/api/src/routes/events.ts:12-37`.                                                                                                                                |
| Employee mappings      | `POST /api/employee-mappings`, `PATCH /:id`, `POST /:id/deactivate`, `POST /resolve`                                                                              | Authenticated; update or attendance-process permission          | Routes exist; GET/list route absent (GET base returned 404). No mapping mutation/resolve was called. `apps/api/src/routes/employee-mappings.ts:12-100`.                                                     |
| Attendance query       | `GET /api/attendance/raw`, `/events`, `/rule-results`, `/cycles`                                                                                                  | Bearer + `attendance.read`                                      | All 200 with `{success:true,data,meta}` and one real row per route. Queries are read-only. `apps/api/src/routes/attendance.ts:85-275`.                                                                      |
| Operations             | `GET /api/operations/health`, `/queues`, `/devices`, `/processing`, `/summary`                                                                                    | Health route public; other routes Bearer + `audit.read`         | All returned 200. `/queues` explicitly returns `NOT_CONFIGURED` in this phase. `apps/api/src/routes/operations.ts:14-177`.                                                                                  |
| Operational monitoring | `GET /api/operational/redis`, `/queues/metrics`, `/queues/failed`, `/workers`                                                                                     | Bearer; local allowlist AUDITOR, INTEGRATION_ADMIN, SUPER_ADMIN | All returned 200 in this runtime. `apps/api/src/routes/monitoring.ts:18-111`.                                                                                                                               |
| Reconciliation         | `GET /api/reconciliation/summary`, `/batches`, `/batches/:id`, `/events/:id`, `/orphans`                                                                          | Router-level Bearer + `audit.read`                              | Summary, batches, and orphans returned 200; batch query returned one row. Detail endpoints are implemented but require a known trace ID and were not opened. `apps/api/src/routes/reconciliation.ts:13-79`. |

### Authentication and RBAC

`authenticate` requires a Bearer JWT, verifies it, and assigns the user/role; missing/invalid tokens return 401 (`apps/api/src/middleware/authenticate.ts:13-39`). `authorize` checks the role permission map and returns 401 when no user is attached or 403 for insufficient permission (`apps/api/src/middleware/authorize.ts:14-29`). Roles are SUPER_ADMIN, INTEGRATION_ADMIN, OPERATOR, and AUDITOR; the permission matrix is in `packages/security/src/rbac/roles.ts:4-49`.

The attendance query routes consistently apply `authenticate` and `attendance.read`. Employee mapping routes apply authentication and their declared update/process permissions. Monitoring applies authentication and a role allowlist. The Devices router applies only `authorize`, causing the observed 401. Frontend route guards require a locally present authenticated user; the sidebar itself does not filter links by fine-grained permission.

## E. Database / Domain Areas

Prisma models are declared in `packages/database/prisma/schema.prisma`:

- Device connectivity/configuration: `Device`.
- Employee identity and mapping: `Employee`, `EmployeeMapping`.
- Shift policy: `Shift`, `ShiftRule`, `EmployeeShiftAssignment`.
- Attendance trace: `AttendanceRawEvent`, `AttendanceEvent`, `AttendanceRuleResult`, `AttendanceCycle`.
- SAP/integration: `IntegrationBatch`, `IntegrationFile`, `SapResponse`, `AttendanceBatch`, `AttendanceBatchRecord`, `AttendanceBatchAcknowledgement`, `OutboxEvent`.
- Security/operations: `User`, `SecurityAuditLog`, `AuditLog`, `ProcessingLog`.

Observed model counts (read-only Prisma `count()` calls): Device 1; Employee 1; EmployeeMapping 1; Shift 1; ShiftRule 1; EmployeeShiftAssignment 1; each AttendanceRawEvent/AttendanceEvent/AttendanceCycle/AttendanceRuleResult 1; IntegrationBatch/IntegrationFile/SapResponse 0; AttendanceBatch/AttendanceBatchRecord/AttendanceBatchAcknowledgement/OutboxEvent 1. The schema was not modified.

## F. User Journey

| Journey step     | Observation                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login            | Login UI and API integration exist. A password login was not attempted because it writes security audit and last-login state; no password was supplied.                        |
| Dashboard        | Authenticated route rendered; only welcome/role information, no operational KPI panel.                                                                                         |
| Devices          | Sidebar route is available, but device list GET fails 401. New Device form route renders; no mutation was submitted. Detail also renders an error because its GET returns 401. |
| Attendance       | Sidebar links open all four pages and real records load from their read-only APIs.                                                                                             |
| Employee Mapping | No UI route/menu; GET list endpoint does not exist. Existing backend operations cannot be reached through the frontend.                                                        |
| Other features   | Reconciliation, operations, and monitoring APIs respond but have no frontend route/menu. SAP presentation/export UI is absent.                                                 |

The inspected UI in the SA browser is at [http://localhost:5173/login](http://localhost:5173/login). It is deliberately left unauthenticated there so SA can inspect the login page or sign in using their own credentials. An isolated audit browser used a short-lived local token; it was closed and no token or account identifier was retained.

## G. Completed Features

- Bearer authentication middleware, login/logout/me handlers, and role-permission mapping are present.
- Dashboard route and sidebar navigation render.
- Four read-only Attendance pages are wired to real API queries and live data. Filters, pagination, loading/empty/error states are implemented; P16.6-D.1 date boundary remediation is present in this working tree.
- Device create/edit/detail/list and test/sync backend operations are represented in code, including credential sanitization/encryption paths.
- Backend read APIs for operational monitoring and reconciliation are implemented and returned successful read responses in the audit runtime.

“Completed” describes feature implementation at the stated scope; it does not imply every adjacent operation was exercised or that all dependent routes are healthy.

## H. Partial Features

- Devices: UI and CRUD API code exist, but read endpoints are unusable in the current runtime because `authenticate` is missing before `authorize`. The form and mutation routes were not executed.
- Employee mapping: data model and create/update/deactivate/resolve APIs exist, but no list/read endpoint or frontend UI exists.
- Dashboard: only a welcome/role foundation page; no live operational summaries.
- Operations queue summary: endpoint returns HTTP 200 but the queue state is explicitly `NOT_CONFIGURED`.
- SAP/export and reconciliation: data models and read/trace APIs exist, but no frontend workflow/presentation UI.
- Login: implementation exists; successful password login was not live-tested in this read-only audit.

## I. Missing Features

- Employee Mapping frontend route/menu, mapping list/search, and operator workflow.
- Frontend screens for shift, rule, and employee-shift assignment management; corresponding UI routes are absent.
- Frontend for reconciliation/batch/event trace, operational metrics, worker/queue monitoring, and SAP exchange results.
- Dashboard operational metric widgets.
- A frontend API surface for queue configuration/state beyond the placeholder response.

## J. Existing Findings

1. **Devices API returns 401 with valid Bearer token.** `apps/api/src/routes/devices.ts` calls `authorize` without `authenticate`; both list and detail GET routes are affected. Existing finding, not changed in this audit.
2. **No Employee Mapping read/list endpoint or frontend view.** Current mapping router only registers POST/PATCH operations.
3. **Dashboard is a static foundation page** and does not consume operational summary data.
4. **Queue status is not configured** in `/api/operations/queues` despite HTTP 200.
5. **Vue Router callback guard deprecation** remains visible in dev runtime (`next()` callback warning); router guard source is `frontend/src/router/index.ts:82-93`.
6. Live dataset is small (one row in each principal Attendance collection), so data-heavy pagination/empty states cannot be inferred from the live dataset.
7. The workspace has zero tracked Git files; Git reports the app as untracked and has no baseline diff to distinguish earlier workspace content.

## K. Candidate P16.7 Areas

These are discovery candidates only. No priority, scope, or implementation choice is made here.

| Candidate area for SA consideration                 | Evidence in existing application                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employee Mapping workflow                           | `EmployeeMapping` Prisma model; backend POST/PATCH/deactivate/resolve endpoints; no read endpoint, frontend route, or menu.                                                                                   |
| Device management/connectivity path                 | Device list/detail/form UI and CRUD/test/sync API exist, while read GETs currently 401; device-health and adapter models/fields are present.                                                                  |
| Operational dashboard/monitoring                    | `/api/operations/*` and `/api/operational/*` return live responses; Dashboard has no data widgets and no monitoring route exists.                                                                             |
| Attendance processing and traceability presentation | Event normalization POST, AttendanceCycle/RuleResult/AttendanceBatch models, and reconciliation summary/trace/orphan APIs exist; no corresponding frontend workflow.                                          |
| Shift/rule configuration                            | Shift, ShiftRule, EmployeeShiftAssignment models exist, with no frontend pages and no dedicated CRUD router found in the mounted API.                                                                         |
| SAP exchange and acknowledgements                   | IntegrationBatch/File/SapResponse and AttendanceBatch/Acknowledgement/Outbox models exist; reconciliation reads exist; no SAP-facing UI exists and current IntegrationBatch/File/SapResponse counts are zero. |

These areas need SA selection and requirements before any P16.7 scope is defined.

## L. Evidence

- Source route inventory: `frontend/src/router/index.ts:11-94`, `frontend/src/layouts/AppLayout.vue:10-83`.
- Frontend/API mapping: `frontend/src/views/attendance/AttendanceList.vue:121-417`, `frontend/src/services/attendance.ts:84-109`, `frontend/src/views/devices/DeviceList.vue:107-136`, `frontend/src/views/devices/DeviceDetail.vue:101-156`, `frontend/src/views/devices/DeviceForm.vue:149-232`, `frontend/src/views/Dashboard.vue:1-24`, `frontend/src/views/Login.vue:1-62`.
- API mounts and public health: `apps/api/src/index.ts:41-107`.
- Auth/RBAC: `apps/api/src/middleware/authenticate.ts:13-39`, `apps/api/src/middleware/authorize.ts:14-29`, `packages/security/src/rbac/roles.ts:4-49`.
- API route implementations: Attendance `apps/api/src/routes/attendance.ts:85-275`; Devices `apps/api/src/routes/devices.ts:71-365`; mapping `apps/api/src/routes/employee-mappings.ts:12-100`; normalization `apps/api/src/routes/events.ts:12-37`; operations `apps/api/src/routes/operations.ts:14-177`; monitoring `apps/api/src/routes/monitoring.ts:18-111`; reconciliation `apps/api/src/routes/reconciliation.ts:13-79`.
- Domain schema: `packages/database/prisma/schema.prisma:10-461`.
- Live UI/API status, menu, and sanitized table counts: [`docs/evidence/P16_7_DISCOVERY_AUDIT.json`](evidence/P16_7_DISCOVERY_AUDIT.json).
- Current browser: [http://localhost:5173/login](http://localhost:5173/login); API health endpoint: `http://localhost:3000/health`.

## M. Recommendation for SA Review

Use this report as a read-only snapshot of the current application. Decide whether and which candidate area should become P16.7, and provide the intended acceptance criteria. This audit does not select P16.7 scope and does not initiate implementation.

**STOP:** No source, database, or Prisma files were changed; no mutations were invoked; no commit or push was made. The local frontend and API remain running for inspection. Wait for SA decision.
