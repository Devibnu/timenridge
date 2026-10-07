# UI Capability Audit

## 1. Executive Summary

This READ-ONLY audit evaluates the current state of the TimeBridge frontend to determine which backend capabilities from phases P0-P16 have corresponding user interfaces.
**Finding:** The frontend is currently a minimal scaffold originating from Phase P2. While the backend has a rich, fully-featured integration pipeline, the frontend only has functional UI for Authentication (Login/Logout) and a basic Dashboard. Device Management components exist in the source code but are completely detached from the router, rendering them functionally inaccessible. All other backend modules currently lack any frontend representation.

## 2. Runtime Evidence

The frontend was manually verified at `http://localhost:5173`.

- **Verified workflows:** Login loads, authentication works for `test_valid@example.com`, Dashboard loads correctly, the user's role (`SUPER_ADMIN`) is displayed, and Logout functions properly.
- **Unverified:** No other pages or navigation menus are present.

## 3. Frontend Architecture

The frontend uses:

- Vue 3 (Composition API, `<script setup>`)
- Vite for building
- Vue Router for routing
- Pinia for state management (`stores/auth.ts`)
- Tailwind CSS via `style.css`
- Standard `fetch` API for HTTP requests (no external Axios client found).

## 4. Route Inventory

| Path     | Component       | Auth Required      | Role Required | API Dependency             | Status           |
| -------- | --------------- | ------------------ | ------------- | -------------------------- | ---------------- |
| `/login` | `Login.vue`     | No (requiresGuest) | None          | `/api/auth/login`          | RUNTIME VERIFIED |
| `/`      | `Dashboard.vue` | Yes                | None          | `/api/auth/me` (via store) | RUNTIME VERIFIED |

## 5. Navigation Inventory

There is currently **NO** sidebar, navbar menu, or dedicated dashboard navigation structure.
The only navigation element is a header on the Dashboard containing a "Logout" button.
`SUPER_ADMIN` currently cannot access any backend capabilities via the frontend menu because the menu does not exist.

## 6. Authentication UI

- **Backend capability exists:** Yes
- **Frontend page exists:** Yes (`Login.vue`)
- **API client exists:** Yes (`stores/auth.ts` uses `fetch`)
- **Status:** RUNTIME VERIFIED

## 7. RBAC UI

- **Backend capability exists:** Yes
- **Frontend integration exists:** Partially (Role is displayed on Dashboard, `canMutate` computed property exists in `DeviceList.vue` checking for `SUPER_ADMIN` or `INTEGRATION_ADMIN`).
- **Status:** PARTIAL

## 8. Device Management UI

- **Backend capability exists:** Yes
- **Frontend page exists:** Yes (`DeviceList.vue`, `DeviceForm.vue`, `DeviceDetail.vue`)
- **Frontend route exists:** **NO** (Not registered in `router/index.ts`)
- **API client exists:** Yes (Inline `fetch` inside the components)
- **Status:** SOURCE VERIFIED (but functionally inaccessible/detached)

## 9. Attendance UI

- **Backend capability exists:** Yes (Raw Attendance / Normalization)
- **Frontend page exists:** No
- **Status:** BACKEND ONLY

## 10. Employee Mapping UI

- **Backend capability exists:** Yes
- **Frontend page exists:** No
- **Status:** BACKEND ONLY

## 11. Shift & Rule UI

- **Backend capability exists:** Yes
- **Frontend page exists:** No
- **Status:** BACKEND ONLY

## 12. Attendance Cycle UI

- **Backend capability exists:** Yes
- **Frontend page exists:** No
- **Status:** BACKEND ONLY

## 13. SAP UI

- **Backend capability exists:** Yes (Batch, Transport, Ack)
- **Frontend page exists:** No
- **Status:** BACKEND ONLY

## 14. Reconciliation UI

- **Backend capability exists:** Yes
- **Frontend page exists:** No
- **Status:** BACKEND ONLY

## 15. Operational Monitoring UI

- **Backend capability exists:** Yes (Queue Monitoring, Redis Health, Worker Status)
- **Frontend page exists:** No
- **Status:** BACKEND ONLY

## 16. API Integration Audit

