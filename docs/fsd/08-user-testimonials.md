# FSD 08 — User Testimonials

> 🇮🇩 Testimoni asli pengguna: satu pengajuan per akun, moderasi admin, dan maksimal enam kutipan pilihan di landing page.
> 🇺🇸 Genuine user testimonials: one submission per account, admin moderation, and up to six featured quotes on the landing page.

---

## TL;DR

🇮🇩 Pengguna login yang tidak diblokir bisa membuat, mengubah, atau menghapus satu testimoni berisi isi dan rating 1–5; identitas tampilan diambil dari profil akun. Pengajuan baru berstatus `pending`. Admin bisa menyetujui/menolak dengan alasan privat opsional, lalu menempatkan testimoni yang disetujui ke slot publik 1–6. Mengubah testimoni yang sudah disetujui otomatis mengembalikannya ke `pending` dan mencabutnya dari landing sampai ditinjau ulang.

🇺🇸 A signed-in, non-blocked user can create, edit, or delete one testimonial containing a body and 1–5 rating; display identity comes from the account profile. New submissions start as `pending`. Admins can approve or reject them with an optional private reason, then place approved testimonials in public slots 1–6. Editing approved content automatically returns it to `pending` and removes it from the landing page until another review.

---

## 🧑 Alur pengguna / User flow

| Aksi / Action | Entry | Hasil / Result |
|---|---|---|
| Buka form / Open form | CTA bagian testimonial / testimonial CTA | Tombol menjadi `DialogTrigger`; URL tidak berubah |
| Menu akun / Account menu | "Ulasan Pribadi" | Navigasi ke `/#testimonials`; pengguna membuka form lewat CTA |
| Belum login / Signed out | CTA landing | Login dengan `redirect=/#testimonials`, lalu kembali ke bagian testimonial |
| Kirim pertama / First submit | Form valid + rating wajib | Satu row privat `pending`; unique per `user_id` |
| Ubah / Edit | Dialog memuat pengajuan sendiri | Konten tersimpan; approval lama dicabut otomatis |
| Hapus / Delete | Konfirmasi destruktif | Row privat dan snapshot publik terkait langsung dihapus |

Form membatasi isi 20–500 karakter dan rating integer 1–5. Kutipan tidak diterjemahkan; hanya chrome UI yang mengikuti pilihan bahasa.

The form limits the body to 20–500 characters and rating to an integer from 1–5. Quotes stay in their original language; only the UI chrome follows the selected locale.

---

## 🛡️ Moderasi / Moderation

| Status | Makna / Meaning | Aksi admin / Admin action |
|---|---|---|
| `pending` | Menunggu review / awaiting review | Approve atau reject |
| `approved` | Layak dipilih untuk landing / eligible for landing | Feature/move slot, unfeature, reject, delete |
| `rejected` | Perlu perbaikan / needs revision | Alasan privat opsional, approve, atau delete |

Admin page: `/admin/testimonials`. Slot yang sudah terisi hanya bisa diganti setelah konfirmasi. Database menyalin snapshot publik dari pengajuan yang disetujui, jadi browser tidak pernah mengirim isi publik secara terpisah.

Admin page: `/admin/testimonials`. Replacing an occupied slot requires confirmation. The database copies the public snapshot from an approved submission, so the browser never supplies public copy separately.

---

## 🌐 Landing & empty state

`TestimonialSection` tampil di antara Features dan FAQ. Saat ada data, section merender kartu responsif dengan avatar inisial, nama, persona, kutipan, dan rating. Loading memakai skeleton; error punya retry; database kosong menampilkan CTA jujur tanpa seed atau testimoni palsu.

`TestimonialSection` appears between Features and FAQ. With data, it renders responsive cards with initials, name, persona, quote, and rating. Loading uses skeletons; errors offer retry; an empty database shows an honest CTA with no seed or fabricated testimonial.

---

## 🔒 Privasi & trust boundary / Privacy & trust boundary

- `testimonial_submissions` bersifat privat: pemilik non-blocked hanya melihat row sendiri; admin melihat antrean penuh. Alasan penolakan dan reviewer tidak pernah masuk data publik.
- `featured_testimonials` hanya berisi snapshot aman untuk publik: slot, submission ID, nama tampilan, persona, isi, rating, dan waktu publikasi.
- RLS, trigger, constraint, dan RPC admin menegakkan aturan yang sama walau request dibuat langsung lewat Data API.
- Saat akun diblokir, snapshot featured miliknya langsung dicabut; pengajuan privat tetap tersimpan untuk audit admin.

- `testimonial_submissions` is private: a non-blocked owner sees only their row; admins see the full queue. Rejection reasons and reviewer data never enter the public table.
- `featured_testimonials` contains only a public-safe snapshot: slot, submission ID, display name, persona, body, rating, and publication time.
- RLS, triggers, constraints, and admin RPCs enforce the same rules even when a request is sent directly to the Data API.
- Blocking an account immediately removes its featured snapshot while retaining the private submission for the admin audit trail.

---

## 🧩 Implementasi kunci / Key implementation

| Area | File |
|---|---|
| Landing + form + hooks | `src/features/testimonials/` |
| Admin moderation | `src/pages/admin/testimonials.tsx`, `src/features/admin/components/testimonials-table.tsx`, `src/hooks/use-admin-testimonials.ts` |
| Schema + RLS + trigger + RPC | `supabase/migrations/20260713093413_user_testimonials.sql` |
| Hand-written client types | `src/services/supabase/database.types.ts` |

## 🔗 Terkait / Related

- [`07-admin-console.md`](07-admin-console.md) — admin navigation and moderation surface
- [`06-auth-entitlement.md`](06-auth-entitlement.md) — login and redirect flow
- [`../tsd/03-database-schema.md`](../tsd/03-database-schema.md) — tables, RLS, triggers, and RPC details
