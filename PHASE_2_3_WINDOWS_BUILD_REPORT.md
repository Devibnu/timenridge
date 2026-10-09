# Laporan Build Windows (Fase 2.3 - Langkah 23 - Fix Native Dependency)

## 1. Status Workflow
**Status Saat Ini:** Menunggu Eksekusi Ulang (Pending Push).
Workflow sempat dihentikan (gagal) pada tahap _Install Dependencies_ akibat anomali instalasi dependensi *native* C++ (`better-sqlite3`).

## 2. Root Cause
*   Kegagalan terjadi karena `prebuild-install` tidak dapat menemukan _binary_ praprakit (prebuilt) `better-sqlite3` yang sesuai untuk lingkungan `windows-latest` dengan Node.js 20.x, sehingga proses *fallback* ke kompilasi manual (melalui `node-gyp rebuild`) terpicu.
*   Namun, `node-gyp` terhenti (*exit code 1*) karena ia tidak dapat secara otomatis mendeteksi keberadaan *Visual Studio toolchain* di mesin *runner* dan berpotensi kehilangan lingkungan Python 3 untuk orkestrasi skrip gyp.

## 3. Strategi Perbaikan & Pembaruan
Alih-alih menambahkan instruksi instalasi Visual Studio (yang sangat berat dan membuang waktu CI), saya memanfaatkan *toolchain* (VS 2022) yang sebenarnya **sudah ter-install bawaan** di `windows-latest`:
1.  **Menambahkan `actions/setup-python@v5`**: Menyediakan runtime Python 3.11 secara eksplisit untuk menjamin _scripting engine_ `node-gyp` dapat berjalan.
2.  **Konfigurasi msvs_version**: Menyelipkan perintah `npm config set msvs_version 2022` tepat sebelum `npm ci`. Ini memaksa `node-gyp` merujuk ke instalasi VS 2022 yang telah eksis, memungkinkannya mengompilasi ulang _binary_ `better-sqlite3` untuk Node (serta nantinya untuk siklus `electron-builder` `npmRebuild`) secara lancar tanpa hambatan _missing build tools_.

## 4. Pemeriksaan yang Dijalankan
*   Pemeriksaan logika _workflow_ (ketersediaan *caching*, *Node version*, struktur urutan Prisma, Test, Build, Dist).
*   Validasi berkas package.json: Mengonfirmasi versi _better-sqlite3_ (`^11.1.2`) yang valid dan butuh dukungan _N-API_ kompilasi (menghindari pergantian *version lock* yang merusak macOS _local testing_).
*   Semua tes, kompilasi, atau instalasi lokal di macOS **tidak dijalankan ulang di sini** karena ini murni isu kompilasi OS Windows di perantara GitHub Actions (cross-platform tooling). _Business logic_ dan arsitektur database tidak disentuh.

## 5. Risiko yang Tersisa
*   Durasi *workflow* berpotensi meningkat beberapa detik/menit akibat keharusan kompilasi C++ _node-gyp rebuild_ di Windows.
*   Karena saya belum menguji langsung di server Windows yang sesungguhnya (tugas agen terbatas di macOS saat ini), *workflow* tetap membutuhkan verifikasi lapangan di GitHub Actions.

## 6. Uji Ulang (Langkah Anda Berikutnya)
Terapkan perbaikan *workflow* ini dengan *push* ke branch `feature/desktop-sqlite-schema` Anda:
```bash
git add .github/workflows/windows-build.yml
git commit -m "ci: fix node-gyp native dependency build by setting msvs_version and python"
git push origin feature/desktop-sqlite-schema
```
Lalu pantau tab *Actions* di repositori Github Anda untuk memvalidasi fase kompilasinya.
