import * as z from "zod";

/** Zod schema for the admin access code form. */
export const accessCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "admin.codes_add_code_required")
    .min(3, "admin.codes_add_code_min_length"),
  kind: z.enum(["full", "trial"]),
  maxRedemptions: z
    .string()
    .trim()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: "admin.codes_add_invalid_number",
    }),
  trialDays: z
    .string()
    .trim()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: "admin.codes_add_invalid_number",
    }),
  note: z.string().trim(),
});

export type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;
