# Laporan Build Windows (Fase 2.3 - Langkah 42 - Fix MSVC Toolchain)

## 1. Status Workflow
**Status Saat Ini:** Menunggu Eksekusi Ulang (Pending Push).
Workflow sempat gagal pada tahap *Install Dependencies* karena `node-gyp rebuild` tidak dapat menemukan lingkungan instalasi Visual Studio, menghasilkan *Error: Could not find any Visual Studio installation to use.*

## 2. Root Cause Aktual
* `prebuild-install` gagal menemukan *binary* praprakit yang sesuai untuk `better-sqlite3` di platform `win32-x64` dengan Node.js 20.20.2. Ini memaksa kompilasi balik dari *source code*.
* Analisis log lanjutan menemukan bahwa `node-gyp` sejatinya **sudah berhasil mendeteksi Visual Studio 2022** berkat lingkungan yang disiapkan oleh aksi `ilammy/msvc-dev-cmd`. 
* Namun, *crash* terjadi saat `node-gyp` mengeksekusi skrip tambahan PowerShell untuk memvalidasi kompiler tersebut. PowerShell menghasilkan teks/output (*stdout*) yang terlalu besar sehingga **menabrak limit ukuran buffer (1MB/200KB)** dari fungsi `child_process.execFile` milik `node-gyp` lawas.
* Pesan error-nya adalah: `Error [ERR_CHILD_PROCESS_STDIO_MAXBUFFER]: stdout maxBuffer length exceeded` yang kemudian diartikan keliru sebagai "Could not find Visual Studio" oleh pembungkus gagal-aman (fail-safe) npm.

## 3. Strategi Perbaikan Lanjutan
Strategi yang digunakan di iterasi ini adalah **Injeksi node-gyp lokal (devDependencies) dan MSVC Diagnostics**.
1. **Injeksi Langkah Diagnostik**: Menjalankan `where cl`, `cl`, dsb. sebelum kompilasi untuk membuktikan lewat log bahwa kompiler MSVC sudah terpanggil.
2. **Pembaruan node-gyp via `devDependencies`**: Menambahkan `node-gyp@12.4.0` ke dalam *devDependencies* dari *monorepo root*. Ini adalah jalan keluar yang aman karena npm secara otomatis meletakkan _binary_ `node-gyp` lokal tersebut di urutan teratas `PATH` (`node_modules/.bin`) saat mengeksekusi *install scripts*, sehingga modul `better-sqlite3` akan menggunakannya tanpa terpengaruh oleh *bundle* usang milik `npm`.

## 4. Pemeriksaan yang Dijalankan
* Mengonfirmasi bahwa paket `better-sqlite3` yang berada di ruang lingkup (*workspace*) tetap pada versinya saat ini dan mendukung proses kompilasi via `node-gyp` di Node.js 20.
* Validasi kelengkapan *workflow*: skrip Prisma, test, app build, dist, dan upload tidak mengalami pemangkasan atau bypass kompromis (`|| true`).
* macOS _development build_ dijamin tidak terimbas oleh modifikasi ini karena modul aksi ini hanya memengaruhi _runner_ Windows.

## 5. Risiko yang Tersisa
* Karena kompilasi ini adalah kompilasi lokal (_native build_) via GitHub Actions, akan ada peningkatan durasi waktu kompilasi untuk _step Install Dependencies_.

## 6. Uji Ulang (Langkah Anda Berikutnya)
Terapkan perbaikan *workflow* ini dengan *push* ke branch `feature/desktop-sqlite-schema`:
```bash
git add .github/workflows/windows-build.yml
git commit -m "ci: setup MSVC env for node-gyp native compilation"
git push origin feature/desktop-sqlite-schema
```
Pantau hasil akhirnya di antarmuka GitHub Actions untuk mengonfirmasi kelulusan tahap dependensi.
