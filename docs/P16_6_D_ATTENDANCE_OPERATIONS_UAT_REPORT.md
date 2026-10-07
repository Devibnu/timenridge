# P16.6-D Attendance Operations UAT Report

## Scope and method

This phase performed runtime UAT only. It did not change frontend/backend source, Prisma schema or migrations, attendance data, or P17. The local API (`http://localhost:3000`) and frontend (`http://localhost:5173`) were used together. Browser attendance requests reached the real API; no attendance responses were intercepted, and no attendance data was seeded. A locally signed short-lived Bearer token for an existing active SUPER_ADMIN account was used; the password login form was not exercised. The token, account identity, and returned attendance values were not persisted in the evidence.

Screenshots are masked to obscure account details and table row values. Sanitized observations are in [`uat-observations.json`](evidence/P16_6_D/uat-observations.json); screenshots are in [`docs/evidence/P16_6_D/`](evidence/P16_6_D/).

## Live API to frontend

Each attendance page sent an authenticated request from the browser and rendered the real response. The database was **not empty**: each collection returned one row. All four responses had `success: true` and valid pagination metadata.

| Endpoint | HTTP | success | Rows | Pagination | Browser Bearer |
| --- | ---: | --- | ---: | --- | --- |
| `GET /api/attendance/raw` | 200 | true | 1 | page 1, pageSize 20, total 1, totalPages 1 | Present |
| `GET /api/attendance/events` | 200 | true | 1 | page 1, pageSize 20, total 1, totalPages 1 | Present |
| `GET /api/attendance/rule-results` | 200 | true | 1 | page 1, pageSize 20, total 1, totalPages 1 | Present |
| `GET /api/attendance/cycles` | 200 | true | 1 | page 1, pageSize 20, total 1, totalPages 1 | Present |

All pages requested page sizes 50 and 100 and received matching `meta.pageSize` values. They displayed “Page 1 of 1”; Previous and Next were disabled because there was only one result. Empty-state behavior and movement between multiple pages could not be verified against this database. Raw `raw_payload` and rule-result `input_data` were excluded from page responses/rendering checks. No create/edit/delete/approve/reject/retry/normalize/reprocess controls were present on any of the four pages.

## UAT matrix

**PASS** means observed as expected; **FAIL** means a reproducible defect; **NOT VERIFIABLE** means runtime data did not permit the check; **NOT EXECUTED** means the check was intentionally omitted to preserve the read-only database constraint or avoid disrupting the live runtime.

| Area / check | Result | Evidence and notes |
| --- | --- | --- |
| Authentication: unauthenticated attendance route | PASS | Browser redirected to `/login`; see `unauthenticated-login.png`. |
| Authentication: missing and invalid Bearer token | PASS | Both real API requests returned HTTP 401. |
| Authentication: valid Bearer token on all four attendance requests | PASS | Browser sent Authorization Bearer header; all returned HTTP 200. |
| Authentication: password login | NOT EXECUTED | Used a locally signed short-lived token for an existing active account; no password credentials were supplied. |
| Raw: route/API render and safe projection | PASS | HTTP 200, one row; raw payload excluded; see `raw.png`. |
| Raw: supported `deviceId`, `deviceEmployeeId`, `dateFrom` filters | PASS | Each parameter was sent and retained the matching row. |
| Raw: `dateTo` filter for the record’s calendar date | **FAIL** | Parameter was sent, but result was empty. The UI sends date-only value as midnight UTC and the API’s inclusive upper bound excludes a later timestamp on that date. |
| Raw: empty state | NOT VERIFIABLE | The live collection contained one row; no data was seeded or changed to force an empty set. |
| Raw: page sizes 20/50/100 | PASS | API metadata matched all selected sizes; see `pagination-page-size.png`. |
| Raw: previous/next page navigation | NOT VERIFIABLE | Only one result/page; both controls were disabled. |
| Events: route/API render | PASS | HTTP 200, one row; see `events.png`. |
| Events: `deviceId`, `deviceEmployeeId`, `employeeId`, `status`, `eventType`, `dateFrom` filters | PASS | Each supported filter was sent and retained the matching row. |
| Events: `dateTo` filter for the event’s calendar date | **FAIL** | Parameter was sent, but returned zero rows due to date-only upper-bound behavior described above. |
| Events: empty state and multi-page navigation | NOT VERIFIABLE | One live result; no database changes allowed. |
| Rule Results: route/API render and safe projection | PASS | HTTP 200, one row; `input_data` excluded; see `rule-results.png`. |
| Rule Results: `attendanceEventId`, `ruleCode`, `decision`, `dateFrom` filters | PASS | Each parameter was sent and retained the matching row. |
| Rule Results: `dateTo` filter for the result’s calendar date | **FAIL** | Parameter was sent, but returned zero rows due to date-only upper-bound behavior described above. |
| Rule Results: empty state and multi-page navigation | NOT VERIFIABLE | One live result; no database changes allowed. |
| Cycles: route/API render | PASS | HTTP 200, one row; see `cycles.png`. |
| Cycles: `employeeId`, `status`, `dateFrom`, `dateTo` filters | PASS | All four parameters were sent and retained the matching row. |
| Cycles: empty state and multi-page navigation | NOT VERIFIABLE | One live result; no database changes allowed. |
| Traceability: raw attendance to event | PASS | Device ID, device employee ID, and event timestamp linked the returned records. |
| Traceability: event to rule result and cycle | PASS | Rule result referenced the event; cycle check-in/out referenced the event. |
| Read-only UI | PASS | Zero mutation controls found on each attendance page. |
| API validation/error responses | PASS | Invalid query requests to all four live endpoints returned HTTP 400; missing/invalid auth returned 401. |
| Frontend error panel and retry interaction | NOT EXECUTED | A live UI error would require interrupting the API or modifying/intercepting requests. |
| Responsive layout, 1440 px | **FAIL** | No body-level horizontal overflow, but table content overflow was not contained within the table scroll region on any page. |
| Responsive layout, 768 px | **FAIL** | No body-level horizontal overflow; table overflow was contained for Events and Cycles, but not Raw or Rule Results. |
| Responsive layout, 375 px | PASS | All four pages contained table overflow; filters and pagination were present. |
| Dashboard regression | PASS | Dashboard rendered in the authenticated browser. |
| Devices regression | PARTIAL / PRE-EXISTING ISSUE | Devices page rendered and its UI was not changed; authenticated `GET /api/devices` returned HTTP 401. Existing API route wiring lacks `authenticate` before authorization (reported in prior P16.6-C.1 audit); no backend change was made. |
| Logout | NOT EXECUTED in this phase | Logout writes an authentication audit row, which would violate the no-database-change constraint. Prior P16.6-C.1 live verification exercised logout successfully and returned to `/login`. |

