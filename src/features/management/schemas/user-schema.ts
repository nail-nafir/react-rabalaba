import * as z from "zod";

/** Zod schema for the admin user add/edit form. */
export const userSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "admin.users_add_email_required")
    .email("admin.users_add_invalid_email"),
  password: z.string(),
  tier: z.enum(["free", "trial", "premium"]),
  role: z.enum(["user", "admin", "owner"]),
  trialExpiresAt: z.string().optional().or(z.literal("")),
  isBlocked: z.boolean(),
});

export type UserFormValues = z.infer<typeof userSchema>;
