import * as z from "zod";
import i18next from "i18next";

/** Email + password for login. */
export const authSchema = z.object({
  email: z.string().email(i18next.t("auth.email_invalid")),
  password: z.string().min(6, i18next.t("auth.password_min")),
});

export type AuthFormValues = z.infer<typeof authSchema>;

/** Register with confirm password. */
export const registerSchema = authSchema
  .extend({
    confirmPassword: z
      .string()
      .min(1, i18next.t("auth.confirm_password_required")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: i18next.t("auth.confirm_password_mismatch"),
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
