This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment variables

Semua konfigurasi Supabase dan mode aplikasi dibaca dari `.env.local` (disalin dari `.env.example`), bukan di-hardcode ke kode:

```bash
# macOS / Linux
cp .env.example .env.local
# Windows PowerShell
Copy-Item .env.example .env.local
```

| Variabel | Dipakai | Keterangan |
|----------|---------|------------|
| `APP_MODE` | Server | `production` atau `demo`. Selain `"demo"` (termasuk kosong) dianggap production — banner demo tidak pernah bocor ke production. |
| `NEXT_PUBLIC_SUPABASE_URL` | Klien + server | Project Supabase yang berbeda per branch. Di-inline saat `next build`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Klien + server | Publishable key project Supabase (aman di bundle klien). |
| `DEMO_EMAIL` | Server | Email akun demo (hanya aktif saat `APP_MODE=demo`). |
| `DEMO_PASSWORD` | Server | Password akun demo (hanya aktif saat `APP_MODE=demo`). |

File `.env*` tidak ikut di-commit (kecuali `.env.example`, lihat `.gitignore`): itu sebabnya branch `main` dan `demo` bisa pakai kode 100% sama — hanya beda isi `.env.local` (URL Supabase yang berbeda + `APP_MODE`).

## Branch: `main` (production) vs `demo`

Branch `main` = production, branch `demo` = demo-mode. Perbedaan satu-satunya di antaranya adalah isi `.env.local` (koneksi Supabase yang berbeda + `APP_MODE=demo`), sehingga fitur baru yang di-merge `main → demo` tidak pernah merusak konfigurasi database masing-masing.

### Membuat branch `demo` dari `main`

```bash
# Di dalam folder firelle-pos
git checkout main && git pull origin main
git checkout -b demo

# Tambahkan mode demo ke .env.local (file ini tidak pernah di-commit).
# PowerShell:
#   Add-Content .env.local "APP_MODE=demo"
#   Add-Content .env.local "DEMO_EMAIL=demo@firelle.id"
#   Add-Content .env.local "DEMO_PASSWORD=demo123"
# Lalu ganti NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY ke project Supabase demo.

# Commit kode/konfigurasi yang memang dilacak git (.env.local otomatis diabaikan)
git add .
git commit -m "feat: demo branch from main"
git push -u origin demo
```

`DEMO_EMAIL`/`DEMO_PASSWORD` harus cocok dengan akun yang telah dibuat di project Supabase demo (Supabase Auth), bukan sekadar entri di `.env.local`.

### Sinkronisasi fitur dari `main` ke `demo`

Dikerjakan di branch `demo`:

```bash
git checkout demo && git merge main
```

Hati-hati: jika merge menyentuh `src/lib/env.ts`, `next.config.ts`, atau koneksi Supabase, pastikan tidak ada nilai konkret (URL/key) yang masuk ke kode. Konflik di `.env.local` tidak akan terjadi karena file itu diabaikan git — perbedaan koneksi tiap branch tetap aman. Jika `.env.example` berkonflik, pertahankan gabungan kedua sisi (nama variabel, bukan nilainya).

Di sisi deployment, set `APP_MODE=demo` (dan URL Supabase demo) di variabel lingkungan platform deploy, dan `APP_MODE=production` untuk branch `main`.

