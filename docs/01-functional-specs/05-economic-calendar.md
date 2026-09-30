# FSD 05 — Economic Calendar

> Implementasi: 2026-09-27. **Rilis integrasi BLS ditahan**: HTTP 403 juga terjadi dari preview Cloudflare Workers. BEA dan Fed berhasil (HTTP 200). Belum dideploy ke produksi.

## Bahasa Indonesia

`/calendar` tetap publik. Jadwal resmi AS dan Yahoo diambil paralel; kegagalan satu sumber tidak menghapus event sumber lain. Tidak ada database, API key baru, atau dependensi baru.

| Sumber | Feed resmi | Cakupan |
|---|---|---|
| BLS | [ICS](https://www.bls.gov/schedule/news_release/bls.ics) | Jadwal publikasi termasuk CPI, Employment Situation/NFP, PPI, JOLTS; akses runtime masih 403 |
| BEA | [JSON publik](https://apps.bea.gov/API/signup/release_dates.json) | GDP, Personal Income and Outlays/PCE, dan publikasi BEA lainnya |
| Federal Reserve | [JSON kalender](https://www.federalreserve.gov/json/calendar.json) | FOMC meeting/keputusan, press conference, minutes |
| Yahoo Finance | `/api/yahoo/ws/screeners/v1/finance/calendar-events` | Pelengkap global, dengan `countPerDay=100` |

### Data dan batas cakupan

- `functions/api/calendar/[source].ts` menerima GET untuk `bls`, `bea`, `fed` saja. Host upstream tetap; query dan method lain ditolak. Respons dinormalisasi dan divalidasi sebelum masuk cache proyek: fresh 30 menit, stale tambahan 6 jam, timeout 8 detik termasuk pembacaan body. HTTP 403/429/5xx atau respons rusak dapat memakai cadangan terakhir; tidak ada jadwal tebakan.
- `CalendarEvent` membawa `timestamp` UTC dalam milidetik (`null` bila jam tidak diumumkan), `source`, `sourceUrl`, serta `date` dan `time` WIB. Jadwal dengan tanggal saja mempertahankan tanggal yang diumumkan sumber dan menampilkan “Jam belum diumumkan”; tanggal WIB tepatnya belum dapat ditentukan tanpa jam.
- BLS parser mendukung event eksplisit UTC/TZID, date-only, line folding, UID/revisi/cancellation. Floating time dan recurrence ditolak. Parser diuji memakai contoh sintetis dengan tanggal rujukan resmi; format feed BLS aktual belum terverifikasi karena 403. Jangan meluncurkan BLS sebelum feed asli berhasil diparse di Cloudflare.
- BEA membuang tanggal duplikat dalam satu publikasi. Fed memakai hari keputusan dan jam yang diterbitkan, bukan menebak jam dari tanggal awal rapat dua hari. Konversi Eastern Time menggunakan `America/New_York` agar DST benar.
- Publikasi resmi menggantikan seri Yahoo untuk keluarga yang dikenal dan bulan rilis AS yang sama: CPI, employment, PPI, JOLTS, GDP, PCE, corporate profits, international transactions, FOMC. Ini juga menyingkirkan jadwal Yahoo lama jika tanggal resmi berubah dalam bulan yang sama. Publikasi negara bagian, ADP, dan Dallas Fed tidak digabung. Alias publikasi lain yang belum dikenal tetap terpisah.
- Actual/forecast/previous Yahoo tidak ditempelkan ke publikasi resmi. BEA/BLS/Fed adalah sumber jadwal; ketiga nilainya kosong. Yahoo menyediakan actual/prior bila ada, tanpa forecast. Nilai `0` dipertahankan; nilai hilang ditulis “Tidak tersedia dari sumber”. Label impact dan relevansi aset adalah heuristik aplikasi, bukan metadata resmi.
- Yahoo ditandai parsial bila `records.length < totalCount` di salah satu kelompok harian. Menaikkan cap tidak menjamin kelengkapan historis atau global.

### Tampilan dan query

`useEconomicCalendar(month)` memakai key `['economic-calendar', month]`, staleTime/refetchInterval 30 menit. Request mencakup bulan WIB dan minggu di kedua tepinya agar minggu lintas bulan/besok tetap tersedia. Filter Bulan Ini membatasi ke bulan aktif.

Agenda, jumlah mingguan, dan katalis menggunakan filter mata uang/impact/aset/pencarian yang sama. Katalis hanya memilih high-impact dengan timestamp mendatang. Hari Ini/Besok mengikuti pergantian hari WIB; minggu dimulai Senin, termasuk saat hari Minggu; posisi ribbon direset ketika minggu atau bulan berganti. Tanggal manual tetap pilihan pengguna.

Status sumber membedakan tersedia, hasil terbatas, tidak tersedia, dan data lama, dengan tautan serta waktu pemeriksaan. Jika semua sumber gagal, tampil error/retry; jika sebagian gagal, data yang berhasil tetap muncul beserta peringatan cakupan. Cadangan lewat batas umur tidak ditampilkan. Dialog, clipboard, pengelompokan, serta countdown memakai tanggal/jam yang sama. Kontrak konteks chatbot tetap: maksimal lima event dengan field lama dan tanggal/jam ternormalisasi; sumber/timestamp tidak menambah field wire.

### Verifikasi dan pengembangan

Jalankan `npm run wrangler` untuk Vite + Pages Functions di port 8888, atau `npm run build` lalu `npx wrangler pages dev dist --port 8888`. Vite saja (`npm run dev`) tidak menyediakan route resmi Pages.

```sh
node --test tests/calendar.test.mjs tests/proxy.test.mjs tests/chat.test.mjs tests/chat-ui.test.mjs tests/empty-state.test.mjs tests/i18n.test.mjs
npm run lint
npm run build
```

Rujukan tanggal pada [kalender BLS September 2026](https://www.bls.gov/schedule/2026/09_sched.htm): Employment Situation 4 Sep 08:30 ET → 19:30 WIB; CPI 11 Sep 08:30 ET → 19:30 WIB; JOLTS 1 dan 29 Sep 10:00 ET → 21:00 WIB. Ini verifikasi jadwal sumber, **bukan** bukti feed BLS berhasil diintegrasikan. Tidak ada tanggal ini yang ditanam ke aplikasi.

Preview Cloudflare 27 Sep 2026: BEA memuat 136 jadwal, termasuk GDP dan Personal Income and Outlays 30 Sep 19:30 WIB; Fed memuat 135 jadwal FOMC, termasuk keputusan 17 Sep 01:00 WIB dan press conference 01:30 WIB. BLS tetap 403. Ulangi preflight BLS sebelum rilis, verifikasi feed asli dan parser, dan pertahankan status cakupan parsial selama belum tersedia.

## English

The public calendar combines official US schedules with Yahoo global events. The allowlisted `/api/calendar/:source` Pages route normalizes BLS ICS, BEA JSON and Fed JSON, using the existing proxy cache (30 minutes fresh plus 6 hours stale) and an 8-second timeout. No database, new dependencies or API keys are required.

Events carry explicit UTC milliseconds, source and source link. WIB dates/times are consistent across filtering, grouping, dialogs and countdowns. Eastern times use IANA DST rules. Date-only releases preserve the announced source date, display “Time not announced” and never start a countdown. They cannot be assigned an exact WIB day until a time is published.

Known official publication families replace Yahoo series in the same US release month, including within-month reschedules. Different numeric series are never merged into an official publication. Official feeds supply schedules without actual/consensus/prior values; Yahoo actual/prior are used only when present. Missing values are explicit, and impact/asset labels are app estimates.

The month is part of the query key. Edge weeks are included; the current-month preset filters them back out. The weekly ribbon, agenda and next catalyst share currency/impact/asset/search filters. The catalyst requires a future timestamp. WIB midnight, Sunday, month and year boundaries are covered. The existing five-event chatbot context schema stays unchanged.

Source status, check time and links distinguish empty, failed, partial and stale data. Yahoo requests 100 events per day and compares each returned group with its total; this does not guarantee full coverage. All-source failures show retry; successful sources remain usable when another fails. Expired cache entries are hidden.

**Release gate:** the 2026-09-27 Cloudflare remote preview returned BEA/Fed 200 and BLS 403. BLS parser tests use synthetic ICS and independently checked official schedule dates; its live ICS format is still unverified. Hold the BLS rollout, repeat the actual Cloudflare fetch/parser check before release, and never claim complete US coverage or substitute guessed dates. No production deployment was performed. Local full-stack development and regression commands are listed above.
