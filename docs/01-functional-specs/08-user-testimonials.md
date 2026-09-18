# FSD 08 — User Testimonials / User Testimonials

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Satu per Akun, Moderasi Admin, Enam Slot Landing

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

Akun login non-blocked dapat membuat, mengubah, atau menghapus satu testimoni berisi isi dan rating 1-5; identitas tampil dari profil akun. Pengajuan baru berstatus pending. Alur spill dari form sampai landing terasa jujur.

Admin dapat approve/reject dengan alasan privat opsional, lalu menempatkan testimoni approved ke slot publik 1-6. Ubah testimoni approved otomatis kembali ke pending dan lepas dari landing sampai review ulang.

Form membatasi isi 20-500 karakter dan rating integer 1-5. Kutipan tidak diterjemahkan; hanya chrome UI mengikuti bahasa aktif.

## 🇮🇩 Alur Pengguna

Tombol menjadi DialogTrigger; URL tidak berubah. Menu akun Ulasan Pribadi navigasi ke /#testimonials; form dibuka via CTA. Signed-out CTA landing login dengan redirect /#testimonials, lalu kembali ke bagian testimoni.

| Aksi | Entry | Hasil |
|---|---|---|
| Buka form | CTA testimoni | Dialog terbuka tanpa ubah URL |
| Kirim pertama | Form valid plus rating wajib | Satu row privat pending unique per user_id |
| Ubah | Dialog muat pengajuan sendiri | Konten tersimpan; approval lama dicabut |

Hapus via konfirmasi destruktif membuat row privat dan snapshot publik terkait langsung hilang.

## 🇮🇩 Moderasi

Admin page /admin/testimonials. Slot terisi hanya diganti setelah konfirmasi. Database salin snapshot publik dari pengajuan approved, jadi browser tidak pernah kirim isi publik terpisah.

| Status | Makna | Aksi admin |
|---|---|---|
| pending | Menunggu review | Approve atau reject |
| approved | Layak landing | Feature/move slot, unfeature, reject, delete |
| rejected | Perlu revisi | Alasan privat opsional, approve, atau delete |

## 🇮🇩 Landing dan Privasi

TestimonialSection tampil antara Features dan FAQ. Saat ada data, section render kartu responsif dengan avatar inisial, nama, persona, kutipan, dan rating. Loading memakai skeleton; error sedia retry; DB kosong tampil CTA jujur tanpa seed atau testimoni palsu.

- testimonial_submissions privat: pemilik non-blocked hanya lihat row sendiri; admin lihat antrean penuh.
- featured_testimonials hanya snapshot aman publik: slot, submission ID, nama tampil, persona, isi, rating, waktu publikasi.
- RLS, trigger, constraint, dan RPC admin menegakkan aturan sama walau request langsung via Data API.
- Akun diblokir membuat snapshot featured langsung dicabut; pengajuan privat tetap untuk audit admin.

Alasan reject dan reviewer tidak pernah masuk data publik.

## 🇮🇩 Implementasi Kunci

| Area | File |
|---|---|
| Landing plus form plus hooks | src/features/testimonials/ |
| Admin moderation | testimonials-table plus use-admin-testimonials |

Skema plus RLS plus trigger plus RPC di migration user_testimonials. Tipe client hand-written di database.types. Skema kanonis 16 tabel plus 28 RPC. Basis uji 45 file dengan 422 kasus.

## 🇮🇩 Tautan Terkait

- Admin: docs/01-functional-specs/07-admin-console.md
- Auth: docs/01-functional-specs/06-auth-entitlement.md
- Skema: docs/02-technical-specs/03-database-schema.md
- Testing: docs/03-testing/

---

<a id="english-part"></a>

## 🇺🇸 Summary

Signed-in non-blocked accounts may create, edit, or delete one testimonial holding body plus 1-5 rating; display identity comes from account profile. Fresh submissions start pending. Deep-dive flow from form to landing remains honest.

Admins may approve/reject with optional private reason, then place approved testimonials in public slots 1-6. Editing approved content automatically returns to pending and leaves landing until another review.

Form limits body 20-500 characters plus integer rating 1-5. Quotes remain untranslated; only UI chrome follows active locale.

## 🇺🇸 Account Flow

Buttons become DialogTrigger; URL never changes. Account menu Private Review navigates to /#testimonials; form opens via CTA. Signed-out landing CTA signs in with /#testimonials redirect, then returns to testimonial section.

| Action | Entry | Result |
|---|---|---|
| Open form | Testimonial CTA | Dialog opens without URL change |
| First submit | Valid form plus required rating | One private pending row unique per user_id |
| Edit | Dialog loads own submission | Content saved; prior approval revoked |

Delete via destructive confirmation removes private row plus linked public snapshot at once.

## 🇺🇸 Moderation

Admin page /admin/testimonials. Occupied slots replace only after confirmation. Database copies public snapshot from approved submissions, so browser never sends separate public copy.

| Status | Meaning | Admin action |
|---|---|---|
| pending | Awaiting review | Approve or reject |
| approved | Landing eligible | Feature/move slot, unfeature, reject, delete |
| rejected | Needs revision | Optional private reason, approve, or delete |

## 🇺🇸 Landing and Privacy

TestimonialSection appears between Features plus FAQ. With data, section renders responsive cards with initial avatar, name, persona, quote, plus rating. Loading uses skeletons; errors offer retry; empty DB shows honest CTA without seed or fabricated testimonials.

- testimonial_submissions private: non-blocked owner sees own row only; admin sees full queue.
- featured_testimonials holds only public-safe snapshot: slot, submission ID, display name, persona, body, rating, publication time.
- RLS, triggers, constraints, plus admin RPCs enforce same rules even at direct Data API requests.
- Blocked accounts lose featured snapshot at once; private submissions persist for admin audit.

Rejection reasons plus reviewer never enter public data.

## 🇺🇸 Key Implementation

| Area | File |
|---|---|
| Landing plus form plus hooks | src/features/testimonials/ |
| Admin moderation | testimonials-table plus use-admin-testimonials |

Schema plus RLS plus trigger plus RPC live in user_testimonials migration. Hand-written client types live in database.types. Canonical schema 16 tables plus 28 RPCs. Test basis 45 files with 422 cases.

## 🇺🇸 Related Links

- Admin: docs/01-functional-specs/07-admin-console.md
- Auth: docs/01-functional-specs/06-auth-entitlement.md
- Schema: docs/02-technical-specs/03-database-schema.md
- Testing: docs/03-testing/
