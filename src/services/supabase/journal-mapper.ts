/** Browser-facing compatibility façade for the pure trade mappers. */
export {
  followedTradeToInsert,
  rowToFollowedTrade,
} from "@/core/trade/journal-mapper";
export type {
  JournalTradeInsert,
  JournalTradeRow,
} from "@/types/journal";
