# Validasi persona dan badge Sensei

Tanggal: 12 Oktober 2026.

Implementasi prompt, helper badge, renderer, dan pemeriksaan yang direncanakan selesai. Uji model asli menunjukkan jawaban lebih ringkas, data setup tetap tepat, dan nada menyesuaikan permintaan serius atau kerugian. Pilihan gaya model masih memiliki variasi yang dicatat di bawah; kelulusan test kode tidak menjamin semua respons akan alami atau selalu benar.

## Pemeriksaan kode dan tampilan

- `npm test`: 526 test lulus, termasuk 6 test baru helper dan renderer Markdown asli.
- `npm run lint`: lulus.
- `npm run build`: lulus dengan peringatan ukuran chunk di atas 500 kB.
- Prompt langsung dan prompt sesudah tool memakai aturan persona/badge yang sama, model existing, dan temperature `0.4`.
- Alias, label beserta nilai, semicolon penutup, ticker bertanda baca, angka negatif, mata uang, persen, dan rasio tercakup. Pesan asli, prosa, tautan, serta blok kode tidak dinormalisasi.
- Renderer `AssistantMarkdown` asli diperiksa di Chromium pada 375/768/1440px, terang/gelap, saat streaming dan selesai. Sepuluh badge fixture tetap utuh tanpa overflow horizontal atau clipping. Backtick yang belum selesai tetap berupa teks sampai pasangan penutup tiba. Locale ID/EN dan blok kode memakai perilaku existing.
- Pemeriksaan browser memakai fixture dengan komponen, CSS, dan wrapper pesan existing, bukan sesi chat produksi dengan akun pengguna. Perangkat fisik dan browser lain belum diperiksa.
- Diff staged milik pengguna tetap utuh. Tidak ada perubahan style shared, model, temperature, API publik, database, atau logika trading.

## Perbandingan model asli

Workers AI `@cf/google/gemma-4-26b-a4b-it` dijalankan dengan temperature `0.4`, thinking nonaktif, streaming, dan batas 1.200 token existing. Sepuluh skenario serta percakapan lima giliran pada prompt awal dibandingkan dengan 15 respons prompt final. Lima kasus tambahan memeriksa risiko, kalkulasi short, dan pengecualian panjang untuk permintaan detail. Dua puluh respons final selesai tanpa error inferensi atau stream.

Alur memakai `streamChat`, handler `/api/chat`, validasi tool, dan parser SSE existing. Autentikasi serta kegagalan Yahoo disimulasikan di harness lokal. Data setup BTC adalah fixture sintetis: entry 100, stop 95, TP1 110, arah long. Tidak ada data akun atau posisi pengguna yang dikirim. Riwayat memakai pembatasan panjang pesan existing.

Respons baseline tersimpan di bagian `before` dari `sensei-validation.local/comparison.json`. Respons prompt final beserta hash prompt ada di `sensei-validation.local/verified-final.json` dan `sensei-validation.local/verified-risk.json`. Artefak lokal ini tidak masuk Git. Hasil iterasi sebelumnya bukan bukti untuk prompt final. Satu sesi remote sempat timeout sebelum inferensi; pengulangan berhasil dan timeout itu tidak dihitung sebagai respons model.

Jumlah kata berikut dihitung dengan pemisah whitespace, termasuk markup. Perbandingan adalah sampel manual satu kali per skenario, bukan pengujian statistik atau penilaian buta.

