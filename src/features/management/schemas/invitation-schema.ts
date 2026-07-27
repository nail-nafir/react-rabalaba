import * as z from "zod";
import i18next from "i18next";

/** Zod schema for the admin invitation form. */
export const invitationSchema = z
  .object({
    kind: z.enum(["full", "trial"]),
    trialDays: z.string().trim(),
    maxRedemptions: z
      .string()
      .trim()
      .refine((val) => !val || /^\d+$/.test(val), {
        message: i18next.t(
          "admin.codes_add_invalid_number",
          "Harus berupa angka positif",
        ),
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
      message: i18next.t(
        "admin.codes_add_invalid_number",
        "Harus berupa angka positif",
      ),
      path: ["trialDays"],
    },
  );

export type InvitationFormValues = z.infer<typeof invitationSchema>;
