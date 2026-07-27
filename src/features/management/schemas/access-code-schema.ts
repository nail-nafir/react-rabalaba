import * as z from "zod";
import i18next from "i18next";

/** Zod schema for the admin access code form. */
export const accessCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, i18next.t("admin.codes_add_code_required", "Kode wajib diisi"))
    .min(
      3,
      i18next.t(
        "admin.codes_add_code_min_length",
        "Kode minimal terdiri dari 3 karakter",
      ),
    ),
  kind: z.enum(["full", "trial"]),
  maxRedemptions: z
    .string()
    .trim()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: i18next.t(
        "admin.codes_add_invalid_number",
        "Harus berupa angka positif",
      ),
    }),
  trialDays: z
    .string()
    .trim()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: i18next.t(
        "admin.codes_add_invalid_number",
        "Harus berupa angka positif",
      ),
    }),
  note: z.string().trim(),
});

export type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;
