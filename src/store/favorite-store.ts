import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoriteState {
  favoriteSymbols: string[];
  error: string | null;

  addSymbol: (symbol: string) => boolean;
  removeSymbol: (symbol: string) => void;
  clearError: () => void;
}

export const useFavoriteStore = create<FavoriteState>()(
  persist(
    (set, get) => ({
      // Starting default favorite symbols
      favoriteSymbols: ["BTC-USD", "AAPL", "BBCA.JK"],
      error: null,

      addSymbol: (symbol: string) => {
        const cleanSymbol = symbol.trim().toUpperCase();
        if (!cleanSymbol) return false;

        const currentSymbols = get().favoriteSymbols;

        if (currentSymbols.includes(cleanSymbol)) {
          set({ error: "already_exists" });
          return false;
        }

        set({
          favoriteSymbols: [...currentSymbols, cleanSymbol],
          error: null,
        });
        return true;
      },

      removeSymbol: (symbol: string) => {
        set({
          favoriteSymbols: get().favoriteSymbols.filter(
            (s) => s.toUpperCase() !== symbol.trim().toUpperCase(),
          ),
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "rabalaba-favorite-storage",
    },
  ),
);
