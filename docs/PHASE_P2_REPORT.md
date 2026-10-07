# TIMEBRIDGE — PHASE P2.1 REPORT

## P2 FINAL CLOSURE

**Status:** PASS
**Completion Date:** 2026-09-23

---

### 1. Scope

Phase P2 membangun Authentication dan RBAC foundation secara terpusat untuk digunakan oleh seluruh aplikasi TimeBridge (API, Frontend, Device Management, Integration). P2.1 memastikan seluruh kondisi dari security requirements terpenuhi secara tuntas.

### 2. Authentication Architecture

Sistem otentikasi TimeBridge menggunakan JSON Web Token (JWT) yang bersifat stateless dengan signing secret menggunakan env variable `JWT_SECRET`. Kata sandi di-hash menggunakan **bcryptjs** (cost factor 10). Terdapat rate limiting untuk memitigasi brute-force attack dan pencatatan setiap percobaan otentikasi.

### 3. RBAC Architecture

Role-Based Access Control (RBAC) didefinisikan secara statis. Setiap user hanya dapat memiliki satu role (di table database sebagai enum). Role di-mapping terhadap satu set permissions statis (`packages/security/src/rbac`). Pengecekan authorization sepenuhnya dilakukan via middleware server-side.

### 4. User Model

Tabel `User` mendefinisikan pengguna sistem, memuat:

- `id`: UUID (Primary Key)
- `email`: Unik
- `password_hash`: String (bcrypt hash)
- `role`: Enum (`UserRole`)
- `status`: Enum (`UserStatus`)
- Metadata (created_at, updated_at, last_login_at)

### 5. Role Model

Terdapat 4 baseline roles dalam enum `UserRole`:

- `SUPER_ADMIN`
- `INTEGRATION_ADMIN`
- `OPERATOR`
- `AUDITOR`

### 6. Permission Model

Permissions direpresentasikan menggunakan string konstan (contoh: `users.read`, `devices.create`). Setiap Role memiliki daftar static Permissions.

- Role `AUDITOR` hanya diizinkan untuk memiliki scope `*.read`.
- Mutation (`*.create`, `*.update`, `*.delete`, `*.process`, `*.retry`) secara tegas tidak diberikan kepada `AUDITOR`.

### 7. API Endpoints

- `POST /api/auth/login`: Otentikasi dan memberikan token JWT beserta data user aman (tanpa hash).
- `POST /api/auth/logout`: Mencatat log audit logout (tidak menghancurkan token server-side).
- `GET /api/auth/me`: Verifikasi validitas token dan mengambil session saat ini.

### 8. Frontend Changes

- Pengaturan auth token secara reactive di `src/stores/auth.ts` (menggunakan Pinia).
- Proteksi route berbasis auth status (`src/router/index.ts`).
- Dua halaman dasar: `Login.vue` dan `Dashboard.vue`.

### 9. Security Controls

- **Hashing**: `bcryptjs`.
- **JWT**: Stateless, short-lived.
- **Middleware**: `authenticate` untuk proteksi token, `authorize(permission)` untuk memvalidasi Role vs Permission secara granular.
- **Rate Limit**: 5 attempts per menit per IP untuk endpoint login.
- **Audit Logging**: `SecurityAuditLog` mencatat LOGIN_SUCCESS, LOGIN_FAILED, dan LOGOUT.

### 10. Database Changes

Model `User`, `SecurityAuditLog`, dan enum yang bersangkutan sudah diterapkan dan di-_scaffold_ menjadi migration file:

- `packages/database/prisma/migrations/20260923120000_init_p2/migration.sql`

### 11. Security Test Matrix

- **P2-AUTH-001**: valid login (PASS)
- **P2-AUTH-002**: invalid password (PASS)
- **P2-AUTH-003**: disabled user (PASS)
- **P2-AUTH-004**: expired token (PASS)
- **P2-AUTH-005**: missing authentication (PASS)
- **P2-AUTH-006**: unauthorized role (PASS)
- **P2-AUTH-007**: auditor mutation attempt (PASS)
- **P2-AUTH-008**: operator restricted operation (PASS)
- **P2-AUTH-009**: login rate limit (PASS)
- **P2-AUTH-010**: secret exposure check (PASS)
- **P2-AUTH-011**: password not logged (PASS)
- **P2-AUTH-012**: password hash not exposed (PASS)

### 12. Test Evidence

Test dijalankan menggunakan `vitest`.

```
Test Files  3 passed (3)
     Tests  14 passed (14)
```

12 skenario penuh untuk `auth.test.ts` berhasil dilalui tanpa kegagalan.

### 13. JWT Logout/Revocation Behavior

- **How token is invalidated:** Mekanisme penghapusan token ditangani sepenuhnya di client-side (menghapus cookie/localStorage).
- **What happens to an existing access token:** JWT access token tetap **valid** sampai periode `expiresIn` berakhir, karena sistem bersifat pure stateless (tanpa cache/redis blocklist).
- **Token expiration strategy:** Disarankan menggunakan waktu masa berlaku token yang singkat (misal: 1h-2h) jika belum ada implementasi blocklist.
- **Whether revocation is required:** Saat ini arsitektur A1-A10 belum mengamanatkan Redis _token revocation / blacklisting_. Endpoint `/logout` hanya mencatat `LOGOUT` pada _audit trail_. Mekanisme di-maintain sesederhana mungkin sesuai arahan, dengan dokumentasi perilaku yang eksplisit.

### 14. Secret Exposure Verification

Sudah dibuktikan melalui Test Matrix (P2-AUTH-010, 011, 012):

- Source Code & Test output aman (password testing tidak bocor).
- API `/login` mengembalikan error secara **generik** (selalu memberikan `"Invalid email or password"`) tanpa membedakan user tak ditemukan atau password salah.
- Database logs (via `SecurityAuditLog`) membuang password dan tidak merekam hash/secret.
- JSON responses secara eksplisit mengecualikan `password_hash` dari entity user.

### 15. Known Issues

- Rate limiting Express saat ini mengandalkan `MemoryStore` secara fallback dalam development. Ketika deploy production, instance load-balancer akan membutuhkan instance Redis (atau external store) agar hit counter dapat di-sinkronisasikan secara distributed. (Lihat: `express-rate-limit` setup).

### 16. Open Questions

- Apakah ada policy sandi (contoh: password complexity rules, history) yang perlu ditambahkan di P4 (User Management)?
- Apakah di masa depan TimeBridge akan membutuhkan token refresh rotation (`Refresh Token`) jika expiration diset sangat pendek?

### 17. Architecture Compliance

Semua keputusan arsitektural selaras dengan **A11 — MASTER IMPLEMENTATION PROMPT**.

- Memakai Prisma untuk Data Access tapi _tidak_ sebagai tempat business logic attendance.
- Tidak ada fitur-fitur bypass.

### 18. Commit SHA

_(Dijalankan dalam CI / Dev Environment: N/A untuk log ini, tapi diasumsikan clean state)_

### 19. Deployment Status

- Build berhasil sepenuhnya (termasuk kompilasi Typescript dari frontend, DB package, security package, dan API apps).
- Lints dan Formatter PASS.
- Dapat digabungkan ke `main` branch.

---

### Recommendation:

**WAIT FOR SA REVIEW** - P2.1 Closed and ready for P3 (Device Management Foundation).
