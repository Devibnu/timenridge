# Laporan Investigasi Windows Build Failure (Fase 2.3)

## 1. Bukti Dependency Tree
Berdasarkan pengecekan konfigurasi `package.json` dan `package-lock.json`, hierarki dependensi menunjukkan adanya dua versi `better-sqlite3` yang berbeda dalam *monorepo* ini:
*   **`apps/desktop/package.json`**: Meminta versi `^11.1.2` dan terkunci di `11.10.0`.
*   **`packages/queue/package.json`**: Meminta versi `^12.11.1` dan terkunci di `12.11.1`.

Perbedaan versi ini memaksa `npm ci` untuk mengelola dua versi *native module* secara paralel. Ketika prebuilt binary untuk lingkungan Node 20.x pada Windows x64 gagal diunduh untuk salah satu atau kedua versi tersebut, `node-gyp rebuild` terpicu.

## 2. Analisis Opsi A & Opsi B
**Opsi A: Menambahkan environment variable `GYP_MSVS_VERSION: '2022'`**
*   **Kelebihan**: Aksi `ilammy/msvc-dev-cmd@v1` sudah menyiapkan jalur MSVC. Dengan menambahkan env `GYP_MSVS_VERSION: '2022'`, `node-gyp` secara eksplisit berhenti mencari Visual Studio via _vswhere_ dan langsung menggunakan kompiler yang ada. Ini tidak menyentuh kode aplikasi dan mempertahankan fungsionalitas murni paket `queue`.
*   **Kekurangan**: Proses instalasi CI memakan waktu ekstra karena kompilasi C++ *native* untuk dua modul yang berbeda.

**Opsi B: Menyelaraskan Versi `better-sqlite3` (Downgrade/Sinkronisasi)**
*   **Kelebihan**: Jika kita memaksa `@timebridge/queue` menggunakan versi yang sama persis dengan `desktop` (misal `11.10.0`), dependensi tergabung (deduplicated) menjadi satu. Bila rilis versi `11.x` itu memiliki *prebuilt binary* yang sukses, seluruh proses C++ terpotong.
*   **Kekurangan**: Kita tidak bisa mengasumsikan ketersediaan prebuilt di npm *registry* untuk versi 11.x vs 12.x di Node 20.x tanpa bukti. Lebih jauh lagi, melakukan *downgrade* versi di `packages/queue` berisiko memecahkan logika bisnis jika kode `queue` sudah bergantung pada pembaruan spesifik di versi 12.x.

## 3. Risiko Kompatibilitas Node.js dan Electron
*   **Node.js (Vitest)**: Membutuhkan `better-sqlite3` dikompilasi (atau prebuilt) dengan Node ABI v115.
*   **Electron**: Menggunakan `electron-builder` (`npmRebuild: true`), yang mana secara otomatis akan menjalankan *rebuild* terhadap modul *native* untuk dicocokkan dengan Electron ABI (bukan Node ABI) sebelum proses *packaging* NSIS.
Artinya, apapun versi `better-sqlite3`-nya, ia harus tahan dikompilasi dua kali (satu kali oleh `npm ci` untuk Node, satu kali oleh `electron-builder` untuk Electron). Opsi A menjamin kompilasi lintas ABI ini berjalan lancar di runner Windows.

## 4. Rekomendasi Final
**Rekomendasi Utama: OPSI A (Injeksi `GYP_MSVS_VERSION`).**
Alasan utama adalah keselamatan bisnis logika (*business logic safety*). Memanipulasi *lockfile* atau melakukan downgrade (Opsi B) berisiko mematahkan kompatibilitas di `queue` tanpa pengujian lokal. Opsi A secara pasti membereskan akar masalah penemuan Visual Studio di `node-gyp`, memastikan *build* sumber kode berhasil kapan pun *prebuilt binary* tidak tersedia.

## 5. Diff Workflow yang Direkomendasikan
Pembaruan yang akan dilakukan di `.github/workflows/windows-build.yml` hanya di blok `Install Dependencies`:

```yaml
      - name: Install Dependencies
        env:
          GYP_MSVS_VERSION: '2022'
        run: npm ci
```

## 6. Status Implementasi (Menunggu Validasi CI)
- **Keputusan**: Opsi A (Injeksi `GYP_MSVS_VERSION: '2022'`) telah diimplementasikan ke dalam `.github/workflows/windows-build.yml`.
- **Status Aktual**: Perubahan telah di-_stage_ secara lokal, tetapi belum di-commit dan _push_.
- **Validasi Akhir**: Perbaikan masalah Visual Studio *not found* pada tahap kompilasi `better-sqlite3` wajib dibuktikan dengan keberhasilan eksekusi _GitHub Actions_ secara nyata. Jangan klaim perbaikan selesai sebelum tanda "PASS" muncul di CI.
