# Liquidius — Solana Token Screener & Alert System

Realtime screener untuk pair baru di Solana. Menarik data dari **Dexscreener
free API**, mem-filter dengan 3 mode risiko (DEGEN / MEDIUM / SAFE-ISH), lalu
menampilkan alert di **web dashboard** dengan tombol **Buy on GMGN** sebagai
CTA utama. Bisa juga push ke Telegram bot.

**100% free tier — no Docker, no Redis, no Postgres, no Helius diperlukan.**

## Fitur

- **Polling pipeline** — tarik "latest boosts" + "top boosts" dari Dexscreener
  tiap 30 detik, enrich pair data, evaluasi filter 3 mode paralel.
- **3 mode filter** — DEGEN (banyak alert, kotor), MEDIUM (default), SAFE-ISH
  (bersih). Threshold sesuai PRD §6.
- **Auto-skip gate** — liq terlalu rendah, buyers minim, volume-up-holders-down.
- **Web dashboard** — Next.js 14, Tailwind, framer-motion. 3 kolom live via
  Server-Sent Events, dark theme, mobile-friendly.
- **Tombol Buy on GMGN** — CTA gradient hijau di setiap kartu, deep-link ke
  `https://gmgn.ai/sol/token/{mint}` (buka tab baru).
- **Telegram push (opsional)** — set token + chat ID di `.env`, alert auto-forward.
- **Dev fixture mode** — set `DEV_FIXTURE_ALERTS=true` buat inject alert fake
  tiap 5 detik (buat lihat UI tanpa network).

## Quick start

**Prasyarat**: Node.js 20+ dan pnpm 9. Nggak butuh yang lain.

### 1. Install pnpm (kalau belum ada)

```powershell
npm install -g pnpm@9
pnpm --version   # harus keluar 9.x
```

### 2. Clone + install deps

```powershell
cd C:\path\to\Liquidius
pnpm install
```

### 3. Bikin `.env`

```powershell
copy .env.example .env
```
Buat pertama kali, edit `.env` dan set:
```
DEV_FIXTURE_ALERTS=true
```
(supaya bisa lihat UI langsung dengan alert fake — nggak butuh network).

### 4. Jalanin

```powershell
pnpm dev:web
```

Buka `http://localhost:3000` → dashboard muncul, 3 kolom bakal keisi alert
fake tiap 5 detik.

### 5. Mode real (Dexscreener polling)

Setelah UI OK, matikan fixture mode di `.env`:
```
DEV_FIXTURE_ALERTS=false
```
Restart `pnpm dev:web`. Sekarang sistem polling Dexscreener boosts tiap 30
detik. Alert muncul kalau ada token Solana yang match salah satu mode filter.

## Arsitektur (free-tier version)

```
Dexscreener API (free) ─┐
   /token-boosts/latest ─┼─> poller (30s tick) ─> mode filter (DEGEN/MEDIUM/SAFE) ─> in-memory bus
   /token-boosts/top    ─┤                                                          ├─> SSE → Web UI
   /latest/dex/tokens/  ─┘                                                          └─> Telegram (opt)
```

Semua state in-memory (proses Next.js). Restart = fresh. Cukup buat 1 user.

## Struktur

```
apps/web/                        Next.js 14 App Router dashboard
├── app/page.tsx                 3-kolom live dashboard
├── app/token/[mint]/            detail token
├── app/api/alerts/stream/       SSE endpoint
├── app/api/alerts/recent/       ring buffer readout
├── components/AlertCard.tsx     kartu alert + Buy on GMGN button
├── components/GmgnButton.tsx    CTA gradient hijau
├── lib/pipeline.ts              polling + mode filter (heart of the system)
├── lib/dexscreener.ts           API client
├── lib/bus.ts                   in-memory EventEmitter + ring buffer
├── instrumentation.ts           start poller saat Next.js boot
└── ...
packages/                        (legacy — versi Helius WS untuk upgrade nanti)
config/                          YAML mode thresholds (dipakai versi WS)
docs/PRDSolanaTokenScreener.md   PRD asli
```

## Upgrade path (kalau nanti mau tier berbayar)

Sistem free-tier ini punya beberapa kompromi vs PRD asli:

| PRD asli | Free tier version |
|---|---|
| Latency <5s via Helius WebSocket | 30s polling Dexscreener |
| Safety on-chain lengkap (mint/freeze/holder) | Field `unknown` — butuh Helius RPC |
| Pre-migrate pump.fun bonding curve | Cuma pair yg udah listed di Dexscreener |
| Redis pub/sub multi-instance | In-memory (single process) |

Kalau nanti mau upgrade:
- **Helius Developer ($49/mo)** unlocks WebSocket + enhanced APIs. Enable dgn set `HELIUS_API_KEY` di `.env`. Screener package (versi WS) sudah ada di `apps/screener/`.
- **Upstash Redis (free)** kalau butuh multi-instance pub/sub.
- **Neon Postgres (free)** kalau butuh histori alert persist.

## Non-goals

- Tidak ada auto-buy/auto-sell (user manual buka GMGN untuk eksekusi).
- Tidak cover chain selain Solana.

## Yang saya *uncertain*

- Rate limit exact Dexscreener free tier bisa berubah — kalau kena 429, tambah
  interval polling di `apps/web/lib/pipeline.ts` konstanta `POLL_INTERVAL_MS`.
- Metric `unique_buyers_5m` di Dexscreener adalah count `buys` (bukan unique
  address) — approximation, bukan angka real.
- Pre-migrate pump.fun pairs kadang belum muncul di Dexscreener sampai listed
  di Raydium — realistic detection window: post-migrate saja.

## Command referensi

| Command | Fungsi |
|---|---|
| `pnpm install` | Install semua deps |
| `pnpm dev:web` | Jalanin dashboard di `localhost:3000` |
| `pnpm build` | Production build |
| `pnpm --filter web start` | Production run setelah build |

---

License: MIT.
