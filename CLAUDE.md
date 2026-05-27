# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

钱迹账簿整理台 — a local web tool that converts Alipay (CSV, GB18030) and WeChat (XLSX) bill exports into the Qianji app import template (UTF-8 BOM CSV). All processing happens client-side in the browser; only the config is persisted server-side to `data/config.json`.

## Commands

```bash
pnpm dev          # Dev server at localhost:3000
pnpm build        # Production build
pnpm lint         # ESLint (flat config, eslint-config-next)
pnpm test         # Vitest — run all tests
pnpm test parsers # Run a single test file by name pattern
```

No deploy scripts; the app is a standard Next.js build.

## Architecture

Single feature module at `src/features/import/`. The data flow is a three-stage pipeline:

```
parsers.ts  →  transform.ts  →  export.ts
```

1. **parsers.ts** — `parseAlipayBuffer` / `parseWechatBuffer` read raw file bytes, locate headers dynamically (not by row index), and produce `NormalizedTransaction[]`. Alipay uses GB18030 encoding with preamble lines; WeChat is standard XLSX.
2. **transform.ts** — `buildPreviewRows(transactions, config, overrides)` applies `AppConfig` rules (category rules by keyword+time, source category mappings, payment method mappings) to produce `PreviewRow[]` with issues and export eligibility.
3. **export.ts** — `createQianjiCsv(rows)` filters to `canExport` rows and emits Qianji-format CSV with BOM.

### Config persistence

`config-store.ts` reads/writes `data/config.json` (atomic write via temp file + rename). `config.ts` holds `parseAppConfig` (validation/normalization) and `DEFAULT_CONFIG`. The API route at `src/app/api/config/route.ts` exposes GET/PUT.

### UI

`ImportWorkbench.tsx` is the single-page client component. Sidebar: file upload + config panel. Main area: preview table with filter/search, batch editing, and CSV download. Overrides (field edits, include/exclude) are in-memory only — they never touch the server.

### Type system

`types.ts` defines the canonical shapes: `NormalizedTransaction` (source-agnostic), `QianjiTemplateRow` (13 Qianji headers), `PreviewRow` (wraps both with issues/flags), `AppConfig`, `CategoryRule`, `RowIssue`.

## Conventions

- Path alias: `@/*` → `./src/*`
- Tests use Vitest with `describe`/`it`/`expect`; test files are co-located as `*.test.ts` next to the module they cover.
- No CSS modules beyond `import-workbench.module.css`; Tailwind for layout, module CSS for the workbench shell.
- The `xlsx` library handles both CSV and XLSX parsing — CSV files go through `XLSX.read` with `type: "string"`.
- Config rules are validated on every read/write via `parseAppConfig`; never trust raw JSON from disk or API.
