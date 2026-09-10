# PRD — Solana Token Screener & Alert System

**Chain:** Solana only
**Versi:** 1.0
**Status:** Draft

---

## 1. Latar Belakang & Masalah

Token baru di Solana (khususnya dari pump.fun → migrasi ke Raydium/PumpSwap) muncul dalam hitungan detik dan bergerak sangat cepat. Trader manual tidak bisa memonitor semua metrik (liquidity, holder distribution, wallet tracking, bundle/sniper detection) secara real-time untuk memutuskan entry yang aman vs scam/rug.

**Tujuan produk:** membangun sistem yang otomatis menarik data on-chain + off-chain untuk setiap pair baru di Solana, melakukan scoring/filtering berdasarkan 3 mode risiko, dan mengirim alert saat kondisi terpenuhi — sambil auto-skip token yang punya red flag jelas.

## 2. Goals

- Deteksi pair baru Solana (pump.fun & Raydium/PumpSwap) real-time (<5 detik delay).
- Hitung metrik keamanan (mint/freeze authority, holder concentration, bundle/sniper %, creator behavior).
- Lacak wallet (smart money, sniper, caller, cluster/funding source).
- Sediakan 3 mode filter (DEGEN, MEDIUM, SAFE-ISH) yang bisa dipilih user, bukan 1 filter untuk semua.
- Kirim alert (Telegram bot minimal untuk v1) sesuai trigger.
- Auto-skip token yang match kriteria red flag, tanpa perlu alert manual.

## 3. Non-Goals (v1)

- Tidak melakukan auto-buy/auto-sell (murni alert & screening dulu).
- Tidak cover chain selain Solana.
- Tidak membangun UI dashboard kompleks di v1 (cukup bot + log/table sederhana).

---

## 4. Data Model

### 4.1 Core Pair Data
| Field | Tipe | Sumber |
|---|---|---|
| pair_age_seconds | int | RPC / indexer timestamp pool created |
| launch_source | enum(pump, raydium, lainnya) | program ID pool |
| token_age | int (detik sejak mint) | RPC |
| market_cap | float (USD) | price × supply |
| liquidity_usd | float | pool reserves |
| volume_1m / volume_5m | float | agregasi swap |
| buys_1m / sells_1m | int | agregasi swap |
| unique_buyers_5m | int | distinct wallet buy |
| buy_sell_ratio_5m | float | buys/sells |

### 4.2 Safety
| Field | Tipe | Sumber |
|---|---|---|
| mint_authority | bool (enabled/disabled) | token mint account |
| freeze_authority | bool | token mint account |
| lp_burned | bool | LP token supply ke burn address |
| lp_locked | bool | locker contract check |
| lp_lock_time | datetime/duration | locker contract |
| top10_holder_pct | float | holder distribution |
| creator_holding_pct | float | creator wallet balance / supply |
| creator_sold_pct | float | tx history creator wallet |
| bundle_pct | float | deteksi cluster beli bareng saat launch |
| sniper_pct | float | wallet beli di block/slot awal |
| honeypot_flag | bool | simulasi sell / tax check |
| tax_fee | float | buy/sell tax dari contract (jika ada) |

### 4.3 Migration
| Field | Tipe | Sumber |
|---|---|---|
| is_migrated | bool | event migrate pump→raydium/pumpswap |
| migrate_time | datetime | event log |
| mc_at_migrate | float | snapshot saat migrate |
| liq_at_migrate | float | snapshot saat migrate |
| volume_after_migrate_1m/5m | float | agregasi pasca migrate |
| holders_after_migrate_5m | int | snapshot holder count |
| creator_sold_after_migrate | bool/pct | tx creator wallet pasca migrate |
| top_holder_sold_after_migrate | bool/pct | tx top holder pasca migrate |
| bonding_progress_pct | float | bonding curve state (pra-migrate) |

### 4.4 Wallet Tracking
| Field | Tipe | Sumber |
|---|---|---|
| creator_wallet | string | deployer address |
| first_20_buyers | array<string> | urutan tx buy |
| tracked_smart_wallets_in | int | match dgn watchlist wallet cuan |
| tracked_sniper_wallets_in | int | match dgn watchlist sniper |
| tracked_caller_wallets_in | int | match dgn watchlist caller/KOL |
| cluster_wallet_count | int | wallet terhubung funding source sama |
| same_funding_source | bool | funding wallet asal sama |
| wallet_still_holding | bool per wallet | balance check |
| wallet_avg_entry_mc | float | mc saat wallet entry |
| wallet_sold_already | bool per wallet | tx sell check |

### 4.5 Alert Trigger (event, bukan field statis)
- new_pair_detected
- bonding_almost_done
- just_migrated
- smart_wallet_buy
- creator_dump
- liq_too_low
- holder_concentration_high
- volume_up_holders_up
- volume_up_holders_down

---

## 5. Prioritas Implementasi (Roadmap Data)

Urutan build berdasarkan ROI vs effort:

