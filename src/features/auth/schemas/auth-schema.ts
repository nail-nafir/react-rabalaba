import * as z from "zod";

/** Email + password for login. */
export const authSchema = z.object({
  email: z.email("auth.email_invalid"),
  password: z.string().min(6, "auth.password_min"),
});

export type AuthFormValues = z.infer<typeof authSchema>;

/** Register with confirm password. */
export const registerSchema = authSchema
  .extend({
    confirmPassword: z.string().min(1, "auth.confirm_password_required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "auth.confirm_password_mismatch",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
