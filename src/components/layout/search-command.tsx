import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useDebounce } from "@/hooks/use-debounce";
import { Search, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback } from "react";
import { Badge } from "../ui/badge";

// Mock search results — will be replaced with API data
const MOCK_ASSETS = [
  { symbol: "BTC/USD", name: "Bitcoin", type: "Crypto" },
  { symbol: "ETH/USD", name: "Ethereum", type: "Crypto" },
  { symbol: "SOL/USD", name: "Solana", type: "Crypto" },
  { symbol: "AAPL", name: "Apple Inc.", type: "US Stock" },
  { symbol: "MSFT", name: "Microsoft", type: "US Stock" },
  { symbol: "GOOGL", name: "Alphabet", type: "US Stock" },
  { symbol: "NVDA", name: "NVIDIA", type: "US Stock" },
  { symbol: "BBCA.JK", name: "Bank Central Asia", type: "ID Stock" },
  { symbol: "BBRI.JK", name: "Bank Rakyat Indonesia", type: "ID Stock" },
  { symbol: "TLKM.JK", name: "Telkom Indonesia", type: "ID Stock" },
  { symbol: "GC=F", name: "Gold Futures", type: "Commodity" },
  { symbol: "CL=F", name: "Crude Oil", type: "Commodity" },
];

export function SearchCommand() {
  const { isSearchOpen, setSearchOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebounce(query, 200);
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, [setSearchOpen]);

  useKeyboardShortcut("Escape", handleClose);

  const filteredAssets = MOCK_ASSETS.filter(
    (asset) =>
      asset.symbol.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      asset.name.toLowerCase().includes(debouncedQuery.toLowerCase()),
  );

  const handleSelect = (symbol: string) => {
    // Navigate to terminal with the selected symbol (optional enhancement)
    navigate(`/terminal?symbol=${symbol}`);
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredAssets.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredAssets[selectedIndex]) {
      handleSelect(filteredAssets[selectedIndex].symbol);
    }
  };

  return (
    <Dialog open={isSearchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden border-border">
        <DialogTitle className="sr-only">Search Assets</DialogTitle>
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border/50 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search assets, symbols, stocks..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border/50 bg-muted px-1.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filteredAssets.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No assets found for "{debouncedQuery}"
            </div>
          ) : (
            filteredAssets.map((asset, index) => (
              <Button
                key={asset.symbol}
                variant="ghost"
                className={cn(
                  "flex h-auto w-full items-center justify-start gap-3 px-4 py-2.5 text-left transition-colors rounded-none",
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
                onClick={() => handleSelect(asset.symbol)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{asset.symbol}</div>
                  <div className="text-xs text-muted-foreground">
                    {asset.name}
                  </div>
                </div>
                <Badge className="px-2 py-0.5 text-[10px] font-medium">
                  {asset.type}
                </Badge>
                {index === selectedIndex && (
                  <ArrowRight className="h-4 w-4 text-primary" />
                )}
              </Button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/50 px-1">↑↓</kbd>{" "}
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/50 px-1">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/50 px-1">ESC</kbd>{" "}
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
