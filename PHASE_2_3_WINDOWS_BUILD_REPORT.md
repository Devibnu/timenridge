# Laporan Build Windows (Fase 2.3 - Langkah 42 - Fix MSVC Toolchain)

## 1. Status Workflow
**Status Saat Ini:** Menunggu Eksekusi Ulang (Pending Push).
Workflow sempat gagal pada tahap *Install Dependencies* karena `node-gyp rebuild` tidak dapat menemukan lingkungan instalasi Visual Studio, menghasilkan *Error: Could not find any Visual Studio installation to use.*

## 2. Root Cause Aktual
* `prebuild-install` gagal menemukan *binary* praprakit yang sesuai untuk `better-sqlite3` di platform `win32-x64` dengan Node.js 20.20.2. Ini memaksa kompilasi balik dari *source code*.
* Saat melakukan _rebuild_, modul `node-gyp` tidak dapat secara cerdas mendeteksi *Visual Studio Build Tools* yang sebetulnya sudah ada di dalam sistem operasi *runner* `windows-latest`. Hal ini sering terjadi bila konfigurasi variabel lingkungan untuk C++ dan Windows SDK belum diaktifkan atau _registry_ lokal tidak terpetakan dengan benar.

## 3. Strategi Perbaikan Terpilih
Strategi yang digunakan adalah **Menyiapkan Visual Studio C++ Build Tools pada runner dengan cara memanggil _Developer Command Prompt environment_**.
1. **Menggunakan `ilammy/msvc-dev-cmd@v1`**: Aksi resmi ini bertugas mengaktifkan (*load*) skrip `vcvarsall.bat` milik Visual Studio yang sudah ada di mesin `windows-latest`. Langkah ini secara otomatis mengonfigurasi `PATH`, `INCLUDE`, dan `LIB` agar `node-gyp` langsung menemukan *compiler* C++ (`cl.exe`) tanpa harus mengandalkan skrip pendeteksi versinya yang rapuh.
2. **Tanpa Instalasi Tambahan**: Sesuai prinsip kehati-hatian, perbaikan ini tidak membuang waktu dengan mengunduh Visual Studio karena alat kompilasinya sebenarnya sudah tersedia dan hanya butuh diekspos melalui variabel lingkungan (env vars).
3. **Mempertahankan Python**: Aksi `setup-python@v5` dipertahankan karena Python mutlak dibutuhkan oleh `node-gyp`.

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