1. **P0** — pair_age, market_cap, liquidity, unique_buyers_5m *(core filter awal, paling murah didapat)*
2. **P1** — mint/freeze authority, top10_holder_pct, creator_holding_pct *(safety dasar, wajib sebelum alert apapun keluar)*
3. **P2** — is_migrated + mc_at_migrate *(titik keputusan besar: pre vs post migrate)*
4. **P3** — tracked wallet buy/sell (smart/sniper/caller wallet) *(butuh watchlist wallet, effort lebih tinggi)*
5. **P4** — creator_dump setelah migrate *(butuh monitoring wallet berkelanjutan pasca event)*

Build sistem secara bertahap sesuai urutan ini — jangan tunggu semua field lengkap baru rilis v1.

---

## 6. Mode Filter (3 Mode, Tidak Boleh Digabung Jadi Satu)

### 6.1 Mode DEGEN (lebih banyak alert, lebih kotor/berisiko)

**Pre-migrate:**
| Metrik | Threshold |
|---|---|
| pair_age | 30 detik – 12 menit |
| market_cap | $3.000 – $25.000 |
| liquidity_usd | $2.500 – $15.000 |
| volume_1m | > $800 |
| volume_5m | > $2.000 |
| unique_buyers_5m | > 12 |
| buy_sell_ratio_5m | > 1.2 |
| top10_holder_pct | < 38% |
| creator_holding_pct | < 12% |
| bundle_pct | < 25% |
| sniper_pct | < 20% |
| mint_authority | disabled |
| freeze_authority | disabled |
| lp_burned/locked | preferred, tidak wajib |
| is_migrated | boleh belum |
| bonding_progress_pct | > 70% ATAU baru migrate |

**Post-migrate:**
| Metrik | Threshold |
|---|---|
| mc_at_migrate | $8.000 – $40.000 |
| volume_after_migrate_1m | > $1.500 |
| creator_sold_after_migrate | < 40% |
| tracked_smart_wallets_in | ≥ 1 |

### 6.2 Mode MEDIUM (paling worth dipakai / default rekomendasi)

**Pre-migrate:**
| Metrik | Threshold |
|---|---|
| pair_age | 1 – 20 menit |
| market_cap | $6.000 – $35.000 |
| liquidity_usd | $5.000 – $25.000 |
| volume_1m | > $1.500 |
| volume_5m | > $5.000 |
| unique_buyers_5m | > 25 |
| buy_sell_ratio_5m | > 1.4 |
| top10_holder_pct | < 28% |
| creator_holding_pct | < 7% |
| bundle_pct | < 15% |
| sniper_pct | < 12% |
| mint_authority | disabled |
| freeze_authority | disabled |
| lp_burned/locked | wajib |
| is_migrated | lebih bagus yes |
| bonding_progress_pct | > 90% ATAU already migrated |

**Post-migrate:**
| Metrik | Threshold |
|---|---|
| mc_at_migrate | $12.000 – $45.000 |
| volume_after_migrate_5m | > $8.000 |
| holders_after_migrate_5m | naik (delta positif) |
| creator_sold_after_migrate | < 20% |
| top_holder_sold_after_migrate | < 15% |
| tracked_smart_wallets_in | ≥ 1 |
| cluster_wallet_count | rendah |

### 6.3 Mode SAFE-ISH (sedikit alert, lebih bersih)

**Pre-migrate:**
| Metrik | Threshold |
|---|---|
| pair_age | 3 – 30 menit |
| market_cap | $10.000 – $40.000 |
| liquidity_usd | $8.000 – $40.000 |
| volume_5m | > $10.000 |
| unique_buyers_5m | > 40 |
| buy_sell_ratio_5m | > 1.5 |
| top10_holder_pct | < 22% |
| creator_holding_pct | < 4% |
| bundle_pct | < 8% |
| sniper_pct | < 8% |
| mint_authority | disabled |
| freeze_authority | disabled |
| lp_locked | > 30 hari ATAU burned |
| is_migrated | yes |

**Post-migrate:**
| Metrik | Threshold |
|---|---|
| mc_at_migrate | $15.000 – $50.000 |
| volume_after_migrate_5m | > $15.000 |
| creator_sold_after_migrate | < 10% |
| tracked_smart_wallets_in | ≥ 2 |
| creator_dump | none |
| volume_up_holders_down | skip (jangan alert kalau ini terjadi) |

---

## 7. Auto-Skip Rules (Berlaku Global, Semua Mode)

Token langsung di-skip (tidak masuk pipeline alert sama sekali) jika salah satu kondisi ini terpenuhi:

- `liquidity_usd < $2.000`
- `top10_holder_pct > 45%`
- `creator_holding_pct > 15%`
- `mint_authority == enabled` ATAU `freeze_authority == enabled`
- `unique_buyers_5m < 10`
- Volume naik tapi holder count turun (`volume_up_holders_down`)
- `creator_dump == true` setelah migrate
- Banyak wallet berasal dari 1 funding source yang sama (`same_funding_source == true` dengan `cluster_wallet_count` tinggi)

Auto-skip dievaluasi **sebelum** filter mode — jadi ini gate pertama di pipeline, bukan tambahan di akhir.

