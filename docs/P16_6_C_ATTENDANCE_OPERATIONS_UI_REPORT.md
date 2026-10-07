# P16.6-C Attendance Operations UI Report

## 1. Objective

Added a read-only Attendance Operations area to the Vue frontend using only the verified P16.6-B endpoints.

## 2. API Contract Used

The UI calls only `GET /api/attendance/raw`, `/events`, `/rule-results`, and `/cycles`. Success payloads are typed as `{ success, data, meta: { page, pageSize, total, totalPages } }`. API errors are reduced to safe human-readable messages.

## 3. Navigation

Added Attendance navigation links for Raw Attendance, Attendance Events, Rule Results, and Attendance Cycles, mapped to `/attendance/raw`, `/attendance/events`, `/attendance/rule-results`, and `/attendance/cycles`.

## 4. Raw Attendance UI

Displays the actual safe projection: event timestamp, device ID, device employee ID, source hash, and received timestamp. Raw payload is never rendered.

## 5. Attendance Events UI

Displays event UID, device name/code, device employee ID, employee name/internal ID or employee ID fallback, SAP employee ID, event timestamp, event type, status, and source.

## 6. Rule Results UI

Displays attendance event ID, rule code, decision, reason, and creation timestamp. `input_data` is not rendered.

## 7. Attendance Cycles UI

Displays employee name/internal ID, SAP employee ID, business date, shift ID, cycle sequence, check-in/check-out event IDs, status, and reason. IN/OUT values are not calculated.

## 8. Pagination

Requests send `page` and `pageSize` to the server. Default size is 20, choices are 20/50/100, and page changes fetch the next API page. The UI displays current page and total record count.

## 9. Filters

Controls use only supported parameter names:

- Raw: `deviceId`, `deviceEmployeeId`, `dateFrom`, `dateTo`.
- Events: `deviceId`, `deviceEmployeeId`, `employeeId`, `status`, `eventType`, `dateFrom`, `dateTo`.
- Rule results: `attendanceEventId`, `ruleCode`, `decision`, `dateFrom`, `dateTo`.
- Cycles: `employeeId`, `status`, `dateFrom`, `dateTo`.

Filters are sent to the backend; no client-side filtering or sorting is used.

## 10. Loading State

Each query clears stale rows and shows an accessible loading indicator until the current request completes.

## 11. Empty State

Empty result sets show “No attendance records found” with a prompt to adjust filters. No sample data is inserted.

## 12. Error State

Errors show a safe message and retry button. Stack traces and server internal details are not shown. 401 and 403 responses have user-facing session/permission messages.

## 13. Authentication

Attendance requests use the existing authenticated Axios client from `authStore`, preserving its bearer-token interceptor and `/api` base URL.

## 14. RBAC

The frontend does not invent permission metadata or claim to enforce security. Backend `attendance.read` remains authoritative; existing auth route guards remain in effect.

## 15. Read-Only Guarantee

Attendance pages contain no create, edit, approve, reject, retry, normalize, reprocess, or delete controls.

## 16. Responsive Behavior

Tables use a horizontally scrollable region with keyboard focus. Filters wrap on smaller screens, pagination stacks on narrow viewports, and the sidebar/layout design remains intact.

## 17. Device UI Regression

The live browser rendered Dashboard and the Devices page, and the real Logout flow returned to `/login`. The Devices page's real `GET /api/devices` call returned HTTP 401 despite a valid bearer token. Source inspection shows the existing devices route uses `authorize('devices.read')` without the `authenticate` middleware, leaving `req.user` unset. This is a pre-existing backend route issue; backend files were protected in this phase and were not changed. The device UI source was not changed.

## 18. Unit/Component Tests

No component-test framework is installed/configured. Browser-level Playwright coverage was added instead; no test assertions are skipped.

## 19. E2E Tests

`npx playwright test tests/p16_6_c_attendance.spec.ts --reporter=line`: passed, 9 tests. Coverage includes navigation, all four routes and endpoint requests, bearer token, loading, empty and safe error/retry states, filters, pagination, no mutation controls, Dashboard/Devices reachability, and logout. API responses are intercepted in the browser; no production attendance records are seeded.

The P16.6-C Playwright suite remains a deterministic mocked UI suite. Separate live verification below used the actual API and did not intercept attendance responses.

## 20. Build

`npm run build:all`: passed, including frontend typecheck and production bundle.

## 21. Lint

`npm run lint`: passed.

## 22. Format

`npm run format:check`: passed after formatting the added source, E2E, config, and report files.

## 23. Git Diff Audit

`git status --short` reports the repository files as untracked. `git ls-files` reports 0 tracked files, and `git status --short --untracked-files=all` reports 210 untracked files. Therefore Git has no tracked baseline from which to calculate a meaningful `git diff`; the top-level untracked entries include the application directories and project files that existed in the workspace. The exact P16.6-C implementation files and C.1 evidence files are:

