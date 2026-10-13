# Hasil audit engine — 12 Oktober 2026

**Tidak ada kandidat yang lolos development. Holdout tidak dibuka, dan konfigurasi produksi tidak diaktifkan.** Ini hasil pengujian parameter awal yang disepakati, bukan kesimpulan bahwa semua pendekatan flow tidak berguna.

## Jurnal aktual

Snapshot Supabase dibaca tanpa mengubah database: **4.912 trade selesai**, dipisahkan menurut versi engine. Cohort **v7 berisi 167 trade**, dengan entry pertama 1 Oktober dan exit terakhir 11 Oktober 2026 UTC. Dua trade yang exit-nya tersimpan beberapa detik sebelum entry tetap dihitung sesuai semantik awal candle dan toleransi existing. Angka ini menggantikan hitungan awal 165 trade.

| Cohort v7 | Trade | Winrate net | Expectancy gross | Estimasi net | Net biaya 2× |
|---|---:|---:|---:|---:|---:|
| Seluruh trade selesai | 167 | 20,96% | −0,495R | −0,572R | −0,648R |

| Kelas aset | Trade | Winrate net | Estimasi net R/trade |
|---|---:|---:|---:|
| Kripto | 94 | 21,28% | −0,495 |
| Saham ID | 36 | 22,22% | −0,711 |
| Saham US | 27 | 11,11% | −0,777 |
| Komoditas | 6 | 16,67% | −0,476 |
| Forex | 4 | 75,00% | +0,125 |

LONG: 98 trade, expectancy net −0,556R. SHORT: 69 trade, −0,594R. **Belum ada dasar untuk sekadar membalik arah.** Hasil strategi terbalik tidak dapat dihitung dengan membalik tanda P&L, karena entry, stop, target, biaya, dan waktu exit ikut berubah.

Cohort v7 baru mencakup sekitar sepuluh hari dan hanya trade yang sudah selesai. Trade terbuka belum masuk hitungan; kelas komoditas/forex sangat kecil. Ini belum estimasi stabil lintas regime.

## Diagnosis entry dan waktu publikasi

Input entry dapat direkonstruksi untuk **166/167 trade v7** menggunakan histori saat audit, bukan snapshot asli. Yahoo menolak histori panjang BREN.JK dengan HTTP 422; window 60d cukup untuk mengukur rentang trade, tetapi belum cukup untuk rekonstruksi lengkap entry-nya.

| Diagnosis v7 | Sampel | Temuan |
|---|---:|---|
| Ruang struktur <1R | 134 | Winrate 16,42%; expectancy net −0,648R |
| Ruang struktur ≥1R | 32 | Winrate 40,63%; expectancy net −0,239R |
| Extension >2 ATR | 59 | Winrate 8,47%; expectancy net −0,775R |
| Extension ≤2 ATR | 107 | Winrate 28,04%; expectancy net −0,455R |
| Publikasi >15 menit setelah candle keputusan ditutup | 42 | Expectancy net −0,677R |

Median jeda publikasi **17 detik**, persentil 90 **30 menit 17 detik**. Seluruh 42 trade dengan jeda >15 menit berasal dari saham ID (36) dan komoditas (6), sesuai kelas yang memiliki toleransi entry 45 menit existing. Jadi ini keterbatasan waktu publikasi yang terukur, belum bukti pelanggaran guard server. Jeda server/feed ini berbeda dari keterlambatan konfirmasi indikator. Range MFE/MAE tersedia untuk seluruh 167 trade sebagai batas dari candle, bukan urutan tick yang presisi.

Temuan di atas menunjukkan kelompok entry yang layak diselidiki. Angka tersebut bersifat deskriptif dan tidak membuktikan bahwa memblokir kelompok itu otomatis memperbaiki sistem; replay kandidat di bawah menguji perubahan urutan trade secara utuh.

## Eksperimen historis

Sampel berisi **25 aset, lima per kelas**, memakai ticker existing yang masih aktif. Ini mencakup semua kelas aset, belum seluruh universe dinamis. Batas protokol 16 Oktober 2025–11 Oktober 2026 UTC; 75% awal menjadi tiga fold development dan 25% terakhir disimpan sebagai holdout. Trade lintas batas dan penutupan paksa akhir data dikeluarkan dari seleksi.

Baseline memakai engine v7, episode sinyal, scale-out 50/30/20, dan window tanggal bursa. Parity fungsi terhadap payload adapter yang sama lulus untuk 25 aset. Historis tetap memiliki batas rekonstruksi window dan jadwal cron yang dijelaskan dalam [protokol riset](03-engine-research.md).