- **`stores/auth.ts`**: Uses `fetch` to call `POST /api/auth/login` and `GET /api/auth/me`. Handles token storage (localStorage) and state.
- **`DeviceList.vue`**: Uses `fetch` to call `GET /api/devices`. Passes Bearer token.
- **`DeviceDetail.vue`**: Uses `fetch` to call `GET /api/devices/:id`. Passes Bearer token.
- **`DeviceForm.vue`**: Uses `fetch` to call `POST /api/devices` or `PUT /api/devices/:id`. Passes Bearer token.

## 17. Frontend → Backend Capability Matrix

| Capability               | Backend | Frontend | Route | API Integration | Runtime          |
| ------------------------ | ------- | -------- | ----- | --------------- | ---------------- |
| Authentication           | YES     | YES      | YES   | YES             | RUNTIME VERIFIED |
| User / RBAC              | YES     | PARTIAL  | N/A   | PARTIAL         | PARTIAL          |
| Device Management        | YES     | YES      | NO    | YES             | SOURCE VERIFIED  |
| Device Connection Test   | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Raw Attendance           | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Attendance Normalization | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Employee Mapping         | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Shift Management         | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Attendance Rules         | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Attendance Cycle         | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| SAP Batch                | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| SAP Transport            | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| SAP Acknowledgement      | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Reconciliation           | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Operational Monitoring   | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Queue Monitoring         | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Redis Health             | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Worker Status            | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Audit / Security Logs    | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| System Health            | YES     | NO       | NO    | NO              | BACKEND ONLY     |
| Error/Failure visibility | YES     | NO       | NO    | NO              | BACKEND ONLY     |

## 18. UI/Backend Gaps

The frontend is missing almost all functionality. The backend has completed an entire P0-P16 lifecycle covering polling, queueing, normalizing, SAP generation, SFTP transport, and reconciliation, but absolutely none of this can be monitored or managed via the frontend UI. The immediate gap is the missing routing for the existing Device Management components and a complete lack of navigation/layout structure.

## 19. UI Foundation Findings

- **Responsive Behavior:** Basic Tailwind classes applied to Login and Dashboard.
- **Loading States:** Implemented properly in `DeviceList.vue` and `Login.vue`.
- **Error States:** Basic text error displays exist.
- **Form Validation:** Native HTML5 validation in Login and DeviceForm. No advanced validation library (e.g., VeeValidate) is used.
- **API Error Display:** Caught via `catch` block and rendered as simple text.
- **Logout / Refresh Persistence:** Token is persisted in `localStorage`. `router.beforeEach` properly re-fetches the user on page refresh (`authStore.fetchUser()`).
- **Reusable Components:** None.

## 20. Security/RBAC Findings

- `router.beforeEach` correctly prevents unauthenticated access to `/`.
- RBAC UI logic exists in `DeviceList` (`canMutate = SUPER_ADMIN || INTEGRATION_ADMIN`), but requires expansion for a full menu-driven application.
- API requests correctly append the Bearer token.

## 21. Test Results

- `npm test`: **PASS** (205 tests passed)
- `npm run build:all`: **PASS** (Frontend Vite build successful)
- `npm run lint`: **PASS** (No ESLint errors)

## 22. Files Inspected

- `frontend/src/router/index.ts`
- `frontend/src/views/Dashboard.vue`
- `frontend/src/views/Login.vue`
- `frontend/src/views/devices/DeviceList.vue`
- `frontend/src/views/devices/DeviceForm.vue`
- `frontend/src/views/devices/DeviceDetail.vue`
- `frontend/src/stores/auth.ts`
- `frontend/src/App.vue`
- `frontend/src/main.ts`

## 23. Files Changed

- `docs/UI_CAPABILITY_AUDIT.md` (This file).
- No production source files were changed.

## 24. Recommendations for SA

- Fix existing Device Management component routing.
- Create a global Navigation/Layout shell (Sidebar/Header).
- Implement Employee Mapping UI.
- Implement Operational Monitoring UI (Queues, Redis, Workers).
- Implement Reconciliation & SAP Batch visibility UI.

## 25. Explicit Scope Boundary

This was an audit only. No new pages, routes, or API integrations were created or modified. All validations were non-destructive.
