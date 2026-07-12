# ExamTrack

A local-first VCE practice exam tracker built with React, Vite, shadcn/ui, Recharts, and KaTeX.

## Development

```bash
bun install
$env:LWC_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
bun run dev
```

Student data stays in browser storage. Use the app menu to export or import a validated JSON backup.
Mistake photos sent to ChatGPT pass through the local server and are not saved by ExamTrack.

For a production build, set a stable `LWC_SECRET`, then run `bun run build` followed by `bun run start`. The default in-memory ChatGPT session store logs users out when the server restarts; configure the SDK's shared `sessionStore` for multi-instance or durable deployments.

## Vercel

Import the GitHub repository into Vercel, add a stable `LWC_SECRET`, and connect an Upstash Redis database from the Vercel Marketplace. The integration must provide `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; Vercel deployments fail fast without durable session storage. Redeploy after adding the variables.

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