- `frontend/src/router/index.ts`
- `frontend/src/layouts/AppLayout.vue`
- `frontend/src/stores/auth.ts`
- `frontend/src/services/attendance.ts`
- `frontend/src/views/attendance/AttendanceList.vue`
- `tests/p16_6_c_attendance.spec.ts`
- `playwright.config.ts`
- `docs/P16_6_C_ATTENDANCE_OPERATIONS_UI_REPORT.md`
- `docs/evidence/P16_6_C_1/live-verification.json`
- `docs/evidence/P16_6_C_1/unauthenticated-login.png`
- `docs/evidence/P16_6_C_1/raw.png`
- `docs/evidence/P16_6_C_1/events.png`
- `docs/evidence/P16_6_C_1/rule-results.png`
- `docs/evidence/P16_6_C_1/cycles.png`

The screenshots blur table row values to avoid retaining attendance/employee details. Verification did not add or stage files outside this list. No backend, worker, scheduler, package, Prisma, adapter, or P17 paths were written during P16.6-C.1.

## 24. Backend Protection

No `apps/api/`, `apps/worker/`, or `apps/scheduler/` files were changed. API contract and attendance backend tests remain unchanged. The live Devices 401 issue was reported without attempting a backend fix.

## 25. Database Protection

No Prisma schema or migrations were changed; no database reset, migration, schema push, or attendance seed was run. The live database was not empty: each attendance endpoint returned one record. The two successful Logout checks wrote their normal authentication audit entries; no attendance records were created or modified.

## 26. P17 Protection

No `packages/device-adapters/`, Fingerspot, or P17 report files were changed.

## 27. Known Limitations

- The existing auth store does not expose fine-grained permission data, so navigation visibility is not permission-filtered; the backend still enforces `attendance.read`.
- Rule-result dates filter result `created_at`; cycle dates filter `business_date`, matching the verified backend contract.
- Password-based login was not exercised because no login credentials were supplied. Browser verification used a five-minute JWT signed with the configured TimeBridge secret for the existing active SUPER_ADMIN account; the browser then fetched `/api/auth/me` from the real API. No token or user identifier is stored in evidence.
- Database data was present, so the live empty-state appearance was not exercised; the existing mocked Playwright suite covers the empty state.
- The Devices API returned 401 with bearer auth because its existing route lacks `authenticate`; this backend issue is outside P16.6-C.1 scope.
- The existing router emits a Vue Router deprecation warning for its callback-style guard; that pre-existing router behavior was outside this phase’s scope.

## 28. Live API → Frontend Verification (P16.6-C.1)

The real API and Vite frontend were run locally, with Vite served at `http://localhost:5173`, an origin permitted by the API's default CORS configuration. No attendance response interception was used and no attendance data was seeded.

| Endpoint                           | HTTP | `success` | `data.length` | Pagination                                 | Browser Bearer header |
| ---------------------------------- | ---: | --------- | ------------: | ------------------------------------------ | --------------------- |
| `GET /api/attendance/raw`          |  200 | true      |             1 | page 1, pageSize 20, total 1, totalPages 1 | present               |
| `GET /api/attendance/events`       |  200 | true      |             1 | page 1, pageSize 20, total 1, totalPages 1 | present               |
| `GET /api/attendance/rule-results` |  200 | true      |             1 | page 1, pageSize 20, total 1, totalPages 1 | present               |
| `GET /api/attendance/cycles`       |  200 | true      |             1 | page 1, pageSize 20, total 1, totalPages 1 | present               |

The real database had one row available in each result set, so empty-database behavior was not observed. All four browser routes rendered the actual API result. Their masked screenshots and the token-free response summary are in [`docs/evidence/P16_6_C_1/`](evidence/P16_6_C_1/).

Unauthenticated and invalid-bearer API requests returned HTTP 401. Opening an attendance route without a session redirected the browser to `/login`. The live authenticated browser flow fetched `/api/auth/me`, displayed Dashboard and Devices routes, and Logout returned HTTP 200 and redirected to `/login`. The password login form was not exercised; a short-lived token was signed locally for the existing active account and was not saved.

The browser's `GET /api/devices` returned 401 even with the bearer token. Inspection located the pre-existing missing-authentication middleware on the Devices backend route; it is documented as a scope-protected issue rather than changed here.

Regression on final source: `npm test` passed (219 tests, 24 files), `npm run build:all` passed, `npm run lint` passed, `npm run format:check` passed, and Playwright passed all 9 tests. Runtime verification used screenshots plus [`live-verification.json`](evidence/P16_6_C_1/live-verification.json).
