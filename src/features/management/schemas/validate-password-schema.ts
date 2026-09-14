import * as z from "zod";

/** Zod schema for the admin password validation form. */
export const validatePasswordSchema = z.object({
  password: z.string().min(1, "auth.password_required"),
});

export type ValidatePasswordFormValues = z.infer<typeof validatePasswordSchema>;
