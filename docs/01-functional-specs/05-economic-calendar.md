# FSD 05 — Economic Calendar / Economic Calendar

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Event Bulanan, Impact Badge, Dialog Detail

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

Halaman /calendar publik tanpa guard. Menarik event ekonomi bulan berjalan dari endpoint Yahoo screener calendar via proxy. Klasifikasi impact otomatis: high untuk GDP/CPI/rate, low untuk sentiment/sales/PMI. Tampilan sat-set memakai mini-calendar plus dialog detail.

Hook memakai `use-calendar-data.ts › useEconomicCalendar` queryKey economic-calendar, staleTime/refetchInterval 30 menit, poll auto-stop saat unmount. Return list kosong bila gagal.

## 🇮🇩 Tampilan Kalender

Tampilan kalender dan kontrol tanggal berada langsung pada CalendarPage. Grid bulan memakai titik event, nav prev/next bulan, judul locale-aware id-ID/en-US via i18n.language, callback date-click. Pure presentational tanpa logika bisnis.

| Elemen | Perilaku |
|---|---|
| Grid bulan | Titik event per tanggal |
| Navigasi | Prev/next bulan plus judul locale |

## 🇮🇩 Dialog Detail dan Sumber

Dialog memakai `calendar-detail-dialog.tsx › CalendarDetailDialog`. Detail event: flag emoji negara, badge impact, actual/forecast/previous, quote market-context, badge relevance aset stocks/crypto/commodities. Tipe dari types/calendar.

Fetch memakai `calendar.ts › fetchEconomicCalendar` endpoint Yahoo screener calendar-events modules economicEvents dengan startDate dan endDate via proxy. Flatten daily group menjadi CalendarEvent, auto-klasifikasi impact, sort ascending. Return list kosong bila gagal.

## 🇮🇩 Tautan Terkait

- Overview: docs/01-functional-specs/00-overview.md
- Proxy: docs/02-technical-specs/04-cloudflare-proxy.md
- Testing: docs/03-testing/

---

<a id="english-part"></a>

## 🇺🇸 Summary

The /calendar page remains public without guard. Pulls current-month economic events from Yahoo screener calendar endpoint via proxy. Automatic impact classification: high for GDP/CPI/rates, low for sentiment/sales/PMI. Deep-dive view uses mini-calendar plus detail dialog.

Hook uses `use-calendar-data.ts › useEconomicCalendar` with economic-calendar queryKey, 30-minute staleTime/refetchInterval, poll auto-stop at unmount. Returns empty list at failure.

## 🇺🇸 Calendar View

Calendar view plus date controls live directly in CalendarPage. Month grid uses event dots, prev/next month nav, locale-aware id-ID/en-US title via i18n.language, date-click callback. Pure presentational without business logic.

| Element | Behavior |
|---|---|
| Month grid | Event dots per date |
| Navigation | Prev/next month plus locale title |

## 🇺🇸 Detail Dialog and Source

Dialog uses `calendar-detail-dialog.tsx › CalendarDetailDialog`. Event detail: country flag emoji, impact badge, actual/forecast/previous, market-context quote, asset relevance badge stocks/crypto/commodities. Types from types/calendar.

Fetch uses `calendar.ts › fetchEconomicCalendar` with Yahoo screener calendar-events modules economicEvents plus startDate plus endDate via proxy. Flatten daily groups into CalendarEvent list, auto-classify impact, sort ascending. Return empty list at failure.

## 🇺🇸 Related Links

- Overview: docs/01-functional-specs/00-overview.md
- Proxy: docs/02-technical-specs/04-cloudflare-proxy.md
- Testing: docs/03-testing/
