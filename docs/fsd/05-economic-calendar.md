# FSD 05 — Economic Calendar

> 🇮🇩 Kalender ekonomi: event bulan ini, impact badge, detail dialog.
> 🇺🇸 Economic calendar: this month's events, impact badge, detail dialog.

---

## TL;DR

🇮🇩 Halaman `/calendar` (publik, tanpa guard). Narik event ekonomi bulan ini dari Yahoo screener calendar endpoint (lewat CF proxy), auto-klasifikasi impact (high GDP/CPI/rate, low sentiment/sales/PMI), tampilin mini-calendar bulan + detail dialog per event.

🇺🇸 The `/calendar` page (public, no guard). Pulls this month's economic events from the Yahoo screener calendar endpoint (via CF proxy), auto-classifies impact, shows a month mini-calendar + per-event detail dialog.

---

## 📅 Mini Calendar

Komponen: `src/features/economic-calendar/components/mini-calendar.tsx:163` (`MiniCalendar`).

Grid bulan dengan titik event, nav prev/next bulan, judul locale-aware (`i18n.language` → `id-ID`/`en-US`), callback date-click. Pure presentational.

---

## 🔍 Calendar Detail Dialog

Komponen: `src/features/economic-calendar/components/calendar-detail-dialog.tsx:146` (`CalendarDetailDialog`).

Detail event: flag emoji negara, badge impact, actual/forecast/previous, quote market-context, badge relevance aset (stocks/crypto/commodities). Tipe dari `@/types/calendar`.

---

## 📥 Data source

File: `src/services/api/calendar.ts:36` (`fetchEconomicCalendar`). Endpoint Yahoo `/yahoo/ws/screeners/v1/finance/calendar-events?modules=economicEvents&startDate=&endDate=` (proxy). Flatten daily group → `CalendarEvent[]`, auto-klasifikasi `impact` (`:69`), sort ascending. Return `[]` kalau gagal.

Hook: `src/services/queries/use-calendar-data.ts:7` (`useEconomicCalendar`). queryKey `["economic-calendar"]`, `staleTime`/`refetchInterval` 30 menit, poll auto-stop saat unmount.

---

## 🔗 Terkait / Related
- [`00-overview.md`](00-overview.md) — route map
- [`../tsd/04-cloudflare-proxy.md`](../tsd/04-cloudflare-proxy.md) — Yahoo proxy
