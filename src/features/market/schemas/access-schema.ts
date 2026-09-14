import * as z from "zod";

export const accessSchema = z.object({
  code: z.string().min(1, "terminal.access_dialog_code_required"),
});

export type AccessFormValues = z.infer<typeof accessSchema>;
