# Server vs Browser — Di Mana Kode Jalan

> 🇮🇩 Dokumen ini ngejelasin bagian mana yang jalan di "server" dan mana yang cuma di browser lo. Bahasa teknis tapi gampang. Tiap bagian: Indonesia dulu, terus English.
> 🇬🇧 This doc explains which parts run on the "server" vs only in your browser. Plain but technical. Each section: Indonesian first, then English.

> 📎 Lihat juga `auto-journal-explained.md` (cara kerja robot) & `auto-journal-system-design.md` (desain formal).

---

## TL;DR

🇮🇩 Produk ini **frontend murni + serverless** — gak ada server backend bikinan sendiri. Kode jalan di **4 tempat**, dan yang penting: **keamanan (premium/admin) dipaksa di server, bukan di browser** — karena browser bisa diutak-atik user.

🇬🇧 This product is **pure frontend + serverless** — there's no hand-built backend server. Code runs in **4 places**, and the key point: **security (premium/admin) is enforced on the server, not the browser** — because the browser can be tampered with.

---

## 🗺️ 4 tempat kode jalan / 4 places code runs

| Tempat / Place | 🇮🇩 Apa | 🇬🇧 What |
|---|---|---|
| 🌐 **Browser** (HP/laptop user) | Aplikasi React: tampilan, chart, dialog, screener | The React app: UI, charts, dialogs, screener |
| 🦾 **Supabase Edge Function** (Deno) | Robot auto-journal (cron) — server, tanpa browser | The auto-journal robot (cron) — server, no browser |
| 🗄️ **Supabase Postgres** (+ pg_cron + RLS) | Database, jadwal cron, keamanan, login | Database, cron schedule, security, auth |
| ☁️ **Cloudflare** (Pages + Functions) | Hosting web statis + proxy Yahoo buat browser | Static site host + Yahoo proxy for the browser |

---

## 📋 Hal → jalan di mana / Thing → where it runs

| 🇮🇩 Hal / 🇬🇧 Thing | 🌐 Browser | 🦾 Edge (Deno) | 🗄️ Postgres | ☁️ Cloudflare |
|---|:---:|:---:|:---:|:---:|
| Render UI / chart / dialog · *render UI/chart/dialog* | ✅ | | | |
| Screener tarik harga + hitung sinyal live · *live signals* | ✅ | | | proxy |
| Robot auto-journal tiap 15m · *the 15-min robot* | | ✅ | | |
| Jadwal cron · *cron schedule* | | | ✅ pg_cron | |
| Simpan trade/universe/setting/profil · *store data* | | | ✅ | |
| Siapa boleh baca apa (premium/admin) · *who can read what* | | | ✅ RLS | |
| Login + redeem kode · *auth + redeem* | UI | | ✅ Auth+RPC | |
| Baca jurnal di web · *read the journal on web* | ✅ minta | | ✅ RLS putusin | |
| Kelola universe di `/admin` · *manage universe* | UI | | ✅ RLS tulis | |
| Proxy ke Yahoo (anti-CORS) · *Yahoo proxy* | | | | ✅ Function |

---

## 🔁 Twist: engine yang SAMA, dua rumah / same engine, two homes

🇮🇩 "Otak" (engine sinyal/TP-SL di `src/`) **bukan** browser-only dan **bukan** server-only — dia jalan di **dua-duanya**:
- Di **browser** → buat nampilin sinyal live di screener (real-time pas lo buka web).
- Di **robot (Deno)** → buat nyatet jurnal otomatis (di-bundle jadi `_engine.mjs`).

Satu sumber kode, dua tempat eksekusi. Jadi kalau ditanya "engine jalan di server atau browser?" → **dua-duanya**.

🇬🇧 The "brain" (the signal/TP-SL engine in `src/`) is **neither** browser-only **nor** server-only — it runs in **both**:
- In the **browser** → to show live signals in the screener (real-time when you open the site).
- In the **robot (Deno)** → to write the journal automatically (bundled as `_engine.mjs`).

One source, two execution sites. So "does the engine run on server or browser?" → **both**.

---

## 🌐 vs 🛰️ Cara ambil data Yahoo beda / Two different Yahoo paths

🇮🇩 Penting: browser dan robot **ambil Yahoo lewat jalur beda**:
- **Browser** → lewat **Cloudflare Function** (`functions/api/yahoo/...`) biar gak kena CORS.
- **Robot (Deno)** → **langsung** ke `query1.finance.yahoo.com` (gak lewat proxy).

🇬🇧 Important: the browser and the robot **fetch Yahoo via different paths**:
- **Browser** → through a **Cloudflare Function** (`functions/api/yahoo/...`) to dodge CORS.
- **Robot (Deno)** → **directly** to `query1.finance.yahoo.com` (no proxy).

> 🇮🇩 Beda jalur ini pernah jadi sumber bug data basi (robot dapet snapshot beda dari web). Lihat memori/dok stale-data.
> 🇬🇧 This path difference once caused a stale-data bug (the robot got a different snapshot than the web). See the stale-data notes.

---

## 🔒 Pelajaran kunci: jangan percaya browser / Key lesson: don't trust the browser

🇮🇩 Browser bisa di-hack/diutak-atik user. Jadi gerbang penting **gak boleh** cuma di UI:
- **Premium/admin** → diputuskan **server** via RLS + fungsi `is_premium()` / `is_admin()` di Postgres. UI cuma nyembunyiin tombol; yang beneran ngunci itu RLS.
- **Redeem kode** → lewat RPC `SECURITY DEFINER` di server (kode rahasianya gak pernah sampai ke browser).
- **Nulis jurnal** → cuma robot (service-role). Browser **read-only**.

🇬🇧 The browser can be hacked/tampered with by the user. So important gates **must not** live only in the UI:
- **Premium/admin** → decided by the **server** via RLS + `is_premium()` / `is_admin()` in Postgres. The UI only hides buttons; RLS does the real locking.
- **Code redemption** → via a `SECURITY DEFINER` RPC on the server (the secret codes never reach the browser).
- **Writing the journal** → only the robot (service-role). The browser is **read-only**.

---

## 📐 Diagram

```
        🌐 BROWSER (untrusted)                 ☁️ CLOUDFLARE
        - React UI / charts                    - Pages (host situs statis)
        - screener: engine live  ──Yahoo──▶    - Function: proxy Yahoo
        - baca journal_trades  ─────────┐
        - /admin tulis universe ──────┐ │
                                      │ │
                                      ▼ ▼  (RLS nentuin boleh/enggak)
        🗄️ SUPABASE POSTGRES (server, trusted)
        - tabel: journal_trades / journal_assets / journal_settings / profiles ...
        - RLS + is_premium()/is_admin() + RPC redeem  ← keamanan
        - pg_cron ⏰ ──POST──▶ 🦾 EDGE FUNCTION (Deno)
                                 - robot auto-journal
                                 - Yahoo LANGSUNG (bukan via CF)
                                 - service-role → tulis journal_trades
```

---

## 🔗 Terkait / Related
- `auto-journal-explained.md` — cara kerja robot (otak vs badan) / how the robot works (brain vs body)
- `auto-journal-system-design.md` — desain formal / formal design
- `../supabase/README.md` — runbook DB / DB runbook
