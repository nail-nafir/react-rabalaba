# FSD 00 — Ikhtisar Produk / Product Overview

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Terminal, Engine, Jurnal, Kalender, Auth, Admin, Testimoni

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

RabaLaba merupakan terminal riset trading multi-aset untuk kripto, saham USA, saham Indonesia, komoditas, dan forex. Terminal menerbitkan sinyal swing 1 jam plus rencana trading TP/SL plus jurnal otomatis. Alur sat-set dari data pasar sampai jurnal tertata rapi.

Produk berfungsi sebagai pendukung keputusan, bukan broker, bukan bot eksekusi, bukan penasihat keuangan. Sinyal mencerminkan keselarasan teknikal, bukan janji profit. Rencana trading berfungsi sebagai referensi, bukan order.

Stack memakai React 19 plus Vite 8 plus Supabase plus Cloudflare Pages. Cron auto-journal berjalan tiap 30 menit. Rekap harian berjalan hourly dengan self-gate WIB. Discovery aset berjalan daily.

- Basis uji: 45 file dengan 422 kasus.
- Migrasi: 38 file skema.
- Skema: 16 tabel plus 28 RPC.
- Kalibrasi butuh sampel minimal MIN_CALIBRATION_SAMPLE = 30.
- Durasi trial konfigurabel via VITE_TRIAL_DURATION tanpa default bawaan.

## 🇮🇩 Persona dan Hak Akses

Akses premium dan admin ditegakkan di server via RLS plus RPC SECURITY DEFINER. Browser hanya membaca profil sendiri. Jurnal mentah tetap premium; agregat publik tetap terbuka.

| Persona | Akses Server | Kemampuan |
|---|---|---|
| Anonim | free | Lihat landing, screener default, kalender, subscription |
| Trial | trial via kode/invite | Buka premium plus jurnal, universe DB, favorit, tambah ticker |
| Premium | premium via kode/invite/grant | Sama seperti trial tanpa kedaluwarsa |
| Admin | is_admin | Kelola akun, universe, kode, invite, plan, payment, disclaimer |
| Owner | is_owner | Sama seperti admin plus judul konsol Owner |

Trial kedaluwarsa otomatis kembali ke free saat wall-clock melewati batas.

## 🇮🇩 Peta Rute

Router memakai createBrowserRouter dengan lazy page. Guard premium bersifat soft; guard admin bersifat keras.

