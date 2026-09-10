# Liquidius — Solana Token Screener & Alert System

Realtime screener untuk pair baru di Solana (pump.fun & Raydium/PumpSwap).
Menghitung metrik keamanan on-chain, melacak wallet, dan mengirim alert ke
Telegram bot + **web dashboard live** dengan tombol **Buy on GMGN** sebagai CTA
utama.

Repurposed dari catatan ide DLMM analytics — PRD lengkap ada di
`docs/PRDSolanaTokenScreener.md` (hasil brief user).

## Fitur v1

- **Ingestion realtime** (<5s target latency) via Helius Websocket logs
  subscription untuk 3 program: `pump.fun`, `Raydium AMM v4`, `PumpSwap`.
- **Enrichment pipeline** (P0–P4):
  - P0 — market cap, liquidity, volume 1m/5m, unique buyers, buy/sell ratio.
  - P1 — mint & freeze authority, top10 holder %, creator holding %, LP burn.
  - P2 — migration monitor (snapshot pre/post pump→raydium).
  - P3 — wallet watchlist (smart/sniper/caller) + same-funding-source cluster.
  - P4 — creator dump detection setelah migrate.
- **Auto-skip gate global** (PRD §7) — filter red flag sebelum evaluasi mode.
- **3 filter mode independen** — DEGEN, MEDIUM, SAFE-ISH — YAML config,
  hot-reload tanpa redeploy.
- **Alert dispatcher** — Telegram (3 channel) + Redis pub/sub → SSE ke web.
- **Web dashboard** — Next.js 14, Tailwind, framer-motion, dark theme. Tiga
  kolom hidup (DEGEN | MEDIUM | SAFE), kartu alert dengan safety badges,
  tracked-wallet chips, dan tombol **Buy on GMGN** yang deep-link ke
  `https://gmgn.ai/sol/token/{mint}`.

## Struktur

```
apps/screener   Node.js ingestion + enrichment + filter + alert
apps/web        Next.js 14 App Router dashboard (SSE realtime)
packages/core   config loaders, logger, types, Redis client
packages/ingest Helius WS + pump.fun/Raydium/PumpSwap log parsers
packages/enrich Safety, market rolling, migration, wallet, creator monitor
packages/filter auto-skip gate + mode evaluator + trigger detector
packages/alert  Telegram + web publisher + dedupe
config/         YAML mode thresholds + JSON watchlists (edit langsung, hot-reload)
prisma/         Postgres schema (Pair / Safety / Migration / Wallet / Alert)
docker/         Multi-stage Dockerfile (screener + web target)
```

## Setup lokal

**Prasyarat:** Node.js 20+, [pnpm 9](https://pnpm.io/installation), dan Docker
(untuk Postgres + Redis). Semua perintah project pakai `pnpm` — **tidak pakai
`corepack`** (di Windows sering error EPERM karena butuh admin).

### 1. Install pnpm

**Windows / macOS / Linux (npm — paling universal):**
```bash
npm install -g pnpm@9
pnpm --version   # pastikan keluar 9.x
```

Alternatif Windows: `winget install pnpm.pnpm`
Alternatif macOS: `brew install pnpm`
Alternatif Linux: `curl -fsSL https://get.pnpm.io/install.sh | sh -`

### 2. Env

```bash
cp .env.example .env
# Windows: copy .env.example .env
```
Isi minimal `HELIUS_API_KEY`, `HELIUS_RPC_URL`, `HELIUS_WSS_URL`. Untuk demo UI
tanpa Helius, set `DEV_FIXTURE_ALERTS=true` — screener akan inject fake alert
tiap 5s.

### 3. Infra (Postgres + Redis via Docker)

```bash
docker compose up -d postgres redis
```

### 4. Deps + Prisma

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
```

### 5. Dev

```bash
pnpm dev               # screener + web bersamaan
# atau jalankan terpisah di 2 terminal:
pnpm dev:screener      # http://localhost:8080  (healthz, metrics, /alerts/recent)
pnpm dev:web           # http://localhost:3000  (dashboard)
```

## Env variables

Semua rahasia HANYA dari `.env` — jangan pernah commit key. Lihat
`.env.example` untuk daftar lengkap.

Wajib untuk production:
- `HELIUS_API_KEY`, `HELIUS_RPC_URL`, `HELIUS_WSS_URL`
- `DATABASE_URL`, `REDIS_URL`
- `TELEGRAM_BOT_TOKEN` + salah satu chat ID (bila mau alert Telegram)

## Menjalankan tests

```bash
pnpm test           # vitest unit tests (filter, enrich)
pnpm config:lint    # validasi YAML mode + autoskip terhadap zod schema
pnpm typecheck      # strict TS check semua workspace
```

## Web dashboard — highlights UX

- 3 kolom live berdampingan, dark theme, sticky header dengan status pill
  (Live / Disconnected) & tombol pause stream.
- Kartu alert dengan animasi masuk (framer-motion), glow subtle saat baru
  muncul, dan aksi utama satu-klik: **Buy on GMGN** (gradient hijau,
  full-width di mobile). Tombol membuka `https://gmgn.ai/sol/token/{mint}`
  di tab baru dengan `rel="noopener noreferrer"`.
- Safety ditampilkan sebagai badge (✅/❌/❔) yang bisa di-hover untuk detail.
- Tracked wallet ditampilkan sebagai chip: 🧠 smart · 🎯 sniper · 📣 caller.
- Klik nama token → halaman detail dengan semua field §4 PRD.

## Non-goals

- Tidak ada auto-buy/auto-sell di sistem (integrasi Paybox MCP sengaja
  tidak dipakai; user manual buka GMGN untuk eksekusi).
- Tidak cover chain selain Solana.
- Auth minimal (single admin token) — v1 asumsi private single-user deploy.

## Yang saya *uncertain*

- **PumpSwap program ID** — placeholder di `packages/ingest/program-ids.ts`,
  wajib diverifikasi via Helius docs sebelum production.
- **Bundle/sniper heuristik** — implementasi awal berbasis slot window &
  same-funder cluster (PRD §13 open question); mungkin butuh tuning setelah
  data real terkumpul.
- **Log parser pump.fun/Raydium** — saat ini heuristic regex over log
  strings; untuk field precise (mint/pool address) di-resolve via
  `getTransaction(signature)` di enrichment layer. Rekomendasi upgrade:
  Anchor IDL decoder saat IDL tersedia stabil.
- **Latency P95 <5s** — target PRD, belum ada benchmark end-to-end di real
  network.

## Roadmap next

- BullMQ delayed jobs untuk enrichment post-migrate window 1m/5m.
- Honeypot simulator via `simulateTransaction` (sell path).
- Playwright e2e untuk memverifikasi `href` GMGN.
- Auth cookie httpOnly untuk write endpoints (watchlist / settings edit).

---

License: MIT.
