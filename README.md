# DLMM Analytics Dashboard (Solana / Meteora) — Project Idea

> Status: **Idea / Parked** — to be revisited after Plagcheck is done.

## Background

Project ini muncul dari diskusi soal skill gap untuk level junior/intern backend developer. Tujuannya bukan sekadar portfolio piece, tapi juga vehicle untuk nutup beberapa gap teknis yang belum tersentuh di project sebelumnya (BurnoutSense, Plagcheck).

## Konsep Project

Dashboard analitik untuk historical data DLMM (Dynamic Liquidity Market Maker) di Meteora (Solana), mencakup:

- Histori posisi DLMM
- PnL (Profit and Loss) per posisi
- Winrate per strategi
- Labeling/framing strategi yang diimplementasikan saat membuka posisi
- Evaluasi komparatif: strategi mana yang punya winrate terbaik

## Gap Mapping — Skill yang Bisa Diimplementasikan

| # | Gap Area | Implementasi di Project Ini |
|---|----------|------------------------------|
| 1 | Testing (unit/integration) | PnL & winrate calculation bersifat deterministik — cocok untuk unit test (input posisi → expected output) |
| 2 | CI/CD | Pipeline deploy untuk scheduled jobs (cron fetch on-chain data) |
| 3 | Cloud deployment | Hosting dashboard + scheduled data ingestion (AWS/GCP/VPS) |
| 4 | API security (rate limiting, validation, env management) | Proteksi endpoint dashboard, manajemen API key (Solana RPC, dll) |
| 5 | Database fundamentals (indexing, query optimization) | Data time-series volume besar — indexing strategy untuk query "winrate per strategi" jadi use case nyata |
| 6 | Debugging/monitoring | Data ingestion dari Solana RPC rawan fail/rate-limit — perlu structured logging + alerting |
| 9 | DSA | Logic untuk strategy labeling/classification — pattern matching atau clustering sederhana |
| 11 | Auth & Authorization (RBAC, OAuth) | Jika dashboard multi-user (tracking wallet sendiri vs. orang lain) |
| 12 | System design | Whole pipeline: ingestion → queue → cache → DB → API → dashboard. Trade-off nyata: polling vs websocket RPC, caching strategy |

**Gap yang TIDAK natural fit di sini:** Git workflow/PR review (#7, butuh kolaborasi tim), English communication (#10, kecuali project di-dokumentasikan dalam Inggris untuk open source), Agile/Scrum (#13, butuh konteks tim).

## Tech Stack Ideas (Tentative)

### Data Ingestion
- Solana RPC (public atau provider seperti Helius/QuickNode)
- Meteora SDK/API untuk data DLMM spesifik
- Scheduled jobs (cron / BullMQ — reuse dari pengalaman BurnoutSense)

### Backend
- Node.js/TypeScript (Express/Fastify) atau Python/FastAPI — sesuaikan dengan stack yang mau diperdalam
- PostgreSQL untuk data time-series (consider TimescaleDB extension jika volume besar)
- Redis untuk caching hasil agregasi (winrate, PnL summary)

### Strategy Labeling/Classification
- Rule-based labeling dulu (kategori strategi berdasarkan parameter posisi)
- Bisa dikembangkan ke clustering (mathjs/python) jika diperlukan analisis lebih lanjut

### Frontend/Dashboard
- React + Recharts/Plotly untuk visualisasi PnL, winrate per strategi
- Tabel histori posisi dengan filter/sort

### DevOps
- Docker untuk containerization (consistent dengan project sebelumnya)
- GitHub Actions untuk CI/CD (test → build → deploy)
- Deploy ke VPS atau cloud (AWS/GCP free tier untuk awal)

## Potensi Tugas Akhir / Skripsi

Project ini punya potensi diangkat jadi topik skripsi (target: judul ditentukan di semester 7, eksekusi semester 8).

**Approach:** build product dulu → setelah MVP jadi, sebar ke komunitas (misal Meridian) dengan kuisioner → data + metodologi untuk skripsi.

**Yang perlu dipikirkan dari awal development (bukan setelah jadi):**
- Desain kuisioner/instrumen pengukuran perlu dirancang sejak awal — pakai kerangka teori yang diakui (misal TAM - Technology Acceptance Model, atau UEQ - User Experience Questionnaire), bukan sekadar feedback produk biasa
- Target responden: komunitas DLMM/Solana traders (niche) — perlu cek apakah realistis dapat sample size yang cukup (umumnya 30-100 responden untuk metode kuantitatif)
- Rumusan masalah harus framed akademis: kemungkinan arah "pengembangan sistem + evaluasi penerimaan pengguna (technology acceptance)"
- Timeline: MVP harus selesai cukup lama sebelum semester 8 supaya ada waktu untuk distribusi kuisioner + analisis data

## Next Steps (Saat Mulai)

1. Selesaikan Plagcheck dulu — jangan split fokus ke 2 project WIP sekaligus
2. Re-evaluate timing terkait komitmen jeda investasi
3. Riset Meteora API/SDK docs — cek availability data historis DLMM
4. Define MVP scope — mulai dari single-wallet tracking sebelum multi-user
5. Prioritaskan gap #1 (testing) dan #5 (database) sejak awal development, jangan jadi afterthought

---

*Dokumen ini merupakan catatan ide dan rencana pengembangan, bukan implementasi final.*