| Rute | Komponen | Penjagaan |
|---|---|---|
| / | LandingPage | Publik |
| /terminal, /terminal/market | TerminalPage tab Pasar; `?symbol=<SYMBOL>` membuka dialog aset | Publik |
| /terminal/journal | TerminalPage tab Jurnal; `?trade=<id>` membuka dialog trade | Premium; non premium melihat kartu Premium Terkunci plus dialog lisensi |
| /learn | Edukasi; `?tab=patterns\|strategies\|quiz`, `&pattern=<id>` atau `&strategy=<id>` membuka dialognya | Publik |
| /calendar | CalendarPage | Publik |
| /subscription | SubscriptionPage | Publik |
| /invite/:code | InvitePage | Klaim saat auth |
| /admin/* | Admin pages | Keras ke root bila non-admin |
| /login, /register, /auth/callback | Auth pages | Publik plus OAuth PKCE |
| * | NotFoundPage | Publik |

## 🇮🇩 Fitur Inti

Delapan fitur membentuk alur riset sampai jurnal. Diagram kanonis tersimpan di TSD signal-flow.

| Fitur | Dokumen | Sorotan |
|---|---|---|
| 1 Terminal screener | FSD 01 | Pulse, tabel sinyal, dialog detail, chart setup, share card |
| 2 Trading engine | FSD 02 | Pipeline 5-layer, regime, 3 benchmark, enrichment, backtest, kalibrasi |
| 3 Auto-journal | FSD 03 | Cron 30 menit, emit plus close, Discord alert |
| 4 Journal dashboard | FSD 04 | Kurva ekuitas, donut outcome, top performer, tabel transaksi |
| 5 Kalender ekonomi | FSD 05 | Event bulan berjalan, badge impact, dialog detail |
| 6 Auth entitlement | FSD 06 | Login OAuth, tier server-truth, redeem, invite, disclaimer |
| 7 Admin console | FSD 07 | Akun, aset, kode, invite, plan, payment, disclaimer, statistik |
| 8 Testimoni | FSD 08 | Satu per akun, moderasi, enam slot landing |

### Bantuan pada judul halaman

Lima menu utama (Terminal, Kalender, Kalkulator, Edukasi, Langganan) memiliki ikon info di samping judul besar halaman, di luar `<h1>`. Komponen bersama `PageHelp` memakai Button dan satu Tooltip yang tersedia, dengan copy ID/EN pada `page_help`. Hover, fokus, klik/tap, dan Enter/Space membuka bubble yang sama. Style mengikuti tooltip footer sentimen pasar: teks 12px, lebar maksimal 220px, `leading-relaxed`, warna, padding, radius, dan panah bawaan. Posisi atas dan tengah menyesuaikan collision dengan jarak viewport 16px. Delay mengikuti provider global. Escape, blur, dan interaksi di luar menutup bubble. Fokus terlihat dan reduced motion didukung. Isi bantuan hanya satu paragraf ringkas tanpa detail sumber atau kontrol interaktif. Copy memakai bahasa santai tanpa dash, semicolon, atau kata ganti orang. Setiap deskripsi memiliki dua kalimat dan maksimal 80 karakter; selisih panjang seluruh deskripsi lima halaman dalam ID/EN maksimal 10%. Target sekitar tiga baris pada ukuran font normal, tanpa tinggi tetap, pemotongan teks, atau `line-clamp`. Teks dapat membungkus lebih panjang saat font diperbesar. Judul dapat membungkus di layar kecil. Bantuan Terminal mengikuti ringkasan pasar dan jurnal yang tampil, dan bantuan Langganan tidak menyimpan harga atau masa aktivasi secara statis. Tooltip widget lainnya tetap menggunakan copy yang ada.

### Konteks dan gaya bahasa Sensei

Membuka atau menutup dialog transaksi tidak memasang konteks aset. Tombol bot pada dialog mengirim snapshot setup secara eksplisit dan menutup dialog sebelum membuka Sensei. Pembukaan melalui launcher global atau `Shift+/` melepas konteks dialog aktif sambil mempertahankan riwayat dan draft. Pesan baru tidak mengambil snapshot aset dari pesan terdahulu; chart dan retry pesan lama tetap memakai snapshot pesan tersebut. Lookup aset yang ditanya lewat chat tetap menghasilkan badge aset, dengan disclosure multi aset `+N` dan style komponen yang sama.

Kalender, Kalkulator, dan Edukasi tetap mengirim snapshot halaman aktif sebagai data untuk bot tanpa badge halaman. `Chat baru` menghapus riwayat, draft, dan konteks aset serta hasil lookup, tetapi mempertahankan snapshot halaman aktif. API dan kontrak konteks tidak berubah. Panduan produk dalam system prompt menjelaskan fungsi halaman utama, akses akun, favorit, pembayaran, dan kode akses tanpa mengarang harga, hak akses, atau data akun dinamis.

Bahasa Indonesia Sensei memakai suara Gen Z Jaksel dengan roasting pedas adaptif, slang, ketawa singkat, dan ungkapan Islami ketika sesuai situasi, tanpa kuota atau asumsi agama pengguna. Humor hanya menyasar keputusan trading yang disebut pengguna, bukan menyimpulkan FOMO, kepemilikan, atau kerugian pribadi dari Jurnal riset otomatis. Permintaan serius, ketidaknyamanan terhadap nada, serta kerugian yang membuat pengguna tertekan mendapat respons tenang tanpa roasting, ketawa, atau seruan religius. Jawaban langsung ke inti dan panjangnya mengikuti kebutuhan, tanpa urutan bagian wajib atau pengulangan sapaan, lelucon, disclaimer umum, dan tawaran lanjutan. Contoh definisi, FOMO, kalkulasi, kerugian, dan tindak lanjut menjadi panduan, bukan skrip. Seluruh balasan mengikuti bahasa pesan pengguna terbaru, termasuk judul dan label menu; contoh Indonesia tidak mengubah balasan English menjadi Indonesia. Ketepatan fakta dan risiko tetap utama, tanpa emoji, dash dalam prosa, atau semicolon. Gaya model dinilai melalui percakapan nyata; test dengan mock hanya memverifikasi prompt dan alur data.

Prompt mengarahkan balasan biasa ke maksimal 80 kata, dengan pengecualian untuk permintaan detail, langkah bertahap, atau analisis beberapa bagian. Ini arahan model, bukan pemotongan teks di aplikasi. Definisi memakai prosa tanpa level harga rekaan. Penjelasan risiko membedakan rencana stop dari harga eksekusi yang tidak dijamin, serta likuidasi sebagian/penuh sesuai instrumen dan mode margin.

Inline Markdown menandai data inti yang relevan sebagai `Badge` existing: ticker dari konteks, status sinyal/tier, Entry, TP, Stop loss, Risk reward, dan angka risiko. Label dan nilai dapat menyatu dalam satu badge ringkas. Renderer merapikan alias yang dikenal seperti `stop_loss`, `entry_price`, `take_profit_1`, dan `risk_reward_ratio`, serta separator label/nilai dan semicolon penutup. Ticker dikenali terlebih dahulu; tanda minus, pemisah angka, mata uang, persen, dan titik dua rasio tetap utuh. TP/SL dan status memakai warna semantik existing, metrik lainnya warna netral existing. Konsep, lelucon, dan kalimat tetap prosa atau penekanan biasa. Normalisasi hanya pada tampilan badge, tidak mengubah pesan asli, payload tool, chart JSON, link, atau blok kode.

Model dan temperature `0.4` tetap. Perubahan prompt dan renderer dirilis bersama melalui Cloudflare Pages beserta `/api/chat`, tanpa migrasi database, profil personalisasi tersimpan, atau deployment Supabase Edge Function.

Kepatuhan gaya model tetap perlu dievaluasi terpisah dari renderer. [Hasil validasi persona dan badge](../03-testing/05-sensei-persona-validation.md) mencatat pemeriksaan kode/browser serta batas kualitas respons model asli.

## 🇮🇩 Glosarium

Istilah kunci menjaga bahasa seragam lintas dokumen. Definisi ringkas tampil di bawah.

| Istilah | Definisi |
|---|---|
| Swing 1h | Timeframe default: range 60 hari, interval 1 jam |
| Signal | LONG/SHORT/NEUTRAL plus strength 0-100 plus grade A/B/C |
| Strength | Skor alignment teknikal, bukan probabilitas menang |
| Tier | A kuat, B sedang, C lemah via TIER_THRESHOLDS |
| Regime | trending/ranging/high_volatility/low_volatility dari Layer 1 |
| Context | Status risk benchmark: BTC, IHSG+USDIDR, S&P+VIX+DXY |
| Enrichment | Context de-rate; smart-money/accumulation/relative/fundamental display-only |
| Followed trade | Trade snapshot dengan TP/SL aktif dipantau cron |
| Journal parity | Setiap sinyal fresh actionable tercatat saat snapshot cron |
| Calibration | Hit-rate historis per tier+regime, sampel minimal 30 |
| Universe | Daftar aset: free konstanta, premium DB single-source |
| Edge engine | Core murni di browser plus cron Deno single-source |

## 🇮🇩 Batasan Produk

Produk bukan broker, bukan bot eksekusi, bukan penasihat keuangan. Data pasar memakai delay Yahoo. Disclaimer resmi tersimpan di DB.

Sinyal berarti alignment teknikal. Rencana berarti referensi. Keputusan akhir tetap pada operator akun.

## 🇮🇩 Tautan Terkait

- Terminal: docs/01-functional-specs/01-terminal-screener.md
- Diagram: docs/02-technical-specs/08-signal-flow-diagrams.md
- Testing: docs/03-testing/
- Operasional: docs/04-operations/
- Metodologi: docs/05-explainers/00-trading-methodology.md

---

<a id="english-part"></a>

## 🇺🇸 Summary

RabaLaba serves as multi-asset trading research terminal for crypto, USA stocks, Indonesia stocks, commodities, plus forex. Terminal publishes 1h swing signals plus TP/SL trade plans plus automated journal. Deep-dive flow from market data to tidy journal remains neat.

Product functions as decision support, not broker, not execution bot, not financial adviser. Signals reflect technical alignment, not profit promise. Trade plans function as reference, not orders.

Stack uses React 19 plus Vite 8 plus Supabase plus Cloudflare Pages. Auto-journal cron runs every 30 minutes. Daily recap runs hourly with WIB self-gate. Asset discovery runs daily.

- Test basis: 45 files with 422 cases.
- Migrations: 38 schema files.
- Schema: 16 tables plus 28 RPCs.
- Calibration needs minimum sample MIN_CALIBRATION_SAMPLE = 30.
- Trial duration configurable via VITE_TRIAL_DURATION with no built-in default.

## 🇺🇸 Personas and Entitlements

Premium plus admin access remains enforced on server via RLS plus SECURITY DEFINER RPCs. Browser only reads the own profile row. Raw journal remains premium; public aggregates remain open.

| Persona | Server Access | Capability |
|---|---|---|
| Anonymous | free | View landing, default screener, calendar, subscription |
| Trial | trial via code/invite | Unlock premium plus journal, DB universe, favorites, ticker add |
| Premium | premium via code/invite/grant | Same as trial with no expiry |
| Admin | is_admin | Manage accounts, universe, codes, invites, plans, payments, disclaimer |
| Owner | is_owner | Same as admin plus Owner console title |

Expired trial automatically returns to free once wall-clock passes the limit.

## 🇺🇸 Route Map

Router uses createBrowserRouter with lazy pages. Premium guard remains soft; admin guard remains hard.

| Route | Component | Guard |
|---|---|---|
| / | LandingPage | Public |
| /terminal, /terminal/market | TerminalPage Market tab; `?symbol=<SYMBOL>` opens the asset dialog | Public |
| /terminal/journal | TerminalPage Journal tab; `?trade=<id>` opens the trade dialog | Premium; non-premium sees the Premium Locked card plus license dialog |
| /learn | Learn; `?tab=patterns\|strategies\|quiz`, `&pattern=<id>` or `&strategy=<id>` opens its dialog | Public |
| /calendar | CalendarPage | Public |
| /subscription | SubscriptionPage | Public |
| /invite/:code | InvitePage | Claim during auth |
| /admin/* | Admin pages | Hard to root when non-admin |
| /login, /register, /auth/callback | Auth pages | Public plus OAuth PKCE |
| * | NotFoundPage | Public |

## 🇺🇸 Core Features

Eight features form research-to-journal flow. Canonical diagrams live in TSD signal-flow.

| Feature | Document | Highlight |
|---|---|---|
| 1 Terminal screener | FSD 01 | Pulse, signal table, detail dialog, setup chart, share card |
| 2 Trading engine | FSD 02 | 5-layer pipeline, regime, 3 benchmarks, enrichment, backtest, calibration |
| 3 Auto-journal | FSD 03 | 30-minute cron, emit plus close, Discord alert |
| 4 Journal dashboard | FSD 04 | Equity curve, outcome donut, top performers, transaction table |
| 5 Economic calendar | FSD 05 | Current-month events, impact badge, detail dialog |
| 6 Auth entitlement | FSD 06 | OAuth login, server-truth tier, redeem, invite, disclaimer |
| 7 Admin console | FSD 07 | Accounts, assets, codes, invites, plans, payments, disclaimer, stats |
| 8 Testimonials | FSD 08 | One per account, moderation, six landing slots |

### Help beside page titles

The five main-menu pages (Terminal, Calendar, Calculator, Education, Subscription) have an info icon beside the main heading, outside `<h1>`. Shared `PageHelp` uses the existing Button and one Tooltip with ID/EN copy in `page_help`. Hover, focus, click/tap and Enter/Space open the same bubble. Styling matches the market sentiment footer tooltip: 12px text, a maximum width of 220px, `leading-relaxed`, and default colors, padding, radius and arrow. Top/center placement handles collisions with 16px viewport clearance. Delay follows the global provider. Escape, blur and outside interaction dismiss the bubble. Focus stays visible and reduced motion is supported. Help contains only one short paragraph without source details or interactive controls. Copy is casual and contains no dashes, semicolons or personal pronouns. Each description has two sentences and at most 80 characters; the length difference across all five pages in ID/EN is at most 10%. The target is about three lines at normal font sizes, without fixed heights, truncation or `line-clamp`. Text can wrap onto more lines at larger font sizes. Headings can wrap on small screens. Terminal help describes the displayed market summary and journal, and Subscription help does not hardcode prices or activation durations. Other widget tooltips keep their existing copy.

### Sensei context and conversational voice

Opening or closing a trade dialog does not attach an asset context. Its bot button explicitly hands off the setup snapshot and closes the dialog before opening Sensei. Opening through the global launcher or `Shift+/` releases the active dialog context while preserving history and drafts. New messages do not reuse asset snapshots from earlier messages; historical charts and retries keep their original message snapshots. Assets requested through chat still produce lookup badges, retaining the multi asset `+N` disclosure and existing component styling.

Calendar, Calculator, and Learn still supply the active page snapshot to the bot without page badges. `New chat` clears history, drafts, asset context, and lookup results while preserving the active page snapshot. The API and context contracts stay the same. The system prompt's product guide explains the main pages, account access, favorites, payments, and access codes without inventing dynamic prices, permissions, or account data.

Sensei's Indonesian voice uses casual Jakarta and Gen Z phrasing with adaptive sharp roasting, slang, brief laughter, and Islamic expressions when appropriate, without quotas or assumptions about the user's faith. Humor targets only trading decisions the user describes, never presumed FOMO, holdings, or personal losses from the automatic research Journal. Requests for a serious tone, discomfort with the voice, and distress about losses receive calm replies without roasting, laughter, or religious exclamations. Answers address the question directly with an appropriate length, no mandatory section order, and no repeated greetings, jokes, generic disclaimers, or follow-up offers. Definition, FOMO, calculation, loss, and follow-up examples guide delivery rather than prescribe a script. The entire reply follows the latest user's language, including headings and menu labels; Indonesian examples do not turn English replies into Indonesian. Accurate evidence and risk explanations remain the priority, without emojis, dash punctuation in prose, or semicolons. Model voice is evaluated through real conversations; mocked tests verify only the prompt and data flow.

The prompt targets at most 80 words for ordinary replies, with exceptions for requested detail, step-by-step guides, or substantial multi-part analysis. This guides the model rather than truncating application output. Definitions use prose without invented price levels. Risk explanations distinguish the planned stop from a non-guaranteed execution price, and partial/full liquidation depending on the instrument and margin mode.

Inline Markdown highlights relevant core data using the existing `Badge`: context-backed tickers, signal status/tier, Entry, TP, Stop loss, Risk reward, and numerical risk. A label and value can share one compact badge. The renderer normalizes known aliases such as `stop_loss`, `entry_price`, `take_profit_1`, and `risk_reward_ratio`, plus label/value separators and trailing semicolons. Ticker recognition takes priority; negative signs, numeric separators, currencies, percentages, and ratio colons stay intact. TP/SL and statuses retain existing semantic colors, with existing neutral colors for other metrics. Concepts, jokes, and sentences remain prose or ordinary emphasis. Normalization affects badge display only, not original messages, tool payloads, chart JSON, links, or fenced code.

The model and temperature `0.4` stay unchanged. Release the prompt and renderer together through Cloudflare Pages including `/api/chat`, without a database migration, stored personalization profile, or Supabase Edge Function deployment.

Model voice compliance requires evaluation separate from the renderer. The [persona and badge validation report](../03-testing/05-sensei-persona-validation.md) records code/browser checks and remaining limitations in actual model responses.

## 🇺🇸 Glossary

Key terms keep language uniform across documents. Concise definitions appear below.

| Term | Definition |
|---|---|
| 1h swing | Default timeframe: 60-day range, 1h interval |
| Signal | LONG/SHORT/NEUTRAL plus strength 0-100 plus grade A/B/C |
| Strength | Technical alignment score, not win probability |
| Tier | A strong, B medium, C weak via TIER_THRESHOLDS |
| Regime | trending/ranging/high_volatility/low_volatility from Layer 1 |
| Context | Benchmark risk status: BTC, IHSG+USDIDR, S&P+VIX+DXY |
| Enrichment | Context de-rates; smart-money/accumulation/relative/fundamental display-only |
| Followed trade | Snapshot trade with active TP/SL monitored via cron |
| Journal parity | Each fresh actionable signal recorded at cron snapshot |
| Calibration | Historical hit-rate per tier+regime, minimum sample 30 |
| Universe | Asset list: free constants, premium DB single-source |
| Edge engine | Pure core in browser plus Deno cron single-source |

## 🇺🇸 Product Boundaries

Product remains not broker, not execution bot, not financial adviser. Market data uses Yahoo delay. Official disclaimer lives in the DB.

Signals mean technical alignment. Plans mean reference. Final decision remains with the account operator.

## 🇺🇸 Related Links

- Terminal: docs/01-functional-specs/01-terminal-screener.md
- Diagrams: docs/02-technical-specs/08-signal-flow-diagrams.md
- Testing: docs/03-testing/
- Operations: docs/04-operations/
- Methodology: docs/05-explainers/00-trading-methodology.md
