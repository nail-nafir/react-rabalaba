# Changelog

> 🇮🇩 Catatan versi & perubahan. Format [Keep a Changelog](https://keepachangelog.com/), semantik [SemVer](https://semver.org/).
> 🇺🇸 Version & change notes. Format [Keep a Changelog](https://keepachangelog.com/), [SemVer](https://semver.org/) semantics.

---

## [Unreleased]

### Changed (Dependensi, 2026-10-10)

- **Semua dependensi naik ke versi terbaru**: React 19.3, radix-ui 1.7, Vite 8.3, Recharts 3.10, zod 4.6, wrangler 4.149, dan sisanya; esbuild dan Supabase CLI tetap di-pin exact (0.28.2 dan 2.120.0). `npm audit` turun dari 22 ke 7 advisory, dan ketujuhnya satu masalah `braces` di CLI shadcn (dev saja) yang belum punya versi perbaikan. Vite 8.3 menggabungkan chunk yang memang dimuat di awal, jadi request JS awal turun dari 73 ke 19 dengan ukuran yang sama. Label tooltip chart jurnal diubah ke string karena Recharts 3.10 mengetiknya sebagai `ReactNode`. (`package.json`, `package-lock.json`, `journal-dashboard.tsx`)
- **TypeScript 7 untuk `tsc`**: type check penuh 0,9 detik, sebelumnya 5,9 detik. TS 7 belum punya API, jadi nama `typescript` tetap API TS 6 lewat `@typescript/typescript6` untuk typescript-eslint dan test. (`package.json`, `docs/02-technical-specs/01-tech-stack.md`)
- **TanStack Table 9**: semua tabel memakai `useAppTable` dari `createTableHook` resmi, dengan satu set fitur bersama (paginasi, sorting, dan hanya sorter yang dipakai sort `auto`). Sort, paginasi, lompat halaman, dan deep link `?trade=` berperilaku sama persis dengan v8. Compiler lint kini ikut memeriksa tabel, jadi ref harga live di tabel riwayat diberi pengecualian `react-hooks/refs`. (`src/hooks/use-app-table.ts`, `data-table-pagination.tsx`, 9 tabel, `eslint.config.js`)
- **API deprecated dibersihkan**: registry `sortFns` diganti impor `sortFn_*` satu per satu, `fetchQuery` diganti `query`, zod `.email()` diganti `.pipe(z.email())` dengan pesan error yang sama, dan Recharts `Cell` (dihapus di Recharts 4) diganti `fill` per data untuk donut dan `shape` untuk batang kategori. Kedua chart identik piksel per piksel dengan sebelumnya. Sisa satu, `verticalAlign` di `chart.tsx`, menunggu pembaruan registry shadcn. (`use-premium-access.ts`, `user-schema.ts`, `journal-dashboard.tsx`)
- **All dependencies on their latest versions**: React 19.3, radix-ui 1.7, Vite 8.3, Recharts 3.10, zod 4.6, wrangler 4.149, and the rest; esbuild and the Supabase CLI stay pinned exact (0.28.2 and 2.120.0). `npm audit` drops from 22 to 7 advisories, all seven being one `braces` issue in the shadcn CLI (dev only) with no patched release yet. Vite 8.3 merges chunks that load up front anyway, so the initial JS requests drop from 73 to 19 at the same size. The journal chart tooltip label is converted to a string because Recharts 3.10 types it as `ReactNode`. (`package.json`, `package-lock.json`, `journal-dashboard.tsx`)
- **TypeScript 7 for `tsc`**: a full type check takes 0.9 s, down from 5.9 s. TS 7 ships no API yet, so the `typescript` name stays the TS 6 API through `@typescript/typescript6` for typescript-eslint and tests. (`package.json`, `docs/02-technical-specs/01-tech-stack.md`)
- **TanStack Table 9**: every table uses `useAppTable` from the official `createTableHook`, with one shared feature set (pagination, sorting, and only the sorters `auto` sorting needs). Sorting, pagination, page jumps, and the `?trade=` deep link behave exactly as in v8. The lint compiler now checks the tables too, so the live price refs in the history table get a `react-hooks/refs` exception. (`src/hooks/use-app-table.ts`, `data-table-pagination.tsx`, 9 tables, `eslint.config.js`)
- **Deprecated APIs cleaned up**: the `sortFns` registry becomes individual `sortFn_*` imports, `fetchQuery` becomes `query`, zod `.email()` becomes `.pipe(z.email())` with the same error messages, and Recharts `Cell` (removed in Recharts 4) becomes per-datum `fill` for the donut and a `shape` for the category bars. Both charts match the previous render pixel for pixel. The one left, `verticalAlign` in `chart.tsx`, waits for the shadcn registry update. (`use-premium-access.ts`, `user-schema.ts`, `journal-dashboard.tsx`)

### Fixed (Tema toast, 2026-10-10)

- **Toast kini mengikuti tema app**: `sonner.tsx` membaca tema dari `next-themes` yang provider-nya tidak pernah dipasang, jadi toast `richColors` ikut tema OS (toast terang di app gelap). Kini memakai `useTheme` dari theme provider app sesuai panduan dark mode Vite shadcn, dan `next-themes` dihapus. (`src/components/ui/sonner.tsx`)
- **Toasts now follow the app theme**: `sonner.tsx` read the theme from `next-themes`, whose provider was never mounted, so `richColors` toasts followed the OS theme (light toasts on a dark app). It now uses `useTheme` from the app theme provider, as shadcn's Vite dark mode guide does, and `next-themes` is removed. (`src/components/ui/sonner.tsx`)

### Fixed (Animasi dialog, 2026-10-10)

- **Fade dialog tidak lagi hilang saat dibuka tutup berulang**: keyframes `enter`/`exit` bawaan tw-animate-css 1.4 ikut menganimasikan `filter: blur()`, jadi Chrome menjalankan fade di main thread dan fade 100ms habis setiap kali JS sibuk (paling terasa saat membuka ulang aset yang datanya sudah tersimpan). Keyframes kini ditimpa tanpa `filter`, jadi semua overlay (dialog, sheet, popover, tooltip) fade lewat compositor. (`src/index.css`)
- **Dialog Pasar dan Jurnal kini fade saat ditutup**: dialog `?symbol=` dan `?trade=` tetap terpasang, item terakhir ditahan selama animasi keluar, dan isi dialog baru dilepas setelah animasi selesai, jadi dialog tertutup tetap tidak memuat data. (`asset-detail-dialog.tsx`, `trade-detail-dialog.tsx`, `asset-signal-table.tsx`, `journal-terminal-content.tsx`)
- **Sparkline Sentimen Pasar tidak lagi digambar ulang di setiap navigasi**: kartu kini dimemo, jadi buka atau tutup dialog tidak lagi memicu sekitar 270 render animasi recharts di belakangnya. (`market-summary-row.tsx`)
- **Escape dua kali tidak lagi ikut mundur dari halaman**: dialog dari URL hanya menjalankan Back sekali per entri history, dan toast link tidak ditemukan tidak muncul ganda. (`src/hooks/use-dialog-param.ts`)
- **Dialog fades no longer vanish on repeated open and close**: tw-animate-css 1.4's `enter`/`exit` keyframes also animate `filter: blur()`, so Chrome ran the fade on the main thread and the 100 ms fade was used up whenever JS was busy (most visible when reopening an asset whose data was cached). The keyframes are now overridden without `filter`, so every overlay (dialog, sheet, popover, tooltip) fades on the compositor. (`src/index.css`)
- **Market and Journal dialogs now fade out on close**: the `?symbol=` and `?trade=` dialogs stay mounted, keep their last item through the exit animation, and release their content only once it ends, so a closed dialog still loads no data. (`asset-detail-dialog.tsx`, `trade-detail-dialog.tsx`, `asset-signal-table.tsx`, `journal-terminal-content.tsx`)
- **Market Pulse sparklines no longer redraw on every navigation**: the cards are memoized, so opening or closing a dialog no longer triggers about 270 Recharts animation renders behind it. (`market-summary-row.tsx`)
- **A double Escape no longer leaves the page**: URL dialogs run Back once per history entry, and the link-not-found toast no longer stacks. (`src/hooks/use-dialog-param.ts`)

### Added (Terminal & Learn, 2026-10-05)

- **Tab Pasar dan Jurnal kembali dan saling terhubung**: `/terminal` membuka Pasar, `/terminal/journal` membuka Jurnal, dan subjudul halaman menjelaskan tab yang aktif. Untuk premium, baris aset yang punya trade berjalan diberi chip `Jurnal · TP n/m` yang membuka trade itu, dialog aset punya tombol Lihat di Jurnal, dan dialog trade punya tombol Sinyal live di Pasar. Analisis live hanya ada di dialog aset Pasar; dialog trade Jurnal menampilkan setup dan chart trade itu saja. (`src/pages/terminal.tsx`, `src/features/market/components/asset-signal-table.tsx`, `src/features/trading-plan/components/asset-detail-dialog.tsx`, `src/features/follow-trade/components/trade-detail-dialog.tsx`)
- **Deep link untuk dialog dan tab**: `/terminal/market?symbol=BTC-USD`, `/terminal/journal?trade=<id>`, `/learn?tab=strategies&strategy=<id>`, dan `/learn?tab=patterns&pattern=<id>` langsung membuka dialognya; `/learn?tab=quiz` membuka tab ujian. Dialog yang dibuka dari halaman menambah satu langkah riwayat, jadi tombol Back browser menutupnya, dan tautan yang tidak ditemukan memunculkan toast. Trade di luar periode yang dimuat diambil per ID dengan RLS tetap berlaku. Progress bar halaman hanya untuk pindah halaman, tidak berkedip saat hanya query URL yang berubah; status memuat di dalam dialog kini terbaca screen reader (`role="status"`). (`src/hooks/use-dialog-param.ts`, `src/features/journal/hooks/use-journal-trades.ts`, `src/features/learn/components/learn-content.tsx`, `src/components/shared/page-loader.tsx`)
- **Market and Journal tabs are back and linked**: `/terminal` opens Market, `/terminal/journal` opens Journal, and the page subtitle explains the active tab. For premium, an asset row with a running trade gets a `Journal · TP n/m` chip that opens that trade, the asset dialog has a View in Journal button, and the trade dialog has a Live signal in Market button. The live analysis lives only in the Market asset dialog; the Journal trade dialog shows just that trade's setup and chart. (`src/pages/terminal.tsx`, `src/features/market/components/asset-signal-table.tsx`, `src/features/trading-plan/components/asset-detail-dialog.tsx`, `src/features/follow-trade/components/trade-detail-dialog.tsx`)
- **Deep links for dialogs and tabs**: `/terminal/market?symbol=BTC-USD`, `/terminal/journal?trade=<id>`, `/learn?tab=strategies&strategy=<id>` and `/learn?tab=patterns&pattern=<id>` open their dialog directly; `/learn?tab=quiz` opens the quiz tab. A dialog opened from the page adds one history step, so the browser Back button closes it, and a link that resolves to nothing shows a toast. A trade outside the loaded period is fetched by ID with RLS still applied. The page progress bar is for page changes only and no longer pulses when only the URL query changes; the loading status inside dialogs is now announced to screen readers (`role="status"`). (`src/hooks/use-dialog-param.ts`, `src/features/journal/hooks/use-journal-trades.ts`, `src/features/learn/components/learn-content.tsx`, `src/components/shared/page-loader.tsx`)

### Fixed (Dialog jurnal, 2026-10-05)

- **Chart dan header dialog kini searah untuk trade v7 yang kena stop setelah TP**: contoh GMT18069-USD mengamankan TP1 (50%) dan TP2 (30%), lalu sisa 20% kena stop yang sudah naik ke TP1, jadi header `TP 2/3` benar dan harga tutup memang di garis TP1. Penanda close di chart dan gambar share kini menulis cara keluar (`SL TP1`, `SL ENTRY`, `SL`, `TP3`, `REVERSAL`) alih alih `DITUTUP`, dan badge `Sempat TPn` hanya muncul bila TP tertinggi yang disentuh lebih tinggi dari TP yang diamankan, jadi `SEMPAT TP2` tidak lagi menempel di samping `TP 2/3`. Angka, donut, tabel, dan Discord tidak berubah karena sudah memakai aturan yang sama. (`src/features/follow-trade/model/follow-outcome.ts`, `src/features/follow-trade/components/follow-status.tsx`, `src/features/follow-trade/components/trade-detail-dialog.tsx`, `src/features/trading-plan/components/trade-setup-chart.tsx`, `src/features/trading-plan/model/share-card.ts`)
- **Chart and dialog header now agree for v7 trades stopped after a TP**: e.g. GMT18069-USD secured TP1 (50%) and TP2 (30%) before the last 20% hit the stop raised to TP1, so the `TP 2/3` header is right and the close price really is on the TP1 line. The close marker on the chart and share image now names the exit (`SL TP1`, `SL ENTRY`, `SL`, `TP3`, `REVERSAL`) instead of `CLOSED`, and the `Reached TPn` badge only shows when the highest TP touched beats the secured one, so `REACHED TP2` no longer sits next to `TP 2/3`. Numbers, the donut, the table and Discord are unchanged since they already share the rule. (`src/features/follow-trade/model/follow-outcome.ts`, `src/features/follow-trade/components/follow-status.tsx`, `src/features/follow-trade/components/trade-detail-dialog.tsx`, `src/features/trading-plan/components/trade-setup-chart.tsx`, `src/features/trading-plan/model/share-card.ts`)

### Fixed (Alert Discord, 2026-10-05)

- **Harga di atas 1,000 tidak lagi ambigu**: formatter mengganti semua koma jadi titik, jadi `84762.79` tampil `@84.762.79`. Kini harga memakai format en-US seperti terminal (`@84,762.79`, `@65,000`), dan persen yang membulat ke nol tampil `(0%)`, bukan `(+0%)` atau `(-0%)`. Format pesan lainnya tidak berubah. Perlu deploy ulang `auto-journal` dan `daily-summary`. (`src/core/automation/alerts.ts`)
- **Prices above 1,000 are no longer ambiguous**: the formatter turned every comma into a dot, so `84762.79` showed as `@84.762.79`. Prices now use the terminal's en-US format (`@84,762.79`, `@65,000`), and percentages that round to zero read `(0%)`, not `(+0%)` or `(-0%)`. The rest of the message format is unchanged. Redeploy `auto-journal` and `daily-summary`. (`src/core/automation/alerts.ts`)

### Changed (Statistik Jurnal & Performa Aset, 2026-10-03)

- **Tab periode mengikuti kalender dan periode jurnal**: 1H = hari ini, 1M = minggu ini (Senin sampai Minggu), 1B = bulan ini (tanggal 1 sampai akhir bulan), Semua = awal periode sampai sekarang, semuanya WIB. Data tidak pernah dimulai sebelum awal periode, jadi minggu yang dimulai di bulan lalu digambar dari tanggal 1 ("mulai dari tengah"), 1B terisi dari kiri (sebelumnya rentang bergulir 30 hari), dan jam atau hari yang belum tiba kosong, termasuk di 1H. Chart acuan, statistik, donut hasil transaksi, kinerja per kategori, dan Performa Aset kini memakai satu `journalWindow` yang sama (sebelumnya tiga salinan logika dengan jam lokal browser). Acuan BTC/Gold dinormalisasi dari harga pertama di rentang data. (`src/features/journal/model/journal-performance.ts`, `src/features/journal/components/journal-dashboard.tsx`, `src/features/journal/components/top-performers.tsx`, `src/features/journal/components/journal-terminal-content.tsx`)
- **Period tabs follow the calendar and the journal period**: 1H is today, 1M this week (Monday to Sunday), 1B this month (the 1st to its last day), All from the period start until now, all in WIB. Data never starts before the period start, so a week that began last month is drawn from the 1st, 1B fills from the left (it was a rolling 30-day window), and hours or days not reached yet stay empty, 1H included. The benchmark chart, stats, outcome donut, category bars and Asset Performance now share one `journalWindow` (previously three copies of the logic on the browser's local time). BTC/Gold benchmarks normalize from their first close inside the data span. (`src/features/journal/model/journal-performance.ts`, `src/features/journal/components/journal-dashboard.tsx`, `src/features/journal/components/top-performers.tsx`, `src/features/journal/components/journal-terminal-content.tsx`)

### Fixed (Kalender ekonomi, 2026-10-02)

- **FOMC dari Federal Reserve tampil lagi**: feed `calendar.json` Fed kini diawali BOM UTF-8 yang tidak dibuang runtime Cloudflare, jadi `JSON.parse` gagal dan sumber Fed selalu 502. Parser sekarang membuang BOM sebelum parse. (`src/features/economic-calendar/model/calendar.ts`, `functions/api/calendar/[source].ts`)
- **Yahoo lengkap, tanpa batas 100 event per hari**: endpoint `calendar-events` memotong hari sibuk (30 Sep 2026: 116 event, 16 hilang termasuk GDP QQ/YY Inggris). Yahoo kini diambil lewat `/api/calendar/yahoo?month=YYYY-MM` memakai API visualization Yahoo dengan crumb bersama; rentang yang balik penuh 250 baris dibelah waktu karena paging offset melewatkan event berjam sama. Status "Hasil terbatas" dihapus, dan konsensus dipetakan bila Yahoo mengisinya. (`functions/api/calendar/[source].ts`, `functions/api/_shared/yahoo.ts`, `src/features/economic-calendar/model/calendar.ts`, `src/services/api/calendar.ts`)
- **Seluruh zona euro ikut EUR**: Slovakia, Lituania, Latvia, Estonia, Kroasia, Slovenia, Luksemburg, Malta, Siprus, dan Bulgaria kini dipetakan ke EUR; sebelumnya 70 event Oktober dari empat negara pertama terbuang dari filter. (`src/lib/country.ts`)
- **The Federal Reserve FOMC schedule shows again**: the Fed `calendar.json` feed now starts with a UTF-8 BOM that the Cloudflare runtime keeps, so `JSON.parse` failed and the Fed source always returned 502. The parser now strips the BOM first. (`src/features/economic-calendar/model/calendar.ts`, `functions/api/calendar/[source].ts`)
- **Complete Yahoo data, no 100-per-day cap**: the `calendar-events` endpoint cut busy days (116 events on 30 Sep 2026, 16 lost including UK GDP QQ/YY). Yahoo now comes from `/api/calendar/yahoo?month=YYYY-MM` through Yahoo's visualization API with the shared crumb; a full 250-row answer is split in time because offset paging skips events that share a timestamp. The "Limited results" state is gone, and consensus is mapped whenever Yahoo fills it. (`functions/api/calendar/[source].ts`, `functions/api/_shared/yahoo.ts`, `src/features/economic-calendar/model/calendar.ts`, `src/services/api/calendar.ts`)
- **The whole euro area counts as EUR**: Slovakia, Lithuania, Latvia, Estonia, Croatia, Slovenia, Luxembourg, Malta, Cyprus and Bulgaria now map to EUR; the first four lost 70 October events to the filter before. (`src/lib/country.ts`)

### Changed (Kalender ekonomi, 2026-10-02)

- **Dua sumber saja**: Fed untuk jadwal resminya, Yahoo untuk rilis data AS (NFP, CPI, GDP, PCE) dan negara ekonomi besar yang disaring ke mata uang filter (USD, EUR, GBP, JPY, AUD, CNY, IDR), sekitar 571 dari 1.301 event per bulan (Oktober 2026). BLS (selalu 403) dan BEA dihapus. (`src/features/economic-calendar/model/calendar.ts`, `src/pages/calendar.tsx`)
- **Data Fed apa adanya**: semua jadwal yang dipublikasikan Fed tampil, bukan hanya FOMC: pidato dan testimoni pejabat, Beige Book, rilis statistik (H.15, H.4.1, G.17, dan lainnya), libur, dan konferensi. Rilis harian/mingguan dipecah jadi satu event per tanggal, entity dan tag HTML dibersihkan, dan deskripsi berisi topik · lokasi. Rilis statistik bertanda Low supaya H.15 harian tidak jadi katalis High. Route Fed kini wajib `?month=YYYY-MM` dan hanya mengirim jendela bulan itu (sekitar 85 event, bukan 7.099 event sejak 2017), dengan cache edge per bulan. (`src/features/economic-calendar/model/calendar.ts`, `functions/api/calendar/[source].ts`, `src/services/api/calendar.ts`)
- **`npm run dev` menjalankan Pages Functions asli**: satu plugin `pagesFunctionsDevPlugin` melayani `/api/yahoo/*` dan `/api/calendar/[source]` dengan `onRequest` yang sama seperti Cloudflare (tanpa cache edge). Plugin crumb Yahoo, plugin Fed, dan proxy Vite `/api/yahoo` dihapus. `vite preview` tidak lagi mem-proxy `/api/yahoo`; untuk build lokal lengkap pakai `npx wrangler pages dev dist`. (`vite.config.ts`)
- **Normalisasi kalender lebih ringan**: formatter `Intl` tanggal di-cache per zona waktu (sebelumnya dibuat ulang tiap event, ~22 µs per panggilan), jadi normalisasi Yahoo sebulan turun dari 13 sampai 19 ms ke sekitar 2 ms dan aman untuk batas CPU Worker. (`src/features/economic-calendar/model/calendar.ts`)
- **Two sources only**: the Fed for its official schedule, Yahoo for US releases (NFP, CPI, GDP, PCE) and major economies filtered to the filter currencies (USD, EUR, GBP, JPY, AUD, CNY, IDR), about 571 of 1,301 events per month (October 2026). BLS (always 403) and BEA were removed. (`src/features/economic-calendar/model/calendar.ts`, `src/pages/calendar.tsx`)
- **Fed data as published**: every schedule the Fed publishes shows, not only FOMC: officials' speeches and testimony, the Beige Book, statistical releases (H.15, H.4.1, G.17 and more), holidays and conferences. Daily/weekly releases become one event per date, HTML entities and tags are cleaned, and the description holds topic · venue. Statistical releases are rated Low so the daily H.15 never becomes a High catalyst. The Fed route now requires `?month=YYYY-MM` and only returns that month's window (about 85 events instead of 7,099 since 2017), with a per-month edge cache. (`src/features/economic-calendar/model/calendar.ts`, `functions/api/calendar/[source].ts`, `src/services/api/calendar.ts`)
- **Lighter calendar normalization**: `Intl` date formatters are cached per time zone (they were rebuilt for every event, ~22 µs per call), so normalizing a month of Yahoo events drops from 13 to 19 ms to about 2 ms and stays within the Worker CPU budget. (`src/features/economic-calendar/model/calendar.ts`)
- **`npm run dev` runs the real Pages Functions**: one `pagesFunctionsDevPlugin` serves `/api/yahoo/*` and `/api/calendar/[source]` with the same `onRequest` Cloudflare runs (no edge cache). The Yahoo crumb plugin, the Fed plugin and the Vite `/api/yahoo` proxy are gone. `vite preview` no longer proxies `/api/yahoo`; use `npx wrangler pages dev dist` for a full local build. (`vite.config.ts`)

### Changed (Empty state, 2026-10-02)

- **Semua empty state seragam**: kotak minimal 224px dari primitive `Empty` (kecuali kartu chart jurnal, halaman penuh, panel chat), ikon header tanpa override ukuran, error selalu `role="alert"` + `AlertCircle`, setiap empty state punya judul + deskripsi, dan setiap tombol aksi punya ikon (Coba lagi selalu `RefreshCw`). Tombol yang dibungkus trigger dialog kini ikut ter-style karena `EmptyContent` menargetkan `data-variant`. Test `tests/empty-state.test.mjs` menjaga resep ini. (`src/components/ui/empty.tsx`, 31 call site)
- **Satu teks error koneksi**: error muat data generik memakai `common.load_error_*` dengan judul netral "Data gagal dimuat"; 7 empty state yang hanya punya judul kini punya deskripsi. (`src/assets/locales/{id,en}.json`)
- **Every empty state matches**: 224px minimum box from the `Empty` primitive (except journal chart cards, full pages, the chat panel), header icons without size overrides, errors always `role="alert"` + `AlertCircle`, every empty state has a title + description, and every action button has an icon (Retry is always `RefreshCw`). Buttons wrapped in dialog triggers now get the shared style because `EmptyContent` targets `data-variant`. `tests/empty-state.test.mjs` guards the recipe. (`src/components/ui/empty.tsx`, 31 call sites)
- **One connection error copy**: generic load errors use `common.load_error_*` with the neutral title "Data failed to load"; the 7 title-only empty states now have a description. (`src/assets/locales/{id,en}.json`)

### Removed (Terminal, 2026-10-02)

- Key i18n dialog aset dan screener yang tidak terpakai lagi setelah dialog dan empty state diseragamkan (`market.data_unavailable*`, `dialog.market_error_*`, `dialog.close_action`), plus key kalender dan chat yang sudah usang.
- Asset dialog and screener i18n keys left unused once dialogs and empty states were unified (`market.data_unavailable*`, `dialog.market_error_*`, `dialog.close_action`), plus stale calendar and chat keys.

### Changed (Alert Discord, 2026-10-01)

- **Checkpoint TP1/TP2 di Discord**: trade yang masih open dan menyentuh TP mengirim blok `📍 CHECKPOINT` berisi TP yang kena, PARTIAL (leg yang ditutup, contoh `TP1 50%`), dan SL BARU (entry setelah TP1, TP sebelumnya setelah TP2). Alert baru terkirim setelah milestone tersimpan, jadi cron yang mengulang tidak mengirim dobel. (`src/core/automation/alerts.ts`, `src/core/automation/auto-journal-core.ts`, `supabase/functions/auto-journal/index.ts`)
- **HASIL trade v7 memakai PARTIAL, bukan SEMPAT**, jadi persen akhir yang lebih kecil dari pergerakan harga terlihat jelas asalnya; trade lama tanpa partial tetap memakai SEMPAT. (`src/core/automation/alerts.ts`)
- **TP1/TP2 checkpoints on Discord**: a still-open trade that reaches a TP sends a `📍 CHECKPOINT` block with the TP hit, PARTIAL (legs closed, e.g. `TP1 50%`), and SL BARU (entry after TP1, the previous TP after TP2). The alert goes out only after the milestone is saved, so a retried cron never double-sends. (`src/core/automation/alerts.ts`, `src/core/automation/auto-journal-core.ts`, `supabase/functions/auto-journal/index.ts`)
- **v7 RESULT lines use PARTIAL instead of SEMPAT**, so a final percent smaller than the price move shows where it came from; older trades without partials keep SEMPAT. (`src/core/automation/alerts.ts`)

### Fixed (Alert Discord, 2026-10-01)

- **`TP n/3` di Discord sama dengan dashboard**: alert close memakai `deriveFollowProgress` seperti badge dashboard, jadi trade v7 yang kena stop di entry setelah TP1 tertulis `TP 1/3`, bukan `TP 0/3`; tangga SL dipakai bersama lewat `activeStopFor`. (`src/core/automation/auto-journal-core.ts`, `src/core/trade/follow-trade-model.ts`)
- **Discord `TP n/3` matches the dashboard**: close alerts use `deriveFollowProgress` like the dashboard badge, so a v7 trade stopped at entry after TP1 reads `TP 1/3`, not `TP 0/3`; the stop ladder is shared through `activeStopFor`. (`src/core/automation/auto-journal-core.ts`, `src/core/trade/follow-trade-model.ts`)

### Changed (Pemindai Aset, 2026-10-01)

- **Urutan default tabel mendahulukan sinyal yang bisa ditindaklanjuti**: LONG/SHORT aktif paling atas, lalu kandidat yang menunggu candle eksekusi, lalu netral lain, terakhir Tidak tersedia; kekuatan besar ke kecil mengurutkan isi tiap grup (panah Sinyal ↓) dan klik header Kekuatan tetap memberi urutan murni kekuatan. (`src/features/market/components/asset-signal-table.tsx`, `src/core/automation/signal-episode.ts › compareTerminalSignal`)
- **Default table order puts actionable signals first**: active LONG/SHORT on top, then candidates awaiting the execution candle, then other neutral rows, then Unavailable; strength from high to low orders each group (Signal arrow ↓) and clicking the Strength header still gives a pure strength order. (`src/features/market/components/asset-signal-table.tsx`, `src/core/automation/signal-episode.ts › compareTerminalSignal`)

### Changed (engine v7, 2026-09-30)

- **Gate tren multi-timeframe**: LONG/SHORT hanya terbit di sisi yang sama dengan EMA200 candle sinyal, EMA200 timeframe atas, dan EMA50 harian (dari jendela 60d yang sama, tanpa fetch tambahan). Riset walk-forward holdout: expectancy −0,108R → +0,006R, reversal whipsaw 25% → ~6%. (`src/core/engine/signals.ts`, `src/core/market/candles.ts › deriveTrendAnchors`)
- **Partial TP 50/30/20 untuk trade v7**: tangga stop sama, akuntansi `computePnl` + SQL win rate publik memblend leg yang sudah terjual; backtest dialog memakai exit `scaleOut` yang sama. (`src/core/trade/follow-trade-model.ts`, `supabase/migrations/20260930000001_scale_out_public_win_rate.sql`)
- **Discovery mengikuti volume**: Binance quote volume (dengan cek harga per koin) dan Yahoo most-actives; CoinGecko trending dan day gainers dipensiunkan; baris admin tidak lagi memakan jendela shortlist. (`src/core/automation/asset-discovery-core.ts`, `supabase/functions/asset-discovery/index.ts`)
- **Multi-timeframe trend gate**: LONG/SHORT only publish on the same side as the signal-candle EMA200, higher-timeframe EMA200, and daily EMA50 (from the same 60d window, no extra fetch). Walk-forward holdout: expectancy −0.108R → +0.006R, reversal whipsaws 25% → ~6%. (`src/core/engine/signals.ts`, `src/core/market/candles.ts › deriveTrendAnchors`)
- **50/30/20 partial take profit for v7 trades**: same stop ladder; `computePnl` plus the public win-rate SQL blend the sold legs; the dialog backtest uses the same `scaleOut` exit. (`src/core/trade/follow-trade-model.ts`, `supabase/migrations/20260930000001_scale_out_public_win_rate.sql`)
- **Volume-led discovery**: Binance quote volume (with a per-coin price check) and Yahoo most-actives; CoinGecko trending and day gainers are retired; admin rows no longer consume the shortlist window. (`src/core/automation/asset-discovery-core.ts`, `supabase/functions/asset-discovery/index.ts`)

### Fixed (engine v7, 2026-09-30)

- **Replay jurnal dimulai dari candle yang memuat entry** (toleransi 5 menit), jadi SL/TP jam pertama tidak lagi terlewat; **IDX dan komoditas bisa entry lagi** lewat jendela 45 menit untuk feed Yahoo yang terlambat; **impas memakai toleransi 1e-9** di satu tempat; **mapping perp Binance** membuang suffix angka Yahoo (`PEPE24478-USD` → `1000PEPEUSDT`); copy keberhasilan tidak lagi menyebut impas dihitung. (`src/core/automation/auto-journal-core.ts`, `src/services/api/binance.ts`, `src/assets/locales/{en,id}.json`)
- **Journal replay starts at the candle holding the entry** (5-minute tolerance), so first-hour SL/TP hits are no longer skipped; **IDX and commodities can enter again** through a 45-minute window for lagging Yahoo feeds; **breakeven uses a 1e-9 tolerance** in one place; **Binance perp mapping** drops Yahoo numeric suffixes (`PEPE24478-USD` → `1000PEPEUSDT`); success-rate copy no longer claims breakeven counts. (`src/core/automation/auto-journal-core.ts`, `src/services/api/binance.ts`, `src/assets/locales/{en,id}.json`)

### Added

- **Overhaul dokumentasi profesional (2026-09-16)**: struktur rename deskriptif bernomor (`docs/01-fsd-spesifikasi-fungsional/`, `02-tsd-spesifikasi-teknis/`, `03-testing-pengujian/`, `04-ops-operasional/`, `05-penjelasan-explainer/`), pola bilingual sekuensial ID-penuh-lalu-EN-penuh dengan panjang setara, gaya Gen-Z santai tanpa pronomina standalone, diagram Mermaid di 14 file (arsitektur, data-flow, ER schema, cache proxy, sequence 3 cron, trust boundary, pie coverage, flowchart metodologi), dan rewrite total SDD auto-journal mengikuti engine v5 + episodes + progressive exit v4.
- **Professional documentation overhaul (2026-09-16)**: descriptive numbered structure (`docs/01-fsd-spesifikasi-fungsional/`, `02-tsd-spesifikasi-teknis/`, `03-testing-pengujian/`, `04-ops-operasional/`, `05-penjelasan-explainer/`), sequential full-ID-then-full-EN bilingual pattern with parity length, relaxed Gen-Z tone sans standalone pronouns, Mermaid diagrams in 14 files (architecture, data flow, schema ER, proxy cache, 3-cron sequence, trust boundary, coverage pie, methodology flowchart), plus total auto-journal SDD rewrite tracking engine v5 + episodes + progressive exit v4.

### Fixed

- **Angka kanonis dokumentasi dikunci**: 45 file / 422 case (`npm test`), 38 migrasi, 16 tabel, 28 RPC, `MIN_CALIBRATION_SAMPLE = 30`; durasi trial dinyatakan konfigurabel via `VITE_TRIAL_DURATION` (tanpa klaim fix 3/7 hari); typo flag `🇧🇧`/`🇮🇧` dikoreksi ke `🇺🇸`/`🇮🇩`; referensi `file:line` rapuh diganti format `file › fungsi`; email owner dan project ref hardcode disterilkan dari `supabase/README.md` menjadi placeholder.
- **Documentation canonical figures locked**: 45 files / 422 cases (`npm test`), 38 migrations, 16 tables, 28 RPCs, `MIN_CALIBRATION_SAMPLE = 30`; trial length stated configurable via `VITE_TRIAL_DURATION` (no fixed 3/7-day claim); `🇧🇧`/`🇮🇧` flag typos corrected to `🇺🇸`/`🇮🇩`; brittle `file:line` refs replaced with `file › function` format; hardcoded owner email plus project ref sterilized from `supabase/README.md` into placeholders.

### Added (previous)

- **Dokumentasi lengkap** bilingual (ID/EN): `docs/{fsd,tsd,testing,ops,explainer}/` + index `docs/README.md`, termasuk coverage inventory 35 file/325 case dan engine-internals mendalam.
- `README.md` project-specific (replace stock Vite template).
- `CONTRIBUTING.md` — onboarding, convention, branching, PR flow, secret rules.
- `CHANGELOG.md` — ini.

### Changed

- **Notifikasi Sonner kini lebih ringkas dan konsisten**: semua aksi memanggil Sonner langsung tanpa helper tambahan, sementara copy ID/EN diseragamkan menjadi satu baris tanpa deskripsi (`Sip`/`Nice`, `Waduh`/`Yikes`, `Santai`/`Chill`). (`src/`, `src/assets/locales/{en,id}.json`)
- **Keberhasilan di Pemindai Aset sekarang informatif untuk semua akun**, termasuk pengunjung dan akun gratis. UI menampilkan persentase beserta sampel menang/total dari agregat publik yang aman; data jurnal mentah tetap premium. State loading, tanpa sampel, dan gagal dimuat kini dibedakan dengan jelas. (`src/features/market/`, `src/components/charts/success-rate-bar.tsx`, `supabase/migrations/20260722025846_public_journal_success_rates.sql`)
- **Menu admin/owner di profile header disatukan** jadi "Kelola Sistem" (id) / "Manage System" (en) — action verb, destination-consistent, ikon `SlidersHorizontal`. Akses tetap khusus admin & owner (`isAdmin` wrapper + route guard `admin-layout.tsx` tidak diubah). Pemisahan owner/admin tetap di judul konsol internal (`admin-layout.tsx`) & label role per-asset (`journal-assets-table.tsx`). (`src/components/layout/user-menu.tsx`, `src/assets/locales/{en,id}.json`)
- **Browser direct call CoinGecko `/global` + Binance derivatives** (sebelumnya lewat proxy CF, kena 429 IP-shared). Tiap visitor pakai IP sendiri = quota terisolasi. Proxy CoinGecko/Binance tetap dipakai cron. (`src/services/api/{coingecko,binance}.ts`, `vite.config.ts`)
- **`.env.example` dibenerin** — hapus var legacy (`VITE_ACCESS_KEY`/`VITE_ACCESS_CODE`/`VITE_TRIAL_CODE`/`VITE_TRIAL_DURATION`) yang udah pindah ke DB `access_codes`. Sekarang cuma list `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Drift fix `docs/explainer/auto-journal-system-design.md` (Zustand→Redux) & `auto-journal-explained.md`/`server-vs-browser.md` (cron 15m→30m).
- Reorganize `docs/`: 3 legacy explainer dipindah ke `docs/explainer/`.

### Security

- RLS + RPC `SECURITY DEFINER` tetap jadi gate server-side (tidak ada perubahan). Lihat `docs/ops/security.md`.

---

## [0.0.0] — Initial baseline

🇮🇩 Baseline sebelum dokumentasi formal. Fitur yang udah shipped:

- Terminal screener (market pulse + tabel sinyal + asset detail dialog + share card)
- Trading engine 5-layer + 3 benchmark context + enrichment + backtest + calibration
- Auto-journal cron 30m + daily/weekly/monthly recap + asset-discovery daily
- Journal dashboard (equity curve, outcome donut, top performers, transactions)
- Economic calendar
- Auth (email/password + Google OAuth) + entitlement (free/trial/premium) + redeem + invite + subscription + disclaimer
- Admin console (users/assets/codes/invitations/plans/payments/disclaimer/statistics)
- 28 DB migrasi, 13 tabel, 22 RPC, RLS penuh
- 26 file test / 268 case (pure core)

🇺🇸 Baseline before formal documentation. Shipped features:

- Terminal screener (market pulse + signal table + asset detail dialog + share card)
- Trading engine 5-layer + 3 benchmark contexts + enrichment + backtest + calibration
- Auto-journal cron 30m + daily/weekly/monthly recap + asset-discovery daily
- Journal dashboard (equity curve, outcome donut, top performers, transactions)
- Economic calendar
- Auth (email/password + Google OAuth) + entitlement (free/trial/premium) + redeem + invite + subscription + disclaimer
- Admin console (users/assets/codes/invitations/plans/payments/disclaimer/statistics)
- 28 DB migrations, 13 tables, 22 RPCs, full RLS
- 26 test files / 268 cases (pure core)

---

## Konvensi / Conventions

| Header       | Arti / Meaning                                                          |
| ------------ | ----------------------------------------------------------------------- |
| `Added`      | Fitur baru / new features                                               |
| `Changed`    | Perubahan di fungsi/sistem existing / changes in existing functionality |
| `Deprecated` | Akan dihapus segera / soon-to-be removed                                |
| `Removed`    | Dihapus / removed                                                       |
| `Fixed`      | Bug fix                                                                 |
| `Security`   | Vulnerability / security-relevant                                       |

> 🇮🇩 **Cara nambah entry**: tiap PR/contribusi yang user-facing, tambah bullet di `[Unreleased]`. Saat rilis, pindah `[Unreleased]` → `[x.y.z] — YYYY-MM-DD` + buat `[Unreleased]` baru kosong.
> 🇺🇸 **How to add**: every user-facing PR/contribution, add a bullet under `[Unreleased]`. On release, move `[Unreleased]` → `[x.y.z] — YYYY-MM-DD` + start a fresh empty `[Unreleased]`.
