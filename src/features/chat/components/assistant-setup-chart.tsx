import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { PALETTE } from "@/constants/taxonomy/palette";
import {
  dateTickIndices,
  priceToRatio,
  priceTicks,
} from "@/features/trading-plan/model/trade-setup-model";
import { formatPrice } from "@/lib/formatters";
import type { SetupChartModel } from "@/features/chat/chart-model";

export function AssistantSetupChart({ model }: { model: SetupChartModel }) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () =>
      setWidth(Math.max(180, Math.round(element.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { asset, candles, levels, min, max, quoteTime, stale } = model;
  const locale = i18n.language.startsWith("id") ? "id-ID" : "en-US";
  const height = width < 440 ? 210 : 248;
  const top = 10;
  const bottom = height - 27;
  const ticks = priceTicks(min, max, 4);
  const tickLabels = ticks.map((price) => formatPrice(price, asset.assetType));
  const axisWidth = Math.min(
    96,
    Math.max(58, Math.max(...tickLabels.map((label) => label.length)) * 5.5 + 12),
  );
  const left = 8;
  const right = width - axisWidth;
  const step = (right - left) / candles.length;
  const candleWidth = Math.max(1, Math.min(10, step * 0.64));
  const y = (price: number) =>
    top + (1 - priceToRatio(price, min, max)) * (bottom - top);
  const x = (index: number) => left + (index + 0.5) * step;
  const timeFormat = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Jakarta",
    ...(candles.at(-1)!.timestamp - candles[0].timestamp < 2 * 86_400
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short" }),
  });
  const capturedFormat = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const last = candles.at(-1)!;
  const source = "source" in asset ? asset.source : "Terminal";
  const levelColors = {
    entry: PALETTE.neutral.fill,
    risk: PALETTE.negative.fill,
    profit: PALETTE.positive.fill,
  };

  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border border-border bg-background/50 p-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
        <span>
          {t("chat.chart_setup")} · {asset.symbol}
        </span>
        {stale ? (
          <Badge variant="outline" className="border-amber-500/30 text-amber-500">
            {t("chat.stale_data")}
          </Badge>
        ) : null}
      </figcaption>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {source} · {asset.timeframe.toUpperCase()} ·{" "}
        <time dateTime={new Date(quoteTime).toISOString()}>
          {capturedFormat.format(quoteTime)} WIB
        </time>
      </p>
      <div ref={containerRef} className="mt-2 min-w-0 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          className="block"
          role="img"
          aria-label={`${t("chat.chart_setup")}: ${asset.symbol}`}
        >
          {ticks.map((price, index) => (
            <g key={`tick-${index}`}>
              <line
                x1={left}
                x2={right}
                y1={y(price)}
                y2={y(price)}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={right + 7}
                y={y(price) + 3}
                fill="var(--muted-foreground)"
                fontSize={10}
              >
                {tickLabels[index]}
              </text>
            </g>
          ))}
          {levels.map((level) => (
            <line
              key={level.key}
              x1={left}
              x2={right}
              y1={y(level.price)}
              y2={y(level.price)}
              stroke={levelColors[level.kind]}
              strokeWidth={1.2}
              strokeDasharray="5 4"
            />
          ))}
          {candles.map((candle, index) => {
            const color =
              candle.close >= candle.open
                ? PALETTE.positive.fill
                : PALETTE.negative.fill;
            const bodyTop = Math.min(y(candle.open), y(candle.close));
            return (
              <g key={candle.timestamp}>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={y(candle.high)}
                  y2={y(candle.low)}
                  stroke={color}
                  strokeWidth={1.2}
                />
                <rect
                  x={x(index) - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={Math.max(1, Math.abs(y(candle.open) - y(candle.close)))}
                  fill={color}
                />
              </g>
            );
          })}
          {dateTickIndices(candles.length, width < 440 ? 3 : 5).map(
            (index, tickIndex, all) => (
              <text
                key={`date-${index}`}
                x={x(index)}
                y={height - 5}
                textAnchor={
                  tickIndex === 0
                    ? "start"
                    : tickIndex === all.length - 1
                      ? "end"
                      : "middle"
                }
                fill="var(--muted-foreground)"
                fontSize={10}
              >
                {timeFormat.format(candles[index].timestamp * 1_000)}
              </text>
            ),
          )}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {(["open", "high", "low", "close"] as const).map((field) => (
          <span key={field} className="whitespace-nowrap">
            {t(`dialog.ohlc_${field}`)}{" "}
            <strong className="font-medium text-foreground">
              {formatPrice(last[field], asset.assetType)}
            </strong>
          </span>
        ))}
      </div>
      {levels.length ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {levels.map((level) => (
            <span
              key={level.key}
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: levelColors[level.kind] }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{t(`dialog.${level.key}`)}</span>
              <span className="font-medium text-foreground">
                {formatPrice(level.price, asset.assetType)}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("chat.chart_levels_unavailable")}
        </p>
      )}
      <p className="sr-only">
        {t("chat.chart_candle_summary", {
          open: formatPrice(last.open, asset.assetType),
          high: formatPrice(last.high, asset.assetType),
          low: formatPrice(last.low, asset.assetType),
          close: formatPrice(last.close, asset.assetType),
        })}
      </p>
    </figure>
  );
}
