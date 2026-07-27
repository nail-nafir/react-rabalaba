import * as z from "zod";
import i18next from "i18next";

/** Zod schema for the admin user add/edit form. */
export const userSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, i18next.t("admin.users_add_email_required", "Email wajib diisi"))
    .email(
      i18next.t("admin.users_add_invalid_email", "Format email tidak valid"),
    ),
  tier: z.enum(["free", "trial", "premium"]),
  role: z.enum(["user", "admin", "owner"]),
  trialExpiresAt: z.string().optional().or(z.literal("")),
  isBlocked: z.boolean(),
});

export type UserFormValues = z.infer<typeof userSchema>;
