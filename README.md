# ExamTrack

A local-first VCE practice exam tracker built with React, Vite, shadcn/ui, Recharts, and KaTeX.

## Development

```bash
bun install
bun run dev
```

Student data stays in browser storage. Use the app menu to export or import a validated JSON backup.

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
