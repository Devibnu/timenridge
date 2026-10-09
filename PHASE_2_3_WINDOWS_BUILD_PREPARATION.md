# Laporan Persiapan Build Windows (Fase 2.3 - Langkah 3)

## 1. Perubahan yang Diverifikasi
*   **`schema.prisma`**: Telah diverifikasi bahwa `binaryTargets = ["native", "windows"]` aktif. Query engine Prisma siap untuk distribusi macOS dan Windows.
*   **`apps/desktop/src/main.ts`**: Telah diverifikasi memiliki mekanisme _fail-safe_ path terhadap file `template.db` yang di-_bundle_ melalui `process.resourcesPath`. Security binding telah dikunci ke `127.0.0.1` dan seluruh endpoint API tidak dikenal akan dibalas dengan JSON `404 Not Found`. Database tidak akan di-reset (hanya dikopi bila _user database_ belum tersedia).
*   **`apps/desktop/package.json`**: Pengaturan `extraResources` yang menangani `template.db` telah diverifikasi. Selain itu, parameter `"icon": "build/icon.ico"` telah disematkan untuk paket Windows.

## 2. Hasil Pemeriksaan Native Dependencies
Native dependency di audit dan ditemukan:
*   **`better-sqlite3`**: Modul berbasis native C/C++ yang perlu menggunakan `node-gyp`. Membangun pustaka ini dari arsitektur macOS (darwin/arm64) ke format Windows (PE/x64) secara manual sangatlah rentan (*error-prone*).
*   **Prisma Client**: Membutuhkan `query-engine-windows.exe.node`. Karena `npx prisma generate` dijalankan di lingkungan host, target untuk environment Windows harus ditarik pada platform yang sama.
*   **Target Arsitektur**: Windows x64.
*   Oleh karena keterbatasan cross-compilation native Node.js di macOS, kompatibilitas tak akan dipaksakan dan ditransfer pembangunannya ke _isolated Windows environment_.

## 3. Status Ikon Windows
Telah berhasil dikonversi dan direalisasikan. Karena sistem operasi ini (macOS host) dibekali dengan paket ImageMagick (`magick`), file `icon.ico` valid dengan rentang resolusi adaptif (256x256, 128x128, 64x64, 48x48, 32x32, 16x16) telah dibuat langsung dari file sumber `apps/desktop/build/icon.png`. File ini sukses didaftarkan dan disimpan di `apps/desktop/build/icon.ico` (370 KB) tanpa menimpa `icon.icns` bawaan Mac.

## 4. Strategi Build yang Dipilih
Mengingat resiko _cross-compilation_ yang telah dijabarkan di atas, saya menetapkan _Cloud CI/CD Pipeline Strategy_ untuk mengeksekusi build secara terisolasi dan asinkronus menggunakan GitHub Actions.
*   Host yang digunakan adalah `windows-latest`.
*   Akan menjalankan *clean install* dependency dengan `npm ci`.
*   Ekstraksi Prima generate Windows binaries di host aslinya secara langsung.
*   Proses _packaging_ dilakukan memanggil NSIS via electron-builder (`desktop dist`).
*   Mengunggah file eksekusi akhir (`*.exe`) sebagai artefak terunduh.

## 5. File Workflow yang Dibuat
Sebuah berkas workflow CI telah ditambahkan ke basis kode di:
`.github/workflows/windows-build.yml`

File ini akan terpicu secara manual (`workflow_dispatch`) atau lewat _push_ pembaruan koding pada branch utama `main`.

## 6. Tes yang Benar-Benar Dijalankan
*   Validasi command utilitas `convert/magick`.
*   Pembuatan file `icon.ico` dan validasi ukuran serta integritas datanya via file-system check lokal.
*   Pemeriksaan parameter integrasi block `win` electron-builder di `package.json`.

## 7. Prasyarat yang Masih Tersisa
Seluruh prasyarat _codebase_ telah terpenuhi. Prasyarat akhir adalah memproses (`push`) *commit* dari perubahan terbaru ini ke branch utama repository online GitHub, lalu mengoperasikan dan mengawasi eksekusi dari _workflow_ yang baru saja didefinisikan agar artefak NSIS `.exe` terlahir secara sah.
