import React from "react";
import { useTranslation } from "react-i18next";
import { PALETTE } from "@/constants/taxonomy/palette";

interface PatternVisualProps {
  type: string;
  className?: string;
}

export const PatternVisual: React.FC<PatternVisualProps> = ({
  type,
  className = "w-full h-44",
}) => {
  const { t } = useTranslation();

  // Use canonical taxonomy color tokens for visual consistency across terminal & learn
  const green = PALETTE.positive.fill;
  const red = PALETTE.negative.fill;
  const warning = PALETTE.warning.fill;
  const primary = PALETTE.accent.fill;
  const muted = PALETTE.neutral.fill;

  switch (type) {
    // ── CANDLESTICKS ───────────────────────────────────────────────────
    case "hammer":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />

          {/* Downtrend context candles */}
          <line
            x1="45"
            y1="20"
            x2="45"
            y2="55"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="39" y="25" width="12" height="22" fill={red} rx="1" />

          <line
            x1="75"
            y1="40"
            x2="75"
            y2="75"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="69" y="44" width="12" height="24" fill={red} rx="1" />

          <line
            x1="105"
            y1="60"
            x2="105"
            y2="92"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="99" y="64" width="12" height="20" fill={red} rx="1" />

          {/* Hammer Candle */}
          <line
            x1="140"
            y1="78"
            x2="140"
            y2="128"
            stroke={green}
            strokeWidth="2"
          />
          <line
            x1="140"
            y1="74"
            x2="140"
            y2="78"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="132" y="78" width="16" height="12" fill={green} rx="1.5" />

          {/* Next confirmation candle */}
          <line
            x1="175"
            y1="45"
            x2="175"
            y2="90"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="169" y="52" width="12" height="30" fill={green} rx="1" />

          {/* Annotation lines */}
          <line
            x1="130"
            y1="74"
            x2="195"
            y2="74"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="77" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.entry")}
          </text>

          <line
            x1="130"
            y1="128"
            x2="195"
            y2="128"
            stroke={red}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="131" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.stop_loss")}
          </text>
        </svg>
      );

    case "shooting_star":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />

          {/* Uptrend context candles */}
          <line
            x1="45"
            y1="75"
            x2="45"
            y2="115"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="39" y="80" width="12" height="24" fill={green} rx="1" />

          <line
            x1="75"
            y1="55"
            x2="75"
            y2="95"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="69" y="60" width="12" height="26" fill={green} rx="1" />

          {/* Shooting Star */}
          <line
            x1="115"
            y1="18"
            x2="115"
            y2="65"
            stroke={red}
            strokeWidth="2"
          />
          <line
            x1="115"
            y1="75"
            x2="115"
            y2="78"
            stroke={red}
            strokeWidth="1"
          />
          <rect x="107" y="62" width="16" height="12" fill={red} rx="1.5" />

          {/* Next confirmation candle */}
          <line
            x1="155"
            y1="65"
            x2="155"
            y2="110"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="149" y="72" width="12" height="30" fill={red} rx="1" />

          {/* Annotations */}
          <line
            x1="105"
            y1="18"
            x2="195"
            y2="18"
            stroke={red}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="21" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.stop_loss")}
          </text>

          <line
            x1="105"
            y1="78"
            x2="195"
            y2="78"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="81" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.sell_entry")}
          </text>
        </svg>
      );

    case "inverted_hammer":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <line
            x1="45"
            y1="30"
            x2="45"
            y2="70"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="39" y="38" width="12" height="24" fill={red} rx="1" />

          <line
            x1="75"
            y1="55"
            x2="75"
            y2="95"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="69" y="62" width="12" height="26" fill={red} rx="1" />

          {/* Inverted hammer */}
          <line
            x1="115"
            y1="45"
            x2="115"
            y2="95"
            stroke={green}
            strokeWidth="2"
          />
          <rect x="107" y="86" width="16" height="12" fill={green} rx="1.5" />

          {/* Confirmation Candle */}
          <line
            x1="155"
            y1="40"
            x2="155"
            y2="95"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="149" y="48" width="12" height="36" fill={green} rx="1" />

          <line
            x1="105"
            y1="45"
            x2="195"
            y2="45"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="48" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.confirm")}
          </text>
        </svg>
      );

    case "doji":
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          {/* Standard Doji */}
          <g transform="translate(45, 15)">
            <text
              x="0"
              y="15"
              fill={primary}
              fontSize="8.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.standard")}
            </text>
            <line
              x1="0"
              y1="28"
              x2="0"
              y2="92"
              stroke={primary}
              strokeWidth="2"
            />
            <line
              x1="-12"
              y1="60"
              x2="12"
              y2="60"
              stroke={primary}
              strokeWidth="3.5"
            />
            <text
              x="0"
              y="114"
              fill={muted}
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.neutral_label")}
            </text>
          </g>

          {/* Dragonfly Doji */}
          <g transform="translate(120, 15)">
            <text
              x="0"
              y="15"
              fill={green}
              fontSize="8.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.dragonfly")}
            </text>
            <line
              x1="0"
              y1="34"
              x2="0"
              y2="92"
              stroke={green}
              strokeWidth="2"
            />
            <line
              x1="-12"
              y1="34"
              x2="12"
              y2="34"
              stroke={green}
              strokeWidth="3.5"
            />
            <text
              x="0"
              y="114"
              fill={green}
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.bullish_label")}
            </text>
          </g>

          {/* Gravestone Doji */}
          <g transform="translate(195, 15)">
            <text
              x="0"
              y="15"
              fill={red}
              fontSize="8.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.gravestone")}
            </text>
            <line x1="0" y1="28" x2="0" y2="86" stroke={red} strokeWidth="2" />
            <line
              x1="-12"
              y1="86"
              x2="12"
              y2="86"
              stroke={red}
              strokeWidth="3.5"
            />
            <text
              x="0"
              y="114"
              fill={red}
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.bearish_label")}
            </text>
          </g>
        </svg>
      );

    case "marubozu":
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          {/* Bullish Marubozu */}
          <g transform="translate(60, 15)">
            <text
              x="16"
              y="15"
              fill={green}
              fontSize="8.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.bullish")}
            </text>
            <rect x="0" y="24" width="32" height="75" fill={green} rx="2" />
            <text
              x="16"
              y="114"
              fill={muted}
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.close_high")}
            </text>
          </g>

          {/* Bearish Marubozu */}
          <g transform="translate(148, 15)">
            <text
              x="16"
              y="15"
              fill={red}
              fontSize="8.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.bearish")}
            </text>
            <rect x="0" y="24" width="32" height="75" fill={red} rx="2" />
            <text
              x="16"
              y="114"
              fill={muted}
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
            >
              {t("learn.visual.close_low")}
            </text>
          </g>
        </svg>
      );

    case "bullish_engulfing":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          {/* Context red */}
          <line
            x1="50"
            y1="30"
            x2="50"
            y2="65"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="44" y="38" width="12" height="20" fill={red} rx="1" />

          {/* Candle 1 (small red) */}
          <line
            x1="90"
            y1="50"
            x2="90"
            y2="85"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="83" y="58" width="14" height="20" fill={red} rx="1" />

          {/* Candle 2 (giant green engulfing) */}
          <line
            x1="125"
            y1="32"
            x2="125"
            y2="96"
            stroke={green}
            strokeWidth="2"
          />
          <rect x="115" y="40" width="20" height="50" fill={green} rx="1.5" />

          {/* Context green */}
          <line
            x1="165"
            y1="20"
            x2="165"
            y2="65"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="159" y="28" width="12" height="28" fill={green} rx="1" />

          {/* Annotations */}
          <line
            x1="115"
            y1="40"
            x2="195"
            y2="40"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="43" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.entry")}
          </text>
          <line
            x1="115"
            y1="96"
            x2="195"
            y2="96"
            stroke={red}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="99" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.stop_loss")}
          </text>
        </svg>
      );

    case "bearish_engulfing":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          {/* Context green */}
          <line
            x1="50"
            y1="70"
            x2="50"
            y2="105"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="44" y="78" width="12" height="20" fill={green} rx="1" />

          {/* Candle 1 (small green) */}
          <line
            x1="90"
            y1="48"
            x2="90"
            y2="82"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="83" y="54" width="14" height="20" fill={green} rx="1" />

          {/* Candle 2 (giant red engulfing) */}
          <line
            x1="125"
            y1="36"
            x2="125"
            y2="100"
            stroke={red}
            strokeWidth="2"
          />
          <rect x="115" y="44" width="20" height="50" fill={red} rx="1.5" />

          {/* Context red */}
          <line
            x1="165"
            y1="70"
            x2="165"
            y2="115"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="159" y="78" width="12" height="28" fill={red} rx="1" />

          <line
            x1="115"
            y1="36"
            x2="195"
            y2="36"
            stroke={red}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="39" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.stop_loss")}
          </text>
          <line
            x1="115"
            y1="94"
            x2="195"
            y2="94"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="200" y="97" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.entry")}
          </text>
        </svg>
      );

    case "morning_star":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          {/* Day 1: Large Red */}
          <line
            x1="60"
            y1="25"
            x2="60"
            y2="85"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="52" y="32" width="16" height="46" fill={red} rx="1.5" />

          {/* Day 2: Small star gap down */}
          <line
            x1="105"
            y1="85"
            x2="105"
            y2="115"
            stroke={primary}
            strokeWidth="1.5"
          />
          <rect x="99" y="95" width="12" height="10" fill={primary} rx="1" />

          {/* Day 3: Large Green (>50% penetration) */}
          <line
            x1="150"
            y1="32"
            x2="150"
            y2="90"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="142" y="40" width="16" height="44" fill={green} rx="1.5" />

          {/* 50% midpoint dotted guideline */}
          <line
            x1="45"
            y1="55"
            x2="170"
            y2="55"
            stroke={muted}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="175" y="58" fill={muted} fontSize="7.5" fontWeight="bold">
            {t("learn.visual.penetration")}
          </text>

          <line
            x1="105"
            y1="115"
            x2="185"
            y2="115"
            stroke={red}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="190" y="118" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.stop")}
          </text>
        </svg>
      );

    case "three_soldiers":
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          {/* Soldier 1 */}
          <line
            x1="60"
            y1="75"
            x2="60"
            y2="115"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="53" y="80" width="14" height="28" fill={green} rx="1.5" />

          {/* Soldier 2 */}
          <line
            x1="100"
            y1="48"
            x2="100"
            y2="90"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="93" y="54" width="14" height="30" fill={green} rx="1.5" />

          {/* Soldier 3 */}
          <line
            x1="140"
            y1="20"
            x2="140"
            y2="65"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="133" y="26" width="14" height="32" fill={green} rx="1.5" />

          {/* Momentum Arrow */}
          <path
            d="M 165 60 L 195 28 M 185 28 L 195 28 L 195 38"
            stroke={green}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="190" y="55" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.trend")}
          </text>
        </svg>
      );

    case "tweezer":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          {/* Candle 1 (Red) */}
          <line
            x1="90"
            y1="35"
            x2="90"
            y2="105"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="82" y="42" width="16" height="38" fill={red} rx="1.5" />

          {/* Candle 2 (Green with identical low) */}
          <line
            x1="125"
            y1="45"
            x2="125"
            y2="105"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="117" y="52" width="16" height="36" fill={green} rx="1.5" />

          {/* Matching Bottom Line */}
          <line
            x1="70"
            y1="105"
            x2="185"
            y2="105"
            stroke={green}
            strokeWidth="2"
          />
          <circle cx="90" cy="105" r="3" fill={green} />
          <circle cx="125" cy="105" r="3" fill={green} />
          <text x="190" y="108" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.equal_lows")}
          </text>
        </svg>
      );

    case "piercing_line":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <line
            x1="85"
            y1="30"
            x2="85"
            y2="95"
            stroke={red}
            strokeWidth="1.5"
          />
          <rect x="77" y="38" width="16" height="48" fill={red} rx="1.5" />

          {/* Piercing Green Candle */}
          <line
            x1="125"
            y1="42"
            x2="125"
            y2="110"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="117" y="50" width="16" height="52" fill={green} rx="1.5" />

          <line
            x1="60"
            y1="62"
            x2="175"
            y2="62"
            stroke={muted}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="180" y="65" fill={muted} fontSize="8" fontWeight="bold">
            {t("learn.visual.midpoint")}
          </text>
        </svg>
      );

    case "rising_three":
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          {/* Day 1: Giant Green */}
          <rect x="40" y="35" width="16" height="65" fill={green} rx="1" />

          {/* Days 2-4: 3 small reds inside range */}
          <rect x="68" y="42" width="10" height="12" fill={red} rx="1" />
          <rect x="88" y="52" width="10" height="12" fill={red} rx="1" />
          <rect x="108" y="62" width="10" height="12" fill={red} rx="1" />

          {/* Day 5: Giant Green breakout */}
          <rect x="132" y="20" width="16" height="75" fill={green} rx="1" />

          {/* Range guidelines */}
          <line
            x1="35"
            y1="35"
            x2="155"
            y2="35"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <line
            x1="35"
            y1="100"
            x2="155"
            y2="100"
            stroke={muted}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        </svg>
      );

    case "falling_three":
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <rect x="40" y="25" width="16" height="65" fill={red} rx="1" />
          <rect x="68" y="50" width="10" height="12" fill={green} rx="1" />
          <rect x="88" y="58" width="10" height="12" fill={green} rx="1" />
          <rect x="108" y="66" width="10" height="12" fill={green} rx="1" />
          <rect x="132" y="35" width="16" height="75" fill={red} rx="1" />
          <line
            x1="35"
            y1="25"
            x2="155"
            y2="25"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <line
            x1="35"
            y1="90"
            x2="155"
            y2="90"
            stroke={muted}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        </svg>
      );

    case "dragonfly_doji":
    case "gravestone_doji": {
      const isDragonfly = type === "dragonfly_doji";
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <line
            x1="120"
            y1={isDragonfly ? 58 : 20}
            x2="120"
            y2={isDragonfly ? 125 : 82}
            stroke={isDragonfly ? green : red}
            strokeWidth="2"
          />
          <rect
            x="108"
            y="58"
            width="24"
            height="3"
            fill={isDragonfly ? green : red}
            rx="1"
          />
          <text
            x="120"
            y={isDragonfly ? 18 : 130}
            fill={isDragonfly ? green : red}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {isDragonfly
              ? t("learn.visual.dragonfly")
              : t("learn.visual.gravestone")}
          </text>
        </svg>
      );
    }

    case "spinning_top":
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <line
            x1="120"
            y1="20"
            x2="120"
            y2="120"
            stroke={muted}
            strokeWidth="2"
          />
          <rect x="105" y="58" width="30" height="22" fill={primary} rx="2" />
          <line
            x1="85"
            y1="69"
            x2="155"
            y2="69"
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text
            x="120"
            y="132"
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.neutral_label")}
          </text>
        </svg>
      );

    case "dark_cloud_cover":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <rect x="70" y="28" width="16" height="55" fill={green} rx="1.5" />
          <line
            x1="78"
            y1="18"
            x2="78"
            y2="95"
            stroke={green}
            strokeWidth="1.5"
          />
          <rect x="120" y="52" width="16" height="58" fill={red} rx="1.5" />
          <line
            x1="128"
            y1="42"
            x2="128"
            y2="120"
            stroke={red}
            strokeWidth="1.5"
          />
          <line
            x1="50"
            y1="70"
            x2="170"
            y2="70"
            stroke={muted}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text x="175" y="73" fill={muted} fontSize="8" fontWeight="bold">
            {t("learn.visual.midpoint")}
          </text>
        </svg>
      );

    case "bullish_harami":
    case "bearish_harami": {
      const isBullish = type === "bullish_harami";
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <rect
            x="72"
            y="28"
            width="22"
            height="78"
            fill={isBullish ? red : green}
            rx="1.5"
          />
          <line
            x1="83"
            y1="18"
            x2="83"
            y2="116"
            stroke={isBullish ? red : green}
            strokeWidth="1.5"
          />
          <rect
            x="118"
            y="55"
            width="15"
            height="30"
            fill={isBullish ? green : red}
            rx="1.5"
          />
          <line
            x1="125.5"
            y1="45"
            x2="125.5"
            y2="95"
            stroke={isBullish ? green : red}
            strokeWidth="1.5"
          />
          <text
            x="120"
            y="130"
            fill={isBullish ? green : red}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.trigger")}
          </text>
        </svg>
      );
    }

    case "evening_star":
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <rect x="55" y="30" width="18" height="55" fill={green} rx="1.5" />
          <rect x="105" y="55" width="12" height="12" fill={muted} rx="1.5" />
          <rect x="150" y="58" width="18" height="58" fill={red} rx="1.5" />
          <line
            x1="64"
            y1="20"
            x2="64"
            y2="95"
            stroke={green}
            strokeWidth="1.5"
          />
          <line
            x1="111"
            y1="45"
            x2="111"
            y2="75"
            stroke={muted}
            strokeWidth="1.5"
          />
          <line
            x1="159"
            y1="48"
            x2="159"
            y2="125"
            stroke={red}
            strokeWidth="1.5"
          />
        </svg>
      );

    case "three_crows":
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <rect x="55" y="28" width="16" height="52" fill={red} rx="1" />
          <rect x="100" y="48" width="16" height="52" fill={red} rx="1" />
          <rect x="145" y="68" width="16" height="52" fill={red} rx="1" />
          <path
            d="M 63 20 L 108 40 L 153 60"
            fill="none"
            stroke={red}
            strokeWidth="2"
          />
        </svg>
      );

    // ── CHART PATTERNS ─────────────────────────────────────────────────
    case "head_and_shoulders":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Price Path */}
          <path
            d="M 25 105 L 55 55 L 75 88 L 115 25 L 145 88 L 175 58 L 205 115"
            fill="none"
            stroke={red}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Neckline */}
          <line
            x1="60"
            y1="88"
            x2="225"
            y2="88"
            stroke={primary}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <text x="230" y="91" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.neckline")}
          </text>

          {/* Head & Shoulders Labels */}
          <text
            x="55"
            y="45"
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.left_shoulder")}
          </text>
          <text
            x="115"
            y="16"
            fill={red}
            fontSize="9"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.head")}
          </text>
          <text
            x="175"
            y="48"
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.right_shoulder")}
          </text>

          {/* Measured Move projection */}
          <line
            x1="115"
            y1="25"
            x2="115"
            y2="88"
            stroke={muted}
            strokeOpacity="0.4"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <line
            x1="205"
            y1="88"
            x2="205"
            y2="135"
            stroke={green}
            strokeWidth="2"
          />
          <path
            d="M 201 127 L 205 135 L 209 127"
            fill="none"
            stroke={green}
            strokeWidth="2"
          />
          <text x="215" y="130" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.target")}
          </text>
        </svg>
      );

    case "inverse_head_and_shoulders":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Price Path */}
          <path
            d="M 25 35 L 55 85 L 75 50 L 115 115 L 145 50 L 175 80 L 205 25"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Neckline */}
          <line
            x1="60"
            y1="50"
            x2="225"
            y2="50"
            stroke={primary}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <text x="230" y="53" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.neckline")}
          </text>

          {/* Labels */}
          <text
            x="55"
            y="98"
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.left_shoulder")}
          </text>
          <text
            x="115"
            y="128"
            fill={green}
            fontSize="9"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.head")}
          </text>
          <text
            x="175"
            y="93"
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.right_shoulder")}
          </text>

          {/* Target */}
          <line
            x1="205"
            y1="50"
            x2="205"
            y2="12"
            stroke={green}
            strokeWidth="2"
          />
          <path
            d="M 201 18 L 205 10 L 209 18"
            fill="none"
            stroke={green}
            strokeWidth="2"
          />
          <text x="215" y="15" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.target")}
          </text>
        </svg>
      );

    case "double_top":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <path
            d="M 30 110 L 75 35 L 115 85 L 155 35 L 195 120"
            fill="none"
            stroke={red}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Resistance */}
          <line
            x1="60"
            y1="35"
            x2="170"
            y2="35"
            stroke={red}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {/* Neckline */}
          <line
            x1="90"
            y1="85"
            x2="220"
            y2="85"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text x="225" y="88" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.trigger")}
          </text>
          <text
            x="75"
            y="25"
            fill={red}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.top_1")}
          </text>
          <text
            x="155"
            y="25"
            fill={red}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.top_2")}
          </text>
        </svg>
      );

    case "double_bottom":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <path
            d="M 30 30 L 75 105 L 115 55 L 155 105 L 195 20"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Support floor */}
          <line
            x1="60"
            y1="105"
            x2="170"
            y2="105"
            stroke={green}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {/* Neckline breakout */}
          <line
            x1="90"
            y1="55"
            x2="220"
            y2="55"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text x="225" y="58" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.breakout")}
          </text>
          <text
            x="75"
            y="120"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.bottom_1")}
          </text>
          <text
            x="155"
            y="120"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.bottom_2")}
          </text>
        </svg>
      );

    case "cup_and_handle":
    case "inverse_cup_and_handle": {
      const isInverse = type === "inverse_cup_and_handle";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Rim or support line */}
          <line
            x1="35"
            y1={isInverse ? 95 : 45}
            x2="225"
            y2={isInverse ? 95 : 45}
            stroke={primary}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <text
            x="228"
            y={isInverse ? 98 : 48}
            fill={primary}
            fontSize="8"
            fontWeight="bold"
          >
            {t("learn.visual.rim")}
          </text>

          {/* Cup and handle curve */}
          <path
            d={
              isInverse
                ? "M 40 95 Q 95 15 145 95 Q 165 70 180 78 L 205 120"
                : "M 40 45 Q 95 125 145 45 Q 165 70 180 62 L 205 20"
            }
            fill="none"
            stroke={isInverse ? red : green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="95"
            y={isInverse ? 30 : 115}
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.cup")}
          </text>
          <text
            x="175"
            y={isInverse ? 66 : 80}
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.handle")}
          </text>
        </svg>
      );
    }

    case "bull_flag":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Pole */}
          <line
            x1="45"
            y1="120"
            x2="95"
            y2="35"
            stroke={green}
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Flag channel */}
          <line
            x1="95"
            y1="35"
            x2="160"
            y2="60"
            stroke={primary}
            strokeWidth="2"
          />
          <line
            x1="85"
            y1="60"
            x2="150"
            y2="85"
            stroke={primary}
            strokeWidth="2"
          />

          {/* Price zigzag inside flag */}
          <path
            d="M 95 35 L 105 55 L 125 45 L 135 68 L 155 58 L 195 18"
            fill="none"
            stroke={green}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="70" y="85" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.pole")}
          </text>
          <text x="125" y="32" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.breakout")}
          </text>
        </svg>
      );

    case "bear_flag":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Pole down */}
          <line
            x1="45"
            y1="25"
            x2="95"
            y2="110"
            stroke={red}
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Flag upward channel */}
          <line
            x1="85"
            y1="85"
            x2="150"
            y2="60"
            stroke={primary}
            strokeWidth="2"
          />
          <line
            x1="95"
            y1="110"
            x2="160"
            y2="85"
            stroke={primary}
            strokeWidth="2"
          />

          {/* Price zigzag */}
          <path
            d="M 95 110 L 105 90 L 125 100 L 135 78 L 155 88 L 195 128"
            fill="none"
            stroke={red}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="70" y="60" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.pole")}
          </text>
          <text x="125" y="115" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.breakdown")}
          </text>
        </svg>
      );

    case "ascending_triangle":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Flat Top */}
          <line x1="40" y1="40" x2="200" y2="40" stroke={red} strokeWidth="2" />
          {/* Ascending Trendline */}
          <line
            x1="40"
            y1="115"
            x2="185"
            y2="40"
            stroke={green}
            strokeWidth="2"
          />

          {/* Price bounces */}
          <path
            d="M 45 115 L 70 40 L 95 90 L 120 40 L 145 68 L 170 40 L 205 15"
            fill="none"
            stroke={green}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="120"
            y="32"
            fill={red}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.flat_resistance")}
          </text>
          <text x="100" y="110" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.higher_lows")}
          </text>
        </svg>
      );

    case "descending_triangle":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Flat Floor */}
          <line
            x1="40"
            y1="100"
            x2="200"
            y2="100"
            stroke={green}
            strokeWidth="2"
          />
          {/* Descending Trendline */}
          <line
            x1="40"
            y1="25"
            x2="185"
            y2="100"
            stroke={red}
            strokeWidth="2"
          />

          {/* Price bounces */}
          <path
            d="M 45 25 L 70 100 L 95 50 L 120 100 L 145 72 L 170 100 L 205 125"
            fill="none"
            stroke={red}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="120"
            y="115"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.flat_support")}
          </text>
          <text x="100" y="35" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.lower_highs")}
          </text>
        </svg>
      );

    case "falling_wedge":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Upper steeper line */}
          <line
            x1="40"
            y1="30"
            x2="180"
            y2="95"
            stroke={primary}
            strokeWidth="2"
          />
          {/* Lower shallower line */}
          <line
            x1="40"
            y1="75"
            x2="180"
            y2="110"
            stroke={primary}
            strokeWidth="2"
          />

          {/* Zigzag */}
          <path
            d="M 45 35 L 70 85 L 95 50 L 120 95 L 145 70 L 165 100 L 205 45"
            fill="none"
            stroke={green}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="195" y="40" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.breakout")}
          </text>
        </svg>
      );

    case "rising_wedge":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <line
            x1="40"
            y1="100"
            x2="180"
            y2="35"
            stroke={primary}
            strokeWidth="2"
          />
          <line
            x1="40"
            y1="125"
            x2="180"
            y2="75"
            stroke={primary}
            strokeWidth="2"
          />
          <path
            d="M 45 108 L 70 72 L 95 98 L 120 58 L 145 82 L 168 45 L 210 115"
            fill="none"
            stroke={red}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="195" y="35" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.breakdown")}
          </text>
        </svg>
      );

    case "triple_top":
    case "triple_bottom": {
      const isTop = type === "triple_top";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <line
            x1="35"
            y1="100"
            x2="215"
            y2="100"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <path
            d={
              isTop
                ? "M 30 120 L 65 42 L 100 100 L 135 45 L 170 100 L 205 44 L 235 125"
                : "M 30 25 L 65 100 L 100 45 L 135 100 L 170 48 L 205 100 L 235 15"
            }
            fill="none"
            stroke={isTop ? red : green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="38" y="115" fill={muted} fontSize="8" fontWeight="bold">
            {isTop ? t("learn.visual.neckline") : t("learn.visual.neckline")}
          </text>
        </svg>
      );
    }

    case "rounding_top":
    case "rounding_bottom": {
      const isTop = type === "rounding_top";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <path
            d={
              isTop
                ? "M 25 105 Q 75 20 130 45 Q 185 70 235 110"
                : "M 25 35 Q 75 120 130 95 Q 185 70 235 30"
            }
            fill="none"
            stroke={isTop ? red : green}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="25"
            y1={isTop ? 105 : 35}
            x2="235"
            y2={isTop ? 105 : 35}
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text
            x="130"
            y={isTop ? 125 : 20}
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.breakout")}
          </text>
        </svg>
      );
    }

    case "ascending_channel":
    case "descending_channel": {
      const isAscending = type === "ascending_channel";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <line
            x1="30"
            y1={isAscending ? 105 : 35}
            x2="220"
            y2={isAscending ? 35 : 105}
            stroke={primary}
            strokeWidth="2"
          />
          <line
            x1="30"
            y1={isAscending ? 130 : 60}
            x2="220"
            y2={isAscending ? 60 : 130}
            stroke={primary}
            strokeWidth="2"
          />
          <path
            d={
              isAscending
                ? "M 35 115 L 65 75 L 95 100 L 125 55 L 155 82 L 185 40 L 235 20"
                : "M 35 25 L 65 65 L 95 40 L 125 85 L 155 58 L 185 100 L 235 120"
            }
            fill="none"
            stroke={isAscending ? green : red}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    case "symmetrical_triangle":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <line x1="35" y1="28" x2="170" y2="82" stroke={red} strokeWidth="2" />
          <line
            x1="35"
            y1="115"
            x2="170"
            y2="82"
            stroke={green}
            strokeWidth="2"
          />
          <path
            d="M 40 100 L 70 38 L 95 86 L 120 55 L 145 75 L 180 82 L 235 35"
            fill="none"
            stroke={primary}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text x="188" y="28" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.breakout")}
          </text>
        </svg>
      );

    case "rectangle":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <rect
            x="38"
            y="35"
            width="155"
            height="70"
            fill="none"
            stroke={primary}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <path
            d="M 25 100 L 60 45 L 90 98 L 120 42 L 150 94 L 185 50 L 235 25"
            fill="none"
            stroke={muted}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text x="198" y="20" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.breakout")}
          </text>
        </svg>
      );

    case "bull_pennant":
    case "bear_pennant": {
      const isBull = type === "bull_pennant";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <path
            d={isBull ? "M 25 120 L 78 30" : "M 25 20 L 78 112"}
            fill="none"
            stroke={isBull ? green : red}
            strokeWidth="2.5"
          />
          <path
            d="M 78 30 L 160 70 L 78 112 Z"
            fill="none"
            stroke={primary}
            strokeWidth="2"
          />
          <path
            d={isBull ? "M 160 70 L 235 25" : "M 160 70 L 235 120"}
            fill="none"
            stroke={isBull ? green : red}
            strokeWidth="2.5"
          />
        </svg>
      );
    }

    // ── STRATEGIES & SMC ───────────────────────────────────────────────
    case "ema_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />

          {/* Keep the fast EMA visible but let the EMA 50/200 crossover lead. */}
          <path
            d="M 20 100 C 48 94 74 89 94 79 C 112 69 128 57 144 52 C 160 48 176 55 190 70 C 206 86 224 96 240 103"
            fill="none"
            stroke={muted}
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 20 108 C 65 105 92 100 115 90 C 140 78 155 62 172 68 C 188 74 202 87 240 100"
            fill="none"
            stroke={warning}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 20 103 C 65 101 92 96 115 90 C 140 84 155 77 172 74 C 190 72 214 80 240 84"
            fill="none"
            stroke={primary}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* The dots sit directly on the EMA 50/200 intersections. */}
          <circle cx="115" cy="90" r="4" fill={green} />
          <text
            x="115"
            y="80"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.golden_cross")}
          </text>

          <circle cx="190" cy="74" r="4" fill={red} />
          <text
            x="190"
            y="88"
            fill={red}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.death_cross")}
          </text>

          {/* Compact legend keeps line meaning explicit without extra guides. */}
          <text x="22" y="135" fill={muted} fontSize="8" fontWeight="bold">
            EMA 20
          </text>
          <text x="82" y="135" fill={warning} fontSize="8" fontWeight="bold">
            EMA 50
          </text>
          <text x="142" y="135" fill={primary} fontSize="8" fontWeight="bold">
            EMA 200
          </text>
        </svg>
      );

    case "rsi_divergence":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Price chart on top */}
          <path
            d="M 30 55 L 75 25 L 115 45 L 165 15 L 205 60"
            fill="none"
            stroke={green}
            strokeWidth="2"
          />
          {/* Price higher high line */}
          <line
            x1="75"
            y1="25"
            x2="165"
            y2="15"
            stroke={green}
            strokeWidth="2"
            strokeDasharray="3 3"
          />
          <text
            x="120"
            y="15"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.higher_high_price")}
          </text>

          {/* Divider */}
          <line
            x1="20"
            y1="75"
            x2="240"
            y2="75"
            stroke={muted}
            strokeOpacity="0.1"
          />

          {/* RSI chart below */}
          <path
            d="M 30 115 L 75 90 L 115 110 L 165 105 L 205 130"
            fill="none"
            stroke={primary}
            strokeWidth="2"
          />
          {/* RSI lower high line */}
          <line
            x1="75"
            y1="90"
            x2="165"
            y2="105"
            stroke={red}
            strokeWidth="2"
            strokeDasharray="3 3"
          />
          <text
            x="120"
            y="125"
            fill={red}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.lower_high_rsi")}
          </text>
        </svg>
      );

    case "smc_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Trendline structure */}
          <path
            d="M 25 110 L 65 60 L 95 85 L 145 35 L 175 60 L 225 15"
            fill="none"
            stroke={green}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* BOS Lines */}
          <line
            x1="65"
            y1="60"
            x2="145"
            y2="60"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text
            x="105"
            y="53"
            fill={primary}
            fontSize="7.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            BOS
          </text>

          <line
            x1="145"
            y1="35"
            x2="225"
            y2="35"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text
            x="185"
            y="28"
            fill={primary}
            fontSize="7.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            BOS
          </text>

          {/* Order Block Box */}
          <rect
            x="85"
            y="74"
            width="22"
            height="18"
            rx="2"
            fill={primary}
            fillOpacity="0.25"
            stroke={primary}
            strokeWidth="1"
          />
          <text
            x="96"
            y="86"
            fill={primary}
            fontSize="7.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            OB
          </text>
        </svg>
      );

    case "atr_strategy":
      return (
        <svg viewBox="0 0 280 140" className={className}>
          <rect width="280" height="140" fill="transparent" />
          {/* Target (3x ATR, 2:1 R:R) */}
          <line
            x1="25"
            y1="25"
            x2="205"
            y2="25"
            stroke={green}
            strokeWidth="2"
          />
          <text x="30" y="19" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.target_110")}
          </text>

          {/* Entry Level */}
          <line
            x1="25"
            y1="65"
            x2="205"
            y2="65"
            stroke={primary}
            strokeWidth="2"
          />
          <text x="30" y="59" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.entry_price_100")}
          </text>

          {/* Stop Loss (1.5x ATR) */}
          <line
            x1="25"
            y1="105"
            x2="205"
            y2="105"
            stroke={red}
            strokeWidth="2"
          />
          <text x="30" y="99" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.stop_loss_95")}
          </text>

          {/* Gain 2R bracket */}
          <path
            d="M 210 25 L 220 25 L 220 65 L 210 65"
            fill="none"
            stroke={green}
            strokeWidth="1.5"
          />
          <text x="226" y="48" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.gain_2r")}
          </text>

          {/* Risk 1R bracket */}
          <path
            d="M 210 65 L 220 65 L 220 105 L 210 105"
            fill="none"
            stroke={red}
            strokeWidth="1.5"
          />
          <text x="226" y="88" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.risk_1r")}
          </text>
        </svg>
      );

    case "bollinger_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />

          {/* The band envelope contracts first, then expands with volatility. */}
          <path
            d="M 24 54 C 58 48 94 52 128 67 C 160 42 196 28 236 20 L 236 120 C 196 112 160 100 128 73 C 94 88 58 92 24 86 Z"
            fill={primary}
            fillOpacity="0.08"
            stroke="none"
          />
          <path
            d="M 24 54 C 58 48 94 52 128 67 C 160 42 196 28 236 20"
            fill="none"
            stroke={primary}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 24 86 C 58 92 94 88 128 73 C 160 100 196 112 236 120"
            fill="none"
            stroke={primary}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Middle 20 SMA keeps the squeeze centered. */}
          <path
            d="M 24 70 C 60 70 94 70 128 70 C 160 70 198 70 236 70"
            fill="none"
            stroke={muted}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Price stays compressed, then breaks higher as the bands widen. */}
          <path
            d="M 26 70 L 42 66 L 58 75 L 74 68 L 90 73 L 106 66 L 120 72 L 130 68"
            fill="none"
            stroke={muted}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 130 68 L 145 62 L 158 72 L 174 50 L 190 56 L 206 34 L 222 22 L 236 16"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <circle cx="130" cy="68" r="4" fill={green} />
          <text
            x="74"
            y="112"
            fill={primary}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.squeeze")}
          </text>
          <text
            x="196"
            y="132"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.expansion")}
          </text>
        </svg>
      );

    case "mtf_strategy":
      return (
        <svg viewBox="0 0 300 140" className={className}>
          <rect width="300" height="140" fill="transparent" />
          {/* Step 1 Daily */}
          <rect
            x="12"
            y="20"
            width="80"
            height="100"
            rx="4"
            fill={primary}
            fillOpacity="0.2"
            stroke={primary}
            strokeWidth="1"
          />
          <text
            x="52"
            y="36"
            fill={primary}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.daily")}
          </text>
          <text
            x="52"
            y="54"
            fill={muted}
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.macro_bias")}
          </text>
          <text
            x="52"
            y="72"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            &gt; EMA 200
          </text>
          <text
            x="52"
            y="92"
            fill={muted}
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.bullish_flow")}
          </text>

          {/* Arrow 1 */}
          <path
            d="M 96 70 L 106 70"
            stroke={muted}
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Step 2 4-Hour */}
          <rect
            x="110"
            y="20"
            width="80"
            height="100"
            rx="4"
            fill={green}
            fillOpacity="0.14"
            stroke={green}
            strokeWidth="1"
          />
          <text
            x="150"
            y="36"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.four_hour")}
          </text>
          <text
            x="150"
            y="54"
            fill={muted}
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.structure")}
          </text>
          <text
            x="150"
            y="72"
            fill={green}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.pullback")}
          </text>
          <text
            x="150"
            y="92"
            fill={muted}
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.key_support")}
          </text>

          {/* Arrow 2 */}
          <path
            d="M 194 70 L 204 70"
            stroke={muted}
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Step 3 15-Minute */}
          <rect
            x="208"
            y="20"
            width="80"
            height="100"
            rx="4"
            fill={primary}
            fillOpacity="0.2"
            stroke={primary}
            strokeWidth="1"
          />
          <text
            x="248"
            y="36"
            fill={primary}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.fifteen_minute")}
          </text>
          <text
            x="248"
            y="54"
            fill={muted}
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.sniper_entry")}
          </text>
          <text
            x="248"
            y="72"
            fill={primary}
            fontSize="7"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.choch_pattern")}
          </text>
          <text
            x="248"
            y="92"
            fill={green}
            fontSize="7.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            1:4 R:R
          </text>
        </svg>
      );

    case "macd_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <line
            x1="25"
            y1="70"
            x2="235"
            y2="70"
            stroke={muted}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {[42, 52, 35, 58, 48, 66, 55].map((height, index) => (
            <rect
              key={index}
              x={35 + index * 27}
              y={height}
              width="12"
              height={70 - height}
              fill={index % 2 ? red : green}
              fillOpacity="0.65"
              rx="1"
            />
          ))}
          <path
            d="M 25 45 C 55 88 78 35 108 78 S 165 38 235 58"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
          />
          <path
            d="M 25 52 C 65 72 90 50 120 68 S 185 52 235 45"
            fill="none"
            stroke={primary}
            strokeWidth="2"
          />
          <text x="28" y="20" fill={green} fontSize="8" fontWeight="bold">
            MACD
          </text>
          <text x="70" y="20" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.signal")}
          </text>
        </svg>
      );

    case "stochastic_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <rect
            x="25"
            y="28"
            width="210"
            height="22"
            fill={red}
            fillOpacity="0.08"
          />
          <rect
            x="25"
            y="90"
            width="210"
            height="22"
            fill={green}
            fillOpacity="0.08"
          />
          <line
            x1="25"
            y1="28"
            x2="235"
            y2="28"
            stroke={red}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <line
            x1="25"
            y1="112"
            x2="235"
            y2="112"
            stroke={green}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <path
            d="M 25 100 C 55 35 82 112 112 48 S 165 92 235 38"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
          />
          <path
            d="M 25 86 C 58 55 82 102 115 62 S 175 70 235 58"
            fill="none"
            stroke={primary}
            strokeWidth="2"
          />
          <text x="30" y="23" fill={red} fontSize="8" fontWeight="bold">
            80
          </text>
          <text x="30" y="124" fill={green} fontSize="8" fontWeight="bold">
            20
          </text>
          <text x="190" y="23" fill={green} fontSize="8" fontWeight="bold">
            %K / %D
          </text>
        </svg>
      );

    case "vwap_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <path
            d="M 25 78 C 60 68 92 88 125 75 S 188 60 235 72"
            fill="none"
            stroke={primary}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <path
            d="M 25 52 L 55 36 L 82 62 L 110 80 L 138 104 L 168 82 L 198 50 L 235 32"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="110" cy="80" r="4" fill={green} />
          <circle cx="168" cy="82" r="4" fill={green} />
          <text x="28" y="20" fill={primary} fontSize="8" fontWeight="bold">
            VWAP
          </text>
          <text x="98" y="96" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.retest")}
          </text>
        </svg>
      );

    case "volume_profile_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {[22, 42, 66, 92, 70, 50].map((width, index) => (
            <rect
              key={index}
              x="32"
              y={24 + index * 16}
              width={width}
              height="9"
              fill={index === 3 ? primary : muted}
              fillOpacity={index === 3 ? 0.8 : 0.55}
              rx="1"
            />
          ))}
          <line
            x1="32"
            y1="76"
            x2="235"
            y2="76"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <path
            d="M 185 118 L 195 92 L 188 68 L 210 45 L 228 22"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text x="38" y="18" fill={primary} fontSize="8" fontWeight="bold">
            POC
          </text>
          <text x="188" y="132" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.price")}
          </text>
        </svg>
      );

    case "fibonacci_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <path
            d="M 32 112 L 218 28"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
          />
          {[48, 70, 88, 106].map((y, index) => (
            <g key={y}>
              <line
                x1="32"
                y1={y}
                x2="228"
                y2={y}
                stroke={index === 2 ? primary : muted}
                strokeWidth={index === 2 ? 1.5 : 1}
                strokeDasharray="3 3"
              />
              <text
                x="34"
                y={y - 3}
                fill={index === 2 ? primary : muted}
                fontSize="7"
              >
                {["38.2", "50.0", "61.8", "78.6"][index]}%
              </text>
            </g>
          ))}
          <path
            d="M 32 112 L 95 76 L 132 96 L 168 64 L 218 28"
            fill="none"
            stroke={green}
            strokeWidth="2"
          />
        </svg>
      );

    case "support_resistance_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <line
            x1="25"
            y1="34"
            x2="235"
            y2="34"
            stroke={red}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <line
            x1="25"
            y1="106"
            x2="235"
            y2="106"
            stroke={green}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <path
            d="M 25 86 L 52 58 L 78 92 L 108 45 L 138 78 L 165 43 L 195 86 L 235 56"
            fill="none"
            stroke={primary}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text x="28" y="27" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.resistance")}
          </text>
          <text x="28" y="123" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.support")}
          </text>
          <circle cx="195" cy="86" r="4" fill={green} />
        </svg>
      );

    case "buy_side_liquidity_strategy":
    case "sell_side_liquidity_strategy":
    case "liquidity_pool_strategy": {
      const isBuySide = type !== "sell_side_liquidity_strategy";
      const level = isBuySide ? 38 : 102;
      const sweep = isBuySide
        ? "M 160 82 L 178 24 L 194 70 L 225 48"
        : "M 160 58 L 178 116 L 194 70 L 225 92";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <line
            x1="30"
            y1={level}
            x2="150"
            y2={level}
            stroke={isBuySide ? red : green}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <line
            x1="62"
            y1={level - (isBuySide ? 8 : -8)}
            x2="62"
            y2={level + (isBuySide ? 8 : -8)}
            stroke={muted}
            strokeWidth="2"
          />
          <line
            x1="112"
            y1={level - (isBuySide ? 8 : -8)}
            x2="112"
            y2={level + (isBuySide ? 8 : -8)}
            stroke={muted}
            strokeWidth="2"
          />
          <path
            d={sweep}
            fill="none"
            stroke={isBuySide ? red : green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="32"
            y={isBuySide ? 27 : 128}
            fill={isBuySide ? red : green}
            fontSize="8"
            fontWeight="bold"
          >
            {isBuySide
              ? t("learn.visual.buy_side_liquidity")
              : t("learn.visual.sell_side_liquidity")}
          </text>
          <text
            x="178"
            y={isBuySide ? 20 : 132}
            fill={primary}
            fontSize="8"
            fontWeight="bold"
          >
            {t("learn.visual.sweep")}
          </text>
        </svg>
      );
    }

    case "order_block_strategy":
    case "bearish_order_block_strategy": {
      const isBullish = type === "order_block_strategy";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <rect
            x="72"
            y={isBullish ? 80 : 42}
            width="62"
            height="24"
            fill={isBullish ? green : red}
            fillOpacity="0.2"
            stroke={isBullish ? green : red}
            strokeWidth="1.5"
            rx="2"
          />
          <path
            d={
              isBullish
                ? "M 25 62 L 55 92 L 80 70 L 112 80 L 145 42 L 180 65 L 220 22"
                : "M 25 82 L 55 52 L 80 70 L 112 42 L 145 98 L 180 72 L 220 116"
            }
            fill="none"
            stroke={isBullish ? green : red}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="103"
            y1={isBullish ? 80 : 66}
            x2="103"
            y2={isBullish ? 48 : 105}
            stroke={primary}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x="78"
            y={isBullish ? 96 : 58}
            fill={isBullish ? green : red}
            fontSize="8"
            fontWeight="bold"
          >
            {t("learn.visual.order_block")}
          </text>
          <text
            x="185"
            y={isBullish ? 20 : 130}
            fill={primary}
            fontSize="8"
            fontWeight="bold"
          >
            {t("learn.visual.entry")}
          </text>
        </svg>
      );
    }

    case "fvg_strategy":
    case "bearish_fvg_strategy": {
      const isBullish = type === "fvg_strategy";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <rect
            x="96"
            y={isBullish ? 38 : 78}
            width="58"
            height="24"
            fill={isBullish ? green : red}
            fillOpacity="0.2"
            stroke={isBullish ? green : red}
            strokeWidth="1.5"
            strokeDasharray="3 2"
            rx="2"
          />
          <line
            x1="62"
            y1="30"
            x2="62"
            y2="112"
            stroke={muted}
            strokeWidth="1"
          />
          <line
            x1="125"
            y1={isBullish ? 22 : 66}
            x2="125"
            y2={isBullish ? 82 : 128}
            stroke={isBullish ? green : red}
            strokeWidth="2"
          />
          <line
            x1="188"
            y1="28"
            x2="188"
            y2="116"
            stroke={muted}
            strokeWidth="1"
          />
          <path
            d={
              isBullish
                ? "M 54 94 L 70 58 L 92 86 M 180 78 L 198 40 L 218 62"
                : "M 54 44 L 70 82 L 92 54 M 180 62 L 198 100 L 218 78"
            }
            fill="none"
            stroke={isBullish ? green : red}
            strokeWidth="8"
            strokeLinecap="round"
          />
          <text
            x="105"
            y={isBullish ? 34 : 74}
            fill={isBullish ? green : red}
            fontSize="8"
            fontWeight="bold"
          >
            FVG
          </text>
          <text
            x="185"
            y={isBullish ? 20 : 130}
            fill={primary}
            fontSize="8"
            fontWeight="bold"
          >
            {t("learn.visual.retest")}
          </text>
        </svg>
      );
    }

    case "premium_zone_strategy":
    case "discount_zone_strategy":
    case "premium_discount_strategy": {
      const isDiscount = type === "discount_zone_strategy";
      const isGeneric = type === "premium_discount_strategy";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <rect
            x="35"
            y="25"
            width="190"
            height="45"
            fill={red}
            fillOpacity={isDiscount ? 0.05 : 0.16}
          />
          <rect
            x="35"
            y="70"
            width="190"
            height="45"
            fill={green}
            fillOpacity={isGeneric ? 0.12 : isDiscount ? 0.16 : 0.05}
          />
          <line
            x1="35"
            y1="70"
            x2="225"
            y2="70"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <path
            d="M 42 104 L 78 82 L 108 94 L 140 48 L 170 64 L 205 32 L 226 44"
            fill="none"
            stroke={primary}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text x="43" y="42" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.premium")}
          </text>
          <text x="43" y="105" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.discount")}
          </text>
          <text x="188" y="68" fill={primary} fontSize="8" fontWeight="bold">
            50%
          </text>
        </svg>
      );
    }

    case "breaker_block_strategy":
    case "bearish_breaker_strategy": {
      const isBullish = type === "breaker_block_strategy";
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <rect
            x="72"
            y={isBullish ? 78 : 38}
            width="68"
            height="26"
            fill={isBullish ? green : red}
            fillOpacity="0.18"
            stroke={isBullish ? green : red}
            strokeWidth="1.5"
            rx="2"
          />
          <path
            d={
              isBullish
                ? "M 24 55 L 58 86 L 92 66 L 122 88 L 158 44 L 190 65 L 232 22"
                : "M 24 86 L 58 55 L 92 76 L 122 52 L 158 98 L 190 73 L 232 118"
            }
            fill="none"
            stroke={isBullish ? green : red}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={
              isBullish
                ? "M 144 96 L 162 96 L 156 90 M 162 96 L 156 102"
                : "M 144 44 L 162 44 L 156 38 M 162 44 L 156 50"
            }
            fill="none"
            stroke={primary}
            strokeWidth="1.5"
          />
          <text
            x="78"
            y={isBullish ? 94 : 54}
            fill={isBullish ? green : red}
            fontSize="8"
            fontWeight="bold"
          >
            {t("learn.visual.breaker")}
          </text>
          <text
            x="182"
            y={isBullish ? 20 : 130}
            fill={primary}
            fontSize="8"
            fontWeight="bold"
          >
            {t("learn.visual.retest")}
          </text>
        </svg>
      );
    }

    case "liquidity_sweep_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <line
            x1="28"
            y1="45"
            x2="140"
            y2="45"
            stroke={red}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <path
            d="M 25 105 L 58 75 L 88 96 L 120 58 L 148 82 L 170 24 L 190 76 L 232 42"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="170" cy="45" r="4" fill={red} />
          <path
            d="M 170 20 L 170 8 M 170 8 L 165 14 M 170 8 L 175 14"
            stroke={red}
            strokeWidth="1.5"
            fill="none"
          />
          <text x="30" y="35" fill={red} fontSize="8" fontWeight="bold">
            {t("learn.visual.liquidity")}
          </text>
          <text x="192" y="36" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.reclaim")}
          </text>
        </svg>
      );

    case "displacement_strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          <path
            d="M 24 102 L 52 86 L 76 96 L 102 78"
            fill="none"
            stroke={muted}
            strokeWidth="2"
          />
          <line
            x1="100"
            y1="78"
            x2="232"
            y2="78"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <rect x="118" y="25" width="22" height="80" fill={green} rx="2" />
          <line
            x1="129"
            y1="16"
            x2="129"
            y2="115"
            stroke={green}
            strokeWidth="2"
          />
          <path
            d="M 150 86 L 178 58 L 205 70 L 235 30"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text x="108" y="20" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.displacement")}
          </text>
          <text x="176" y="73" fill={primary} fontSize="8" fontWeight="bold">
            BOS
          </text>
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 240 140" className={className}>
          <rect width="240" height="140" fill="transparent" />
          <path
            d="M 30 110 L 80 60 L 130 90 L 180 40 L 220 20"
            fill="none"
            stroke={green}
            strokeWidth="2"
          />
        </svg>
      );
  }
};
