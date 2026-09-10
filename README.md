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

### 5. Mode real

Setelah UI OK, matikan fixture di `.env`:
```
DEV_FIXTURE_ALERTS=false
```

**Opsi A — Dexscreener only (paling minimal, no signup)**:
Restart `pnpm dev:web`. Sistem polling Dexscreener tiap 45 detik. Alert muncul
kalau ada Solana pair yang match filter. Chip source biasanya `Dexscreener`
atau `Raydium`. **Tidak akan detect fresh pump.fun launches** (butuh Helius).

**Opsi B — Dual-source (Helius WS + Dexscreener, rekomended)**:
1. Signup free di https://helius.dev — dapat 1M credits/bulan.
2. Copy API key, tambahin di `.env`:
   ```
   HELIUS_API_KEY=xxxxx
   HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxxxx
   HELIUS_WSS_URL=wss://mainnet.helius-rpc.com/?api-key=xxxxx
   ```
3. Restart `pnpm dev:web`.

Terminal bakal keluar:
```
[pipeline] starting dual-source (DS poll 45s + Helius WS)
[helius] connecting…
[helius] connected — subscribing pump.fun logs
[pipeline] pump.fun detected mint=A1b2c3… sig=5xyz…
[pipeline] dexscreener tick: 47 candidates, 2 published
```

Fresh pump.fun launches bakal muncul dgn chip 🚀 **pump.fun** biasanya di kolom
DEGEN (baru launch), Dexscreener catch pair yg udah listed (chip 📊 / 🌊 / 🔄).

## Arsitektur (free-tier dual-source)

```
Helius WS logsSubscribe (pump.fun)  ─┐
  (opsional, kalau HELIUS_API_KEY    │
   di-set)                           │
                                     ├─> in-memory candidate registry
Dexscreener REST polling (45s)  ─────┘        (dedupe by mint)
   /token-boosts/latest                                │
   /token-boosts/top                                   ▼
   /token-profiles/latest                       auto-skip + 3 mode filter
   /latest/dex/search?q=SOL                            │
   /latest/dex/tokens/{mint}                           ▼
                                                in-memory bus + ring buffer
                                                       │
                                       ┌───────────────┼──────────────┐
                                       ▼               ▼              ▼
                                    SSE → Web UI    Telegram      history API
```

Setiap alert punya **source chip** yang jelas asalnya:
- 🚀 `pump.fun` — dari Helius WS logs (fresh detection)
- 🌊 `Raydium` — pair terdeteksi di Raydium AMM
- 🔄 `PumpSwap` — pair terdeteksi di PumpSwap
- 📊 `Dexscreener` — dari boost/search/profile feed
- 🧪 `Fixture` — fake alert dev mode

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

- **Rate limit Dexscreener free tier** bisa berubah — kalau kena 429, naikin
  `POLL_INTERVAL_MS` di `apps/web/lib/pipeline.ts` (default 45s).
- **Helius free tier WS connection limit** — pengalaman gw 1-2 concurrent.
  Kita cuma subscribe 1 program (pump.fun), aman.
- **Helius credit budget** — 1M/bulan = ~33k/hari. Tiap pump.fun launch =
  1 `getTransaction` call (~5-10 credits). Kalau pump.fun output >2000
  launch/hari, budget bisa nipis. Mitigation: sample rate throttle
  (belum di-implement, TODO).
- **Metric `unique_buyers_5m`** = count `buys` dari Dexscreener (approximation,
  bukan unique address).
- **pump.fun log parser** pakai regex atas string log — bisa false-positive/
  negative. Lebih robust pakai Anchor IDL decoder (TODO).

## Command referensi

| Command | Fungsi |
|---|---|
| `pnpm install` | Install semua deps |
| `pnpm dev:web` | Jalanin dashboard di `localhost:3000` |
| `pnpm build` | Production build |
| `pnpm --filter web start` | Production run setelah build |

---

License: MIT.
