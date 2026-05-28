import * as z from "zod";
import i18next from "i18next";

export const favoriteSchema = z.object({
  symbol: z
    .string()
    .min(1, i18next.t("terminal.add_ticker_placeholder")),
});

export type FavoriteFormValues = z.infer<typeof favoriteSchema>;
