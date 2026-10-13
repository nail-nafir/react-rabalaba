# Audit Jurnal dan eksperimen engine

Runner `npm run gate:compare` membandingkan v7 dengan lima eksperimen terpisah. Produksi tidak membaca konfigurasi kandidat. Parameter riset tidak aktif pada pemanggil engine existing. Tidak ada migrasi, perubahan API, deployment, atau penulisan database.

Lihat [hasil audit dan eksperimen 12 Oktober 2026](04-engine-research-results-2026-10-12.md) untuk run pertama dengan Jurnal aktual.

## Data dan perintah

```sh
# Arsip publik: OI, harga kontrak yang sama, funding dengan interval aslinya,
# dan rasio long/short. Tidak membutuhkan API key Binance.
node scripts/collect-research-flow.mjs \
  --from 2025-10-16 --to 2026-10-11 \
  --out research.local/crypto-flow.json

# Evaluasi lima aset per kelas. Tanpa --per-class, gunakan seluruh universe.
npm run gate:compare -- \
  --from 2025-10-16 --to 2026-10-11 --per-class 5 \
  --flow research.local/crypto-flow.json --out research.local/study

# Alternatif akses Jurnal: array JSON hasil ekspor journal_trades.
npm run gate:compare -- --journal /path/journal.json --out research.local/export-study

# Diagnosis seluruh trade v7 aktual tanpa menjalankan eksperimen kandidat.
npm run gate:compare -- --journal-only --out research.local/journal-audit
```

Gunakan direktori studi baru. Runner menolak menimpa protokol. `research.local` diabaikan Git oleh aturan `*.local`; raw data dan kredensial tidak masuk commit. Data Jurnal dibaca melalui konfigurasi `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` existing di environment atau `supabase/functions/.env`. Request hanya GET. Kegagalan akses dicatat sebagai **unavailable**, bukan hasil nol trade yang dianggap sehat. `--journal-cache` dapat memakai snapshot `journal-source.json` dari studi sebelumnya. `--development-only` mempertahankan holdout tertutup meskipun kandidat lolos development.

Universe kripto/saham berasal dari `journal_assets` aktif jika dapat dibaca. Komoditas/forex memakai daftar existing. Mode sampel mendahulukan seed ticker existing yang masih aktif, tanpa memilih berdasarkan hasil. Tanpa akses universe, laporan memakai daftar fallback existing. Snapshot universe saat ini memiliki risiko survivorship; bukan rekonstruksi semua aset yang dahulu tersedia.

## Pengukuran

- Jurnal menggunakan `rowToFollowedTrade` dan `computePnl` existing. Versi sebelum v7 dan versi tidak diketahui dipisahkan. V7 memakai scale-out 50/30/20.
- Winrate net = jumlah trade dengan net R positif / **semua trade selesai**, termasuk impas. Expectancy = rata-rata net R. Ini sengaja berbeda dari winrate UI yang dapat mengecualikan impas.
- Gross, estimasi net, dan estimasi net dengan biaya 2× tersedia berdampingan. Biaya menggunakan `BACKTEST_COSTS` existing; funding, borrow, pajak, dan biaya spesifik broker belum termasuk.
- Exit Jurnal menyimpan awal candle yang memuat kejadian. Selisih beberapa detik sebelum waktu entry diterima sesuai `ENTRY_BAR_TOLERANCE_MS` existing; waktu event untuk pengurutan dibatasi minimum ke entry, dan waktu exit tersimpan tetap dicatat.
- Laporan memisahkan versi engine, kelas aset, arah, regime, grade, dan alasan keluar. Drawdown adalah penurunan basket trade dengan risiko 1R per posisi, bukan drawdown akun dengan batas modal/posisi.

Baseline replay memakai fungsi sinyal v7, scale-out, gap stop, konfirmasi close setelah stop dinaikkan dalam candle yang sama, dan signal episodes. Window menggunakan 60 tanggal bursa teramati (`exchangeTimezoneName`; UTC untuk kripto), bukan 60 hari kalender untuk saham. Anchor 4H/daily dihitung dari window yang sama. Parity terhadap adapter diperiksa dengan payload `60d` yang sama.

**Batas parity:** arsip Yahoo bukan snapshot payload yang benar-benar diterima cron pada setiap keputusan. Hari tanpa data, sesi pendek futures, revisi data, dan perubahan jadwal dapat membuat awal window historis berbeda. Replay mengeksekusi pada open berikutnya; delay publikasi/scan dan reversal cron tidak seluruhnya direproduksi. Parity fungsi dengan input yang sama tidak berarti simulasi identik dengan seluruh operasi server.

## Kandidat

| Kandidat | Aturan awal |
|---|---|
| `setup-room` | Tahan entry jika struktur lawan terdekat yang diketahui berjarak <1R. Level yang sudah dilewati bukan penghalang di depan entry. |
| `extension` | Tahan entry jika harga entry melebar >2 ATR dari EMA20 ke arah transaksi. |
| `flow-filter` | Tahan flow berlawanan ≥0,25 untuk saham atau ≥0,4 untuk kripto. |
| `flow-score-50` | Ganti 50% skor kategori volume dengan flow valid sebelum menetapkan arah. |
| `flow-score-100` | Ganti seluruh skor kategori volume dengan flow valid sebelum menetapkan arah. |

