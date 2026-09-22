import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const ticker = readFileSync(
  join(root, "src/components/layout/market-ticker.tsx"),
  "utf8",
);
const assets = readFileSync(join(root, "src/constants/assets.ts"), "utf8");
const css = readFileSync(join(root, "src/index.css"), "utf8");

test("market ticker uses only the unique MARKET_INDICES universe", () => {
  assert.equal((ticker.match(/useMarketData\(/g) ?? []).length, 1);
  assert.match(
    ticker,
    /useMarketData\(\s*MARKET_INDICES\.map\(\(i\) => i\.symbol\)/,
  );
  assert.match(ticker, /const tickerData = \(indices \?\? \[\]\)\.map/);
  assert.doesNotMatch(
    ticker,
    /\b(?:usStocks|idStocks|crypto)\b|AAPL|MSFT|NVDA|TSLA|BBCA\.JK|BBRI\.JK|BMRI\.JK|TLKM\.JK/,
  );

  const indexList = assets.slice(assets.indexOf("export const MARKET_INDICES = ["));
  const symbols = [...indexList.matchAll(/\{ symbol: "([^"]+)"/g)].map(
    ([, symbol]) => symbol,
  );
  assert.ok(symbols.length > 0);
  assert.equal(new Set(symbols).size, symbols.length);
});

test("market ticker loops by one of two identical content groups", () => {
  assert.match(ticker, /animate-ticker flex w-max whitespace-nowrap/);
  assert.match(ticker, /Array\.from\(\{ length: 2 \}/);
  assert.match(ticker, /aria-hidden=\{copyIndex > 0 \? true : undefined\}/);
  assert.match(ticker, /tickerData\.map\(\(item\) =>/);
  assert.match(css, /100%\s*\{\s*transform:\s*translate3d\(-50%,\s*0,\s*0\)/);
  assert.match(
    css,
    /\.animate-ticker\s*\{\s*animation:\s*ticker-scroll 60s linear infinite;/,
  );
  assert.doesNotMatch(
    css,
    /@media\s*\(max-width:\s*768px\)\s*\{\s*\.animate-ticker/,
  );
});

test("market ticker respects reduced motion without duplicate items", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    css,
    /\.animate-ticker \[aria-hidden="true"\]\s*\{\s*display:\s*none;/,
  );
});
