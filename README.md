# ExamTrack

A local-first VCE practice exam tracker built with React, Vite, shadcn/ui, Recharts, and KaTeX.

## Development

```bash
bun install
$env:LWC_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
bun run dev
```

## Supabase

1. Create a Supabase project and run `supabase/migrations/20260712064624_initial.sql`.
2. Copy `.env.example` to `.env.local` and add the project URL and publishable key from the Connect dialog.
3. In Authentication → Providers → Email, disable **Confirm email** for password-only signup without callbacks.

Attempts and mistakes stay available in local storage and sync after email/password sign-in. Never put a secret or service-role key in the Vite environment variables.

Student data stays in browser storage. Use the app menu to export or import a validated JSON backup.
Mistake photos sent to ChatGPT pass through the local server and are not saved by ExamTrack.

For a production build, set a stable `LWC_SECRET`, then run `bun run build` followed by `bun run start`. The default in-memory ChatGPT session store logs users out when the server restarts; configure the SDK's shared `sessionStore` for multi-instance or durable deployments.

## Vercel

Import the GitHub repository into Vercel, add a stable `LWC_SECRET`, and connect an Upstash Redis database from the Vercel Marketplace. ExamTrack accepts either `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or Vercel's `KV_REST_API_URL` + writable `KV_REST_API_TOKEN`; Vercel deployments fail fast without durable session storage. Redeploy after adding the variables.

## Checks

```bash
bun test
bun run lint
bun run build
```

## VCAA reference data

`public/vcaa-grade-distributions.json` contains official 2021–2025 examination grade distributions. Regenerate it from the VCAA pages with:

```bash
bun run vcaa:import
```

The importer uses PDF.js and does not require Poppler or `pdftotext`.