---

## 8. Alert Trigger Logic

| Trigger | Kondisi Pemicu |
|---|---|
| new_pair_detected | Pair baru terdeteksi & lolos auto-skip gate |
| bonding_almost_done | `bonding_progress_pct` melewati threshold mode (mis. >70%/>90%) |
| just_migrated | `is_migrated` berubah dari false → true |
| smart_wallet_buy | Wallet dari watchlist smart money masuk buy |
| creator_dump | Creator wallet jual di atas ambang % supply tertentu |
| liq_too_low | `liquidity_usd` turun drastis (mis. >30% drop dalam X menit) |
| holder_concentration_high | `top10_holder_pct` naik melewati threshold mode |
| volume_up_holders_up | Volume naik & holder count juga naik (sinyal sehat) |
| volume_up_holders_down | Volume naik tapi holder turun (sinyal distribusi ke sedikit wallet — biasanya di-skip, bukan di-alert, kecuali user eksplisit mau lihat) |

---

## 9. Arsitektur Sistem (High-Level)

```
[Solana RPC/Websocket] ─┐
[Helius/Birdeye/DexScreener API] ─┼─> [Ingestion Service] ─> [Enrichment Engine] ─> [Filter Engine (3 mode)] ─> [Alert Dispatcher] ─> Telegram/Discord bot
[pump.fun program events] ─┘                                        │
                                                          [Wallet Tracking DB]
                                                          (watchlist smart/sniper/caller wallet)
```

**Komponen:**
1. **Ingestion Service** — subscribe ke program logs pump.fun & Raydium/PumpSwap via websocket (Helius/QuickNode), tangkap event pool creation, swap, migrate.
2. **Enrichment Engine** — hitung metrik turunan (buy_sell_ratio, top10_holder_pct, bundle_pct, sniper_pct) dari raw transaction data.
3. **Wallet Tracking DB** — tabel watchlist wallet (smart/sniper/caller) + histori funding source, dipakai untuk cluster detection.
4. **Filter Engine** — evaluasi auto-skip gate dulu, lalu jalankan 3 rule-set mode secara paralel (satu token bisa lolos di lebih dari 1 mode).
5. **Alert Dispatcher** — kirim ke Telegram bot per mode (bisa 3 channel/grup terpisah: #degen, #medium, #safe-ish).

---

## 10. Kebutuhan Data/API Eksternal (Berbayar)

| Kebutuhan | Contoh Provider | Catatan Biaya |
|---|---|---|
| RPC & websocket Solana (low latency) | Helius, QuickNode, Triton | Paid tier wajib untuk latency rendah & rate limit tinggi |
| Token/holder/price data | Birdeye API, DexScreener API | Sebagian free tier terbatas, fitur lanjutan berbayar |
| pump.fun bonding curve data | Helius pump.fun API / indexer pihak ketiga | Cek rate limit, biasanya berbayar untuk volume tinggi |
| Wallet labelling (smart/sniper) | Custom watchlist internal + opsional API pihak ketiga (mis. Arkham-like) | Bisa mulai manual/self-built dulu untuk kurangi biaya |
| Notifikasi | Telegram Bot API | Gratis |

> **Catatan penting:** semua API key (Helius, Birdeye, RPC provider, dsb) **wajib disimpan di file `.env`** (atau secret manager seperti AWS Secrets Manager / Doppler untuk production), **JANGAN pernah di-hardcode** di source code atau ter-commit ke repo. Tambahkan `.env` ke `.gitignore`. Contoh:
> ```
> HELIUS_API_KEY=xxxxx
> BIRDEYE_API_KEY=xxxxx
> RPC_WSS_URL=wss://xxxxx
> TELEGRAM_BOT_TOKEN=xxxxx
> ```
> Load via `process.env.HELIUS_API_KEY` (Node) atau `os.environ["HELIUS_API_KEY"]` (Python), jangan pernah print/log value key ke console di production.

---

## 11. Non-Functional Requirements

- **Latency:** deteksi pair baru → alert pertama idealnya < 5 detik.
- **Reliability:** websocket reconnect otomatis jika koneksi RPC putus.
- **Rate limit awareness:** batasi polling ke Birdeye/DexScreener sesuai kuota paket berbayar, prioritaskan websocket on-chain event dibanding polling REST.
- **Extensibility:** threshold tiap mode harus jadi config (JSON/YAML), bukan hardcode, supaya gampang di-tuning tanpa redeploy.

## 12. Success Metrics (v1)

- % alert yang tidak berujung rug dalam 1 jam pertama (per mode).
- Rata-rata delay deteksi pair baru vs waktu on-chain aktual.
- Jumlah false-positive auto-skip (token bagus yang ke-skip keliru) — dicek manual mingguan.

## 13. Open Questions

- Sumber data bundle_pct & sniper_pct: pakai heuristik sendiri (block/slot yang sama) atau API pihak ketiga?
- Watchlist smart wallet dibangun manual dari histori profit, atau beli data dari provider?
- Apakah butuh dashboard web di v1, atau cukup Telegram bot + Google Sheet log?
