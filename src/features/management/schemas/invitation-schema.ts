import * as z from "zod";

/** Zod schema for the admin invitation form. */
export const invitationSchema = z
  .object({
    kind: z.enum(["full", "trial"]),
    trialDays: z.string().trim(),
    maxRedemptions: z
      .string()
      .trim()
      .refine((val) => !val || /^\d+$/.test(val), {
        message: "admin.codes_add_invalid_number",
      }),
    recipient: z.string().trim(),
    expiresAt: z.date().optional(),
  })
  .refine(
    (data) => {
      if (data.kind === "trial") {
        return /^\d+$/.test(data.trialDays) && Number(data.trialDays) > 0;
      }
      return true;
    },
    {
      message: "admin.codes_add_invalid_number",
      path: ["trialDays"],
    },
  );

export type InvitationFormValues = z.infer<typeof invitationSchema>;