| Skenario | Sebelum → sesudah | Temuan prompt final |
| --- | --- | --- |
| Definisi RR | 171 → 48 kata | Prosa singkat, tanpa level entry/SL/TP rekaan atau badge. |
| FOMO yang dinyatakan pengguna | 176 → 75 | Satu roasting keputusan, diikuti pemeriksaan stop dan nominal risiko. Celetukan masih menyalin contoh prompt. |
| Disiplin melewatkan entry | 98 → 56 | Nada mendukung tanpa janji profit. |
| Panik karena rugi | 177 → 76 | Tenang, tanpa roasting, ketawa, atau seruan religius. |
| Permintaan serius | 273 → 89 | Perbedaan stop loss dan likuidasi dijelaskan tanpa tabel berulang atau humor. |
| Kalkulasi eksplisit | 8 → 11 | Tool tervalidasi dipanggil, lalu menghasilkan `Risk reward 1:2` dan menyebut sebelum biaya. |
| Analisis aset | 47 → 44 | Angka snapshot dan badge `Entry 100`, `Stop loss 95`, `TP1 110` tepat. Tidak menambahkan chart tanpa diminta. |
| Data tidak tersedia | 26 → 19 | Lookup gagal diteruskan ke model; respons tidak mengarang harga. |
| Chart yang diminta | 3 → 25 | JSON kontrak setup memakai simbol fixture, tanpa seri harga buatan. |
| English | 87 → 51 | Tetap English, tanpa slang Indonesia. |
| Tindak lanjut overtrade dengan nada serius | 370 → 127 | Tanpa roasting, tetapi masih melewati arahan panjang default dan memakai satu pertanyaan penutup. |
| Apakah loss Jurnal membuktikan FOMO pribadi? | 354 → 63 | Membedakan catatan riset otomatis dari trade yang benar-benar diambil pengguna. |
| Penutup satu kalimat | 19 → 19 | Mematuhi satu kalimat dan memakai catatan trading pribadi. |

Percakapan lima giliran mempertahankan konteks, tidak mengulang greeting pada setiap giliran, dan menolak anggapan RR menjamin profit. Median panjang seluruh 15 respons turun dari 171 menjadi 51 kata.

Lima kasus tambahan pada prompt final:

- **Stop loss menjamin rugi maksimal 1%:** respons menolak jaminan tersebut dan menyebut slippage, gap, biaya, serta harga eksekusi stop market yang tidak dijamin.
- **Likuidasi selalu menghabiskan seluruh margin:** respons menjelaskan hasil bisa sebagian atau seluruhnya, bergantung instrumen, mode margin, dan eksekusi.
- **RR 1:1 otomatis jelek:** respons menolak generalisasi tersebut dan menghubungkannya dengan winrate. Contoh singkat belum menyebut ongkos secara eksplisit, meski prompt memintanya saat relevan.
- **Short entry 200, stop 208, target 176:** tool menghitung risiko 8, potensi reward 24, dan RR 1:3 dengan benar; jawaban 13 kata.
- **Permintaan evaluasi setup secara detail:** jawaban 298 kata dengan langkah invalidasi, eksekusi, dan evaluasi. Ini membuktikan arahan singkat tidak menjadi pemotongan keras atau format tetap. Jurnal riset dan catatan perilaku pribadi dibedakan.

## Batas kualitas dan rilis

Normalisasi badge deterministik dan hanya memengaruhi tampilan. Pemilihan isi, format, humor, dan tool oleh model tetap probabilistik. Arahan maksimal 80 kata adalah default prompt, bukan batas program: dua balasan biasa pada sampel final masih 89 dan 127 kata. Model juga sesekali menyalin celetukan contoh, mengulang label di luar badge, atau memberi inline code pada konsep umum. Pada satu saran overtrade, istilah “evaluasi Jurnal” masih generik; pertanyaan eksplisit berikutnya dan panduan detail sudah membedakan Jurnal otomatis dari catatan pribadi.

Penjelasan risiko diperjelas setelah iterasi awal terlalu mutlak. Harga trigger stop bukan jaminan harga eksekusi; stop limit dapat tidak terisi. [SEC Investor Bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15). Likuidasi dapat bersifat sebagian atau penuh dan hasilnya bergantung ketentuan produk. [Coinbase risk management and liquidations](https://help.coinbase.com/en/coinbase/derivatives/us-derivatives-risk-management-and-liquidations). Uji fokus di atas memeriksa koreksi tersebut, bukan menjamin seluruh penjelasan finansial model akan selalu lengkap.

Tidak ditambahkan pemotongan jawaban, classifier intent, skrip balasan tetap, dependency, atau komponen badge baru. Pemeriksaan penuh melalui login produksi dan deployment belum dilakukan. Rilis prompt dan renderer bersama melalui Cloudflare Pages beserta `/api/chat`; tidak perlu migrasi database atau deploy Supabase Edge Function.
