import { useQuery } from "@tanstack/react-query";
import { fetchFearGreedIndex } from "@/services/api/fear-greed";
import type { FearGreedData } from "@/types/market";

export function useFearGreedIndex() {
  return useQuery({
    queryKey: ["fear-greed"],
    queryFn: fetchFearGreedIndex,
    select: (data): FearGreedData => {
      const current = data.data[0];
      const previous = data.data[1];
      const value = parseInt(current.value, 10);
      const prevValue = previous ? parseInt(previous.value, 10) : value;

      return {
        value,
        label: current.value_classification,
        timestamp: parseInt(current.timestamp, 10) * 1000,
        previousClose: prevValue,
        change: value - prevValue,
      };
    },
    staleTime: 86_400_000, // 1 day (alternative.me F&G is a daily index)
    refetchInterval: 86_400_000,
    retry: 1,
    meta: { silent: true }, // optional context; the summary row degrades gracefully
  });
}
