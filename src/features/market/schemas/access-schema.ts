import * as z from "zod";
import i18next from "i18next";

export const accessSchema = z.object({
  code: z.string().min(1, i18next.t("terminal.access_dialog_code_required")),
});

export type AccessFormValues = z.infer<typeof accessSchema>;

