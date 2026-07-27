import * as z from "zod";
import i18next from "i18next";

/** Zod schema for the admin password validation form. */
export const validatePasswordSchema = z.object({
  password: z
    .string()
    .min(1, i18next.t("auth.password_required", "Password wajib diisi")),
});

export type ValidatePasswordFormValues = z.infer<
  typeof validatePasswordSchema
>;