| Kandidat | Trade development | Winrate net | Net R/trade | Net R/trade biaya 2× | Keputusan |
|---|---:|---:|---:|---:|---|
| Baseline | 787 | 37,48% | −0,112 | −0,246 | Referensi |
| Ruang struktur ≥1R | 943 | 42,63% | −0,157 | −0,343 | Gagal |
| Extension ≤2 ATR | 878 | 37,93% | −0,098 | −0,250 | Gagal |
| Filter flow berlawanan | 787 | 37,48% | −0,112 | −0,247 | Gagal |
| Ganti 50% skor volume dengan flow | 774 | 36,56% | −0,123 | −0,258 | Gagal |
| Ganti 100% skor volume dengan flow | 763 | 36,70% | −0,122 | −0,257 | Gagal |

Filter bisa mengubah jumlah trade karena entry yang ditunda/dilewati mengubah kapan posisi berikutnya dapat dibuka. Kandidat bukan sekadar menghapus baris dari hasil baseline.

Filter ruang struktur menaikkan winrate **5,15 poin**, tetapi mengurangi expectancy **0,045R/trade**. Filter extension hanya menaikkan expectancy sekitar **0,014R**, di bawah target 0,05R, dan memburuk pada biaya 2×. Interval bootstrap mingguan untuk peningkatan expectancy seluruh kandidat masih mencakup nol. Tidak ada dasar aktivasi produksi atau pemilihan kandidat forward dari hasil ini.

## Flow dan batas data

Arsip resmi Binance menghasilkan **42.000 snapshot** untuk BTC, ETH, BNB, SOL, dan XRP: 8.400 dari 8.640 jam yang diminta per aset. OI dan harga memakai kontrak serta interval 24 jam yang sama; funding memakai interval asli. Checksum, schema, duplikasi, batas tanggal, dan timestamp divalidasi. Arsip harga/funding bulanan Oktober belum tersedia saat pengambilan, sehingga bagian itu tetap missing; development memiliki riwayat flow.

Publikasi flow dimodelkan terlambat satu jam dari timestamp observasi REST. Waktu kedatangan historis yang sebenarnya tidak tersedia. Ini perlu pencatatan forward sebelum produksi, bukan bukti bahwa flow tersebut selalu dapat diakses pada detik keputusan. Saham memakai proksi OHLCV harian, tanpa hari berjalan; komoditas/forex tidak diberi proksi volume buatan.

Biaya masih estimasi existing, belum memasukkan funding aktual, borrow, pajak, atau biaya tiap broker. Histori Yahoo dapat direvisi. Pengujian ini belum memodelkan seluruh penjadwalan cron, keterlambatan feed, eksekusi reversal, pembatasan modal, atau availability universe secara historis. Jurnal dan backtest menggunakan periode serta populasi berbeda; jangan membaca keduanya sebagai perbandingan performa langsung.

## Perubahan dan validasi

- Gate kini membandingkan kenaikan expectancy dan PF terhadap baseline, dengan pemeriksaan per kelas dan biaya 2×.
- Anchor riset memakai window yang sama dengan engine; seluruh aset memakai batas development/holdout yang sama.
- Replay scale-out disamakan dengan Jurnal ketika candle yang mencapai TP ditutup melewati stop yang baru dinaikkan.
- Flow bersifat opsional, sebelum penetapan arah; pemanggil produksi tetap tanpa opsi riset.
- Pemilihan hanya satu kandidat dan ledger holdout mencegah mencoba ulang tanggal yang sudah dibuka.

Uji regresi mencakup metrik, kebocoran masa depan, timestamp flow, kalender bursa, arah, gap, scale-out, dan isolasi kerusakan per kelas. `npm test`, lint, dan build dijalankan. Build tetap memberi peringatan ukuran chunk, tanpa kegagalan.

Artefak lokal yang dapat diperiksa:

- [Audit Jurnal lengkap](../../research.local/journal-complete/journal-audit.json)
- [Development, bootstrap, dan coverage](../../research.local/evaluation/development.json)
- [Konfigurasi kandidat: produksi nonaktif](../../research.local/evaluation/candidate.json)
- [Holdout: belum dibuka](../../research.local/evaluation/holdout.json)
- [Coverage arsip flow](../../research.local/crypto-flow.json.coverage.json)

Audit Jurnal lengkap di atas menggantikan hitungan Jurnal awal dalam folder eksperimen. Koreksi toleransi timestamp dan pelengkapan diagnosis tidak mengubah trade atau hasil kandidat historis.
