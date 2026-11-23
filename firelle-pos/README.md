# Firelle POS

Aplikasi POS/ERP untuk Firelle, dibangun dengan Next.js (App Router) dan Supabase.

## Menjalankan lokal

```bash
cp .env.example .env.local        # macOS / Linux
Copy-Item .env.example .env.local # Windows PowerShell

npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Environment variables

Semua konfigurasi dibaca dari `.env.local` (disalin dari `.env.example`), bukan di-hardcode ke komponen. File `.env*` tidak ikut di-commit kecuali `.env.example` (lihat `.gitignore`).

| Variabel | Dipakai | Keterangan |
|----------|---------|------------|
| `APP_MODE` | Server | `demo` untuk mode demo, `production` (atau kosong/selain `demo`) untuk production. Nilai ini disuntikkan ke client lewat `AppModeProvider`, bukan diawali `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Klien + server | URL project Supabase produksi. Wajib di production; tidak dipakai di demo. Di-inline saat `next build`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Klien + server | Publishable key project produksi (aman di bundle klien). Tidak dipakai di demo. |

Tidak ada `DEMO_EMAIL` / `DEMO_PASSWORD`. Akun demo (`demo@firelle.com` / `demo12345`) hardcoded di `src/lib/demo/account.ts` dan hanya hidup di browser.

## Satu branch, dua mode

Cukup **satu branch (`main`)** dan **satu kode sumber** untuk production maupun demo. Pembedanya hanya environment variable `APP_MODE` di masing-masing project deploy:

| Project deploy | Branch | `APP_MODE` | Data & auth |
|----------------|--------|------------|-------------|
| `firelle-pos-production` | `main` | `production` | Supabase project produksi |
| `firelle-pos-demo` | `main` | `demo` | Hardcoded, in-memory di browser (tanpa Supabase) |

Keduanya di-import dari repo GitHub yang sama (`FirliSatriya/FIRELLE`) dengan Root Directory `firelle-pos` (`package.json` ada di folder ini, bukan di root repo). Push ke `main` men-deploy kedua project. Tidak ada branch `demo` lagi.

### Mode demo

- **Daftar barang demo hardcoded** sebagai array `PRODUCT_SEEDS` di `src/lib/demo/seed.ts`. Edit array itu untuk mengubah isi katalog demo; tidak ada seed SQL dan tidak ada koneksi Supabase.
- Tombol **Masuk sebagai demo** tersedia di halaman login; kredensialnya sudah hardcoded, tidak perlu env var.
- Semua data (produk, klien, transaksi, kas, pengaturan, galeri gambar) berada di memori browser dan **di-reset saat halaman di-reload**. Tidak ada yang ditulis ke Supabase, termasuk sesi login (tersimpan di `sessionStorage`).
- Fitur demo setara production: katalog & manajemen produk, klien, POS (checkout/void), laporan keuangan, pengaturan toko, dan galeri gambar produk (object URL lokal).
- Demo tidak membutuhkan Supabase yang bisa diakses; `NEXT_PUBLIC_SUPABASE_*` boleh dikosongkan.

Arsitektur: komponen memanggil facade di `src/lib/data/*`. Facade memilih implementasi `src/lib/supabase/*` saat production atau `src/lib/demo/*` saat demo, berdasarkan mode yang disuntikkan `AppModeProvider` dari `appMode()` (server). `APP_MODE` tidak pernah dikirim sebagai `NEXT_PUBLIC_*`.

### Deploy (contoh: Vercel)

1. Import repo **dua kali**, beri nama `firelle-pos-production` dan `firelle-pos-demo`.
2. Root Directory: `firelle-pos`. Framework Preset: Next.js (biarkan default).
3. Production Branch: `main` di kedua project.
4. Environment Variables — project **production**:
   ```env
   APP_MODE=production
   NEXT_PUBLIC_SUPABASE_URL=<url Supabase produksi>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<key Supabase produksi>
   ```
5. Environment Variables — project **demo**:
   ```env
   APP_MODE=demo
   ```
   (Supabase env boleh kosong.)
6. Deploy keduanya. Arahkan `pos.firelle.id` ke project production dan `demo.firelle.id` ke project demo.

> Platform selain Vercel: prinsipnya sama — dua app/project dengan satu branch yang sama, dua set environment variable, dua domain.

### Alur kerja sehari-hari

- Semua perubahan masuk ke `main`; kedua project ikut ter-deploy otomatis.
- Cek hasil: banner dan tombol "Masuk sebagai demo" hanya boleh muncul di deploy dengan `APP_MODE=demo`.
- Demo tidak memakai database: jangan pernah menjalankan seed demo ke project Supabase produksi.

## Supabase

Schema, migrasi, RLS, RPC, seed, dan tes database ada di [`supabase/README.md`](supabase/README.md). Seed SQL hanya dipakai untuk project **production**; data demo tidak lagi berasal dari SQL.