Tidak ada kategori berbobot tambahan. Flow derivatif yang valid dapat mengisi kategori volume yang sebelumnya tidak memiliki OHLCV andal. Guard kualitas harga, jumlah candle, tren, dan chop tetap berjalan. Flow hilang/invalid/kedaluwarsa memakai baseline. Komoditas/forex tidak diberi proksi volume buatan.

Saham menggunakan akumulasi OHLCV existing dengan sedikitnya 20 hari selesai, tanpa hari UTC berjalan dan tanpa volume harian nol. Ini **proksi akumulasi**, bukan identifikasi pembelian institusi.

Kripto menggunakan arsip resmi USDT-M. Collector memeriksa checksum, schema, simbol, duplikasi, batas tanggal file, dan pasangan OI/harga berjarak tepat 24 jam pada kontrak yang sama. Funding dinormalisasi ke ekuivalen 8 jam menggunakan interval yang tercatat. Data future/stale pada funding atau rasio tidak ikut skor. File hilang tercatat dalam laporan coverage; nilainya tidak diisi nol.

**Asumsi publikasi:** arsip menyimpan waktu observasi REST, bukan waktu kedatangan historis di aplikasi. Eksperimen menunggu satu jam setelah observasi sebelum memakainya. Ini model delay yang harus diverifikasi dalam pencatatan forward. Waktu penerbitan file arsip harian tidak dipakai sebagai waktu observasi. Arsip bulanan bulan berjalan dapat belum tersedia; area tersebut kembali ke baseline.

## Development, holdout, dan kelulusan

Semua aset memakai batas tanggal UTC yang sama. 75% awal dibagi tiga fold development; 25% terakhir disimpan sebagai holdout. Trade yang melintasi batas fold atau ditutup paksa pada akhir data dikeluarkan dari seleksi. Holdout tidak direplay untuk semua kandidat.

Kandidat wajib memenuhi:

- Winrate net naik ≥2 poin persentase dan expectancy net naik ≥0,05R/trade.
- Profit factor minimal 1,1 dan tidak turun dari baseline; drawdown model tidak bertambah.
- Minimal 50% jumlah trade baseline dipertahankan.
- Syarat diperiksa pada biaya normal dan 2×; setiap kelas aset tidak mengalami penurunan WR, expectancy, PF, DD, atau retensi di bawah batas.
- Ketiga fold tidak menunjukkan penurunan WR/expectancy. Bootstrap berpasangan 1.000 kali mengambil blok mingguan yang sama untuk kedua strategi dan seluruh aset sekaligus. Batas bawah interval 95% kenaikan WR dan expectancy harus positif.
- Batas sampel awal: baseline ≥100 trade, kandidat ≥50, ≥12 blok mingguan berisi trade; per kelas baseline ≥20 dan kandidat ≥10. Kurang data/ketidakpastian tetap **unproven**. Angka ini protokol awal, bukan jaminan signifikansi universal.

Pilih satu kandidat yang lolos berdasarkan peningkatan expectancy development, dengan nama sebagai pemecah seri deterministik. `selection.json` ditulis sebelum membuka holdout. Ledger `research.local/holdouts.json` menolak penggunaan ulang tanggal yang tumpang tindih, termasuk saat memakai folder output berbeda. Jangan menghapus ledger untuk mencoba kandidat lain. Jika proses berhenti setelah holdout diklaim, anggap holdout tersebut sudah digunakan.

Kandidat yang lolos holdout hanya menghasilkan `stage: forward-comparison-required` dan `productionEnabled: false`. Tahap ini tidak mengaktifkan sinyal atau mengirim alert baru. Jika tidak ada yang lolos, tidak ada konfigurasi produksi yang diubah. Durasi dan hasil forward belum tersedia.

## Diagnosis dan output

`journal-audit.json` memuat data serta cohort aktual; `development.json` memuat fold, ketidakpastian, parity, dan coverage; `development-trades.json` memuat rekam per-trade; `candidate.json` memuat keputusan riset.

Diagnosis mencatat extension ATR, ruang struktur dalam R, dan `created_at - decision_candle_closed_at`. Input entry historis yang dapat direkonstruksi diberi label `reconstructed-current-history`; hasilnya dapat berbeda dari snapshot asli. MFE/MAE memakai batas atas dari high/low candle termasuk candle exit. Urutan intrabar tidak diketahui, sehingga angka tersebut bukan excursion persis sampai detik penutupan. Nilai yang tidak dapat direkonstruksi adalah `null`, bukan nol. Pisahkan delay publikasi ini dari keterlambatan konfirmasi indikator.

## Validasi

```sh
node --test tests/engine-research.test.mjs tests/signal-engine.test.mjs
npm test
npm run lint
npm run build
```

Regresi mencakup expectancy/PF yang memburuk, winrate dengan impas, boundary leakage, penggunaan ulang holdout, bootstrap antar aset, kesetaraan input produksi, perbedaan hari kalender/sesi, data masa depan, flow hilang/stale/kontrak salah, arah dan guard tren, gap, serta scale-out Jurnal/replay.

Sumber: [arsip resmi Binance](https://github.com/binance/binance-public-data), [market-data Binance](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data), [riset backtest overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf). 13F dan COT tidak menjadi pemicu entry 1 jam dalam tahap ini.