### Defects observed

1. **Date-to filters exclude records on the selected date** for Raw, Events, and Rule Results. The UI serializes the selected date as `T00:00:00.000Z`; the API applies it as the inclusive upper timestamp, so records later that day are excluded. Cycles did return its matching row for `dateTo` because its business date has day-level semantics. Evidence is summarized in `uat-observations.json` and the filter screenshot.
2. **Table horizontal overflow is not consistently contained** at 1440 px (all four pages) and 768 px (Raw and Rule Results). At 375 px, all four table regions contained overflow. Responsive screenshots are `responsive-1440.png`, `responsive-768.png`, and `responsive-375.png` (Raw page).
3. **Devices API authentication failure** remains a pre-existing backend issue: page renders, but authenticated `GET /api/devices` responds 401. Device UI and backend were out of scope and were not modified.

## Browser console

Observed failed resource requests were the intentional invalid-query checks (HTTP 400) and missing/invalid-auth checks (HTTP 401). Vue Router emitted the existing `[VUE_ROUTER_R0025]` callback-style navigation guard deprecation warning. No UI/API source was changed during this UAT.

## Git scope audit

`git status --short --untracked-files=all` was inspected. It lists the workspace as untracked, including the existing app, backend, package, Prisma, and report files. `git ls-files` reports **0 tracked files**, so this checkout has no Git baseline with which to distinguish pre-existing workspace files from newly added files. No files were staged or committed.

The files written for this P16.6-D UAT are exactly:

- `docs/P16_6_D_ATTENDANCE_OPERATIONS_UAT_REPORT.md`
- `docs/evidence/P16_6_D/uat-observations.json`
- `docs/evidence/P16_6_D/unauthenticated-login.png`
- `docs/evidence/P16_6_D/raw.png`
- `docs/evidence/P16_6_D/events.png`
- `docs/evidence/P16_6_D/rule-results.png`
- `docs/evidence/P16_6_D/cycles.png`
- `docs/evidence/P16_6_D/filter-applied.png`
- `docs/evidence/P16_6_D/pagination-page-size.png`
- `docs/evidence/P16_6_D/responsive-1440.png`
- `docs/evidence/P16_6_D/responsive-768.png`
- `docs/evidence/P16_6_D/responsive-375.png`

No application source files were changed in P16.6-D. No writes were made to `apps/api/`, `apps/worker/`, `apps/scheduler/`, `packages/`, Prisma schema or migrations, `packages/device-adapters/`, or P17 files. No attendance data was seeded or modified. The scope conclusion is limited by the zero-tracked-files repository baseline.

## Regression commands

No `npm test`, build, lint, or format-check commands were run in this verification-only UAT. No source files changed. The last recorded baseline in the P16.6-C report is `npm test`: 219 tests passed (24 files); `npm run build:all`, `npm run lint`, and `npm run format:check` passed. Those are prior-phase results, not rerun P16.6-D results.

## Stop point

P16.6-D verification is complete. This report records defects and unverifiable cases for SA review. No follow-on phase was started.
