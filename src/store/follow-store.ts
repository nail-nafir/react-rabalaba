import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UnifiedAsset, SignalTier } from "@/types/asset";
import {
  applyPriceSync,
  buildFollowedTrade,
  computePnl,
  type FollowedTrade,
  type FollowSignal,
} from "@/features/follow-trade/lib/follow-trade-model";

interface FollowState {
  openTrades: FollowedTrade[];
  history: FollowedTrade[];

  /** Snapshot a followable asset. Returns false if not followable or already open. */
  follow: (asset: UnifiedAsset) => boolean;
  /** Feed latest prices ({ symbol: price }); auto-close trades that hit a terminal level. */
  syncPrices: (prices: Record<string, number>) => void;
  /** User-initiated close at the given live price. */
  closeManual: (id: string, price: number) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
}

export const useFollowStore = create<FollowState>()(
  persist(
    (set, get) => ({
      openTrades: [],
      history: [],

      follow: (asset) => {
        if (get().openTrades.some((t) => t.symbol === asset.symbol)) return false;
        const trade = buildFollowedTrade(asset);
        if (!trade) return false;
        set((s) => ({ openTrades: [...s.openTrades, trade] }));
        return true;
      },

      syncPrices: (prices) => {
        const { openTrades } = get();
        if (openTrades.length === 0) return;
        const { stillOpen, justClosed } = applyPriceSync(openTrades, prices);
        if (justClosed.length === 0) {
          // Only persist when a milestone actually advanced (reference identity changed).
          if (stillOpen.some((t, i) => t !== openTrades[i])) {
            set({ openTrades: stillOpen });
          }
          return;
        }
        set((s) => ({ openTrades: stillOpen, history: [...justClosed, ...s.history] }));
      },

      closeManual: (id, price) => {
        const trade = get().openTrades.find((t) => t.id === id);
        if (!trade) return;
        const closed: FollowedTrade = {
          ...trade,
          status: "manual",
          closePrice: Number.isFinite(price) ? price : trade.entryPrice,
          closedAt: Date.now(),
        };
        set((s) => ({
          openTrades: s.openTrades.filter((t) => t.id !== id),
          history: [closed, ...s.history],
        }));
      },

      removeHistory: (id) =>
        set((s) => ({ history: s.history.filter((t) => t.id !== id) })),

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "rabalaba-follow-storage",
      version: 1,
      // Migrate pre-rename snapshots (direction -> signal, tier -> grade).
      migrate: (persisted) => {
        type Legacy = FollowedTrade & { direction?: FollowSignal; tier?: SignalTier };
        const fix = (t: Legacy): FollowedTrade => ({
          ...t,
          signal: t.signal ?? t.direction ?? "long",
          grade: t.grade ?? t.tier,
        });
        const s = persisted as { openTrades?: Legacy[]; history?: Legacy[] };
        return {
          openTrades: (s.openTrades ?? []).map(fix),
          history: (s.history ?? []).map(fix),
        };
      },
    },
  ),
);

export { computePnl };
