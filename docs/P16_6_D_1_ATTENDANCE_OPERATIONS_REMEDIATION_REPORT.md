# P16.6-D.1 Remediation Report

## 1. Root cause: `dateTo`

The date inputs were serialized as UTC midnight for both bounds. Raw attendance, events, and rule results filter timestamp columns, while attendance dates use the `Asia/Jakarta` business-date convention. Treating the selected end date as UTC midnight excluded later timestamps on that Jakarta date.

## 2. Fix: `dateTo`

For Raw Attendance, Events, and Rule Results, date inputs now map to inclusive Jakarta-day boundaries: `dateFrom` becomes business-day start (`17:00:00.000Z` on the preceding UTC day), and `dateTo` becomes business-day end (`16:59:59.999Z` UTC). Multi-day filters use the same boundaries. Cycles keep their existing UTC-midnight business-date handling. The API contract, backend, authentication, RBAC, and attendance data were not changed.

Automated regression coverage checks same-day start/end boundaries, a multi-day interval, and invalid dates. See [`businessDate.test.ts`](../frontend/tests/businessDate.test.ts) and [`businessDate.ts`](../frontend/src/utils/businessDate.ts).

## 3. Root cause: table overflow

The table’s intrinsic width was allowed to shrink with its flex layout, causing column compression at narrower widths and inconsistent overflow behavior in the scroll region. The page/panel/scroll container did not explicitly opt out of flex min-content sizing.

## 4. Fix: responsive table

The attendance page, records panel, and scroll region now have constrained widths and `min-width: 0`; the table keeps its intrinsic column width and overflows inside the existing horizontal scroll region. This preserves the current panel and table styling. Live geometry checks confirmed the scroll region remains inside its panel and the document has no horizontal overflow.

## 5. Files changed

Application and test files:

- `frontend/src/views/attendance/AttendanceList.vue`
- `frontend/src/utils/businessDate.ts`
- `frontend/tests/businessDate.test.ts`

Report and UAT evidence:

- `docs/P16_6_D_1_ATTENDANCE_OPERATIONS_REMEDIATION_REPORT.md`
- `docs/evidence/P16_6_D_1/uat-observations.json`
- `docs/evidence/P16_6_D_1/unauthenticated-login.png`
- `docs/evidence/P16_6_D_1/raw.png`
- `docs/evidence/P16_6_D_1/raw-same-day.png`
- `docs/evidence/P16_6_D_1/events.png`
- `docs/evidence/P16_6_D_1/events-same-day.png`
- `docs/evidence/P16_6_D_1/rule-results.png`
- `docs/evidence/P16_6_D_1/rule-results-same-day.png`
- `docs/evidence/P16_6_D_1/cycles.png`
- `docs/evidence/P16_6_D_1/filter-applied.png`
- `docs/evidence/P16_6_D_1/pagination-page-size.png`
- `docs/evidence/P16_6_D_1/responsive-1440.png`
- `docs/evidence/P16_6_D_1/responsive-768.png`
- `docs/evidence/P16_6_D_1/responsive-375.png`

Screenshots blur account and row values. Observations contain only route status/counts, pagination metadata, filter results, viewport measurements, and auth outcomes.

## 6. Automated test results

| Check                                                                    | Result          |
| ------------------------------------------------------------------------ | --------------- |
| `npx vitest run --project frontend tests/businessDate.test.ts`           | PASS — 3 tests  |
| `npx playwright test tests/p16_6_c_attendance.spec.ts --reporter=line`   | PASS — 9 tests  |
| `npx vitest run --project @timebridge/api src/routes/attendance.test.ts` | PASS — 14 tests |
| `npm run --workspace=frontend build`                                     | PASS            |

The API test command first failed in the sandbox because Supertest’s ephemeral local listener had no address; rerunning with local-bind permission passed all 14 tests. ESLint is configured to ignore `frontend/`; the targeted ESLint invocation confirmed all three frontend files are ignored by that project configuration. Prettier check passed for the three source/test files. (The report was formatted after creation.)

## 7. UAT re-run results

The local API and frontend were run together against the existing database. No attendance rows were seeded, edited, or deleted. Browser requests were not intercepted. A short-lived local Bearer JWT for an existing active account was used; its value and returned attendance fields are not saved.

| Scenario                        | Raw                                     | Events                                  | Rule Results                            |
| ------------------------------- | --------------------------------------- | --------------------------------------- | --------------------------------------- |
| Same day (`dateFrom = dateTo`)  | HTTP 200, 1 row, actual record included | HTTP 200, 1 row, actual record included | HTTP 200, 1 row, actual record included |
| Multi-day (`dateFrom < dateTo`) | HTTP 200, 1 row, actual record included | HTTP 200, 1 row, actual record included | HTTP 200, 1 row, actual record included |

Viewport checks repeated at 768 px (previously affected), 1440 px desktop, and 375 px mobile for all four attendance pages. At each viewport, `bodyOverflow=false`, table remained within its records panel, and filters/pagination were present. At 768 and 375 px, horizontal table scrolling was available within the table region. Desktop pages that fit naturally did not require horizontal scrolling. Masked viewports and same-day page screenshots are in `docs/evidence/P16_6_D_1/`.

## 8. API regression results

Authenticated browser requests to all four existing endpoints returned HTTP 200 with `success: true`; each response included the existing pagination metadata and a Bearer header. One existing record was returned per collection. Missing and invalid tokens returned HTTP 401. No endpoint or response contract was changed.

## 9. Remaining findings

- The pre-existing Devices API authentication issue remains: the Devices page renders, but authenticated `GET /api/devices` returns HTTP 401. It was not changed in this remediation.
- Logout was not exercised in this UAT because it writes an authentication audit row; prior P16.6-C.1 live evidence recorded a successful logout.
- No database-empty or multi-page dataset was available; those conditions remain unverified.
- Existing Vue Router callback-style guard deprecation warnings remain.

## 10. Git diff/status

`git status --short --untracked-files=all`, `git diff`, and `git diff --cached` were reviewed. The checkout reports **0 tracked files** and the workspace is listed as untracked, so Git cannot provide a tracked baseline diff or distinguish pre-existing workspace files. The complete remediation file list is enumerated in section 5 and the source/test edits were inspected directly. Unrelated untracked workspace files were not modified, staged, or committed. No changes were made to backend, Prisma, database data, device adapters, or P17.

## 11. Final recommendation

**PASS WITH FINDINGS** — both P16.6-D frontend defects pass the requested automated and live re-UAT checks. The Devices API 401 remains an outstanding pre-existing issue outside this scope. This is a recommendation for SA review; it does not declare P16.6-D closed.

## Stop point

Remediation and re-UAT are complete. No subsequent phase was started. Stop here for SA review.
