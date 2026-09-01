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
  const primary = PALETTE.accent.fill;
  const muted = PALETTE.neutral.fill;

  switch (type) {
    // ── CANDLESTICKS ───────────────────────────────────────────────────
    case "hammer":
      return (
        <svg viewBox="0 0 240 140" className={className}>
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

    case "shooting-star":
      return (
        <svg viewBox="0 0 240 140" className={className}>
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

    case "inverted-hammer":
      return (
        <svg viewBox="0 0 240 140" className={className}>
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

    case "bullish-engulfing":
      return (
        <svg viewBox="0 0 240 140" className={className}>
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

    case "bearish-engulfing":
      return (
        <svg viewBox="0 0 240 140" className={className}>
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

    case "morning-star":
      return (
        <svg viewBox="0 0 240 140" className={className}>
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

    case "three-soldiers":
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
        <svg viewBox="0 0 240 140" className={className}>
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

    case "piercing-line":
      return (
        <svg viewBox="0 0 240 140" className={className}>
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

    case "rising-three":
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

    // ── CHART PATTERNS ─────────────────────────────────────────────────
    case "head-and-shoulders":
      return (
        <svg viewBox="0 0 260 140" className={className}>
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
            stroke="#ffffff"
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

    case "inverse-head-and-shoulders":
      return (
        <svg viewBox="0 0 260 140" className={className}>
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

    case "double-top":
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

    case "double-bottom":
      return (
        <svg viewBox="0 0 260 140" className={className}>
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

    case "cup-and-handle":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Rim line */}
          <line
            x1="35"
            y1="45"
            x2="225"
            y2="45"
            stroke={primary}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <text x="228" y="48" fill={primary} fontSize="8" fontWeight="bold">
            {t("learn.visual.rim")}
          </text>

          {/* Cup curve */}
          <path
            d="M 40 45 Q 95 125 145 45 Q 165 70 180 62 L 205 20"
            fill="none"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="95"
            y="115"
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.cup")}
          </text>
          <text
            x="175"
            y="80"
            fill={muted}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.handle")}
          </text>
        </svg>
      );

    case "bull-flag":
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

    case "bear-flag":
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

    case "ascending-triangle":
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

    case "descending-triangle":
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

    case "falling-wedge":
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

    // ── STRATEGIES & SMC ───────────────────────────────────────────────
    case "ema-strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* EMA 20 (fast, blue/cyan) */}
          <path
            d="M 20 115 Q 100 80 240 25"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
          />
          {/* EMA 50 (mid, amber) */}
          <path
            d="M 20 125 Q 110 95 240 45"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
          />
          {/* EMA 200 (macro, primary) */}
          <path
            d="M 20 135 Q 120 115 240 75"
            fill="none"
            stroke={primary}
            strokeWidth="2.5"
          />

          {/* Price line riding EMA 20/50 */}
          <path
            d="M 30 110 L 60 75 L 85 95 L 120 50 L 145 70 L 180 30 L 210 45 L 240 15"
            fill="none"
            stroke={green}
            strokeWidth="2"
          />

          <text x="210" y="20" fill="#38bdf8" fontSize="8" fontWeight="bold">
            EMA 20
          </text>
          <text x="210" y="40" fill="#fbbf24" fontSize="8" fontWeight="bold">
            EMA 50
          </text>
          <text x="210" y="70" fill={primary} fontSize="8" fontWeight="bold">
            EMA 200
          </text>
        </svg>
      );

    case "rsi-divergence":
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
            stroke="#ffffff"
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

    case "smc-strategy":
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

    case "atr-strategy":
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

    case "bollinger-strategy":
      return (
        <svg viewBox="0 0 260 140" className={className}>
          <rect width="260" height="140" fill="transparent" />
          {/* Upper Band */}
          <path
            d="M 20 40 Q 80 30 110 50 T 150 50 Q 180 20 240 10"
            fill="none"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {/* Lower Band */}
          <path
            d="M 20 100 Q 80 110 110 90 T 150 90 Q 180 120 240 130"
            fill="none"
            stroke={primary}
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {/* Middle 20 SMA */}
          <path
            d="M 20 70 Q 110 70 150 70 Q 180 70 240 70"
            fill="none"
            stroke={muted}
            strokeWidth="1"
          />

          {/* Price */}
          <path
            d="M 25 68 L 60 72 L 95 65 L 120 75 L 140 68 L 175 45 L 205 25 L 235 15"
            fill="none"
            stroke={green}
            strokeWidth="2"
          />

          <text
            x="130"
            y="45"
            fill={primary}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.squeeze")}
          </text>
          <text x="205" y="45" fill={green} fontSize="8" fontWeight="bold">
            {t("learn.visual.expansion")}
          </text>
        </svg>
      );

    case "mtf-strategy":
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
            fill="#1e1b4b"
            stroke="#6366f1"
            strokeWidth="1"
          />
          <text
            x="52"
            y="36"
            fill="#818cf8"
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.daily")}
          </text>
          <text
            x="52"
            y="54"
            fill="#94a3b8"
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
            fill="#cbd5e1"
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.bullish_flow")}
          </text>

          {/* Arrow 1 */}
          <path
            d="M 96 70 L 106 70"
            stroke="#94a3b8"
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
            fill="#142c23"
            stroke="#10b981"
            strokeWidth="1"
          />
          <text
            x="150"
            y="36"
            fill="#34d399"
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.four_hour")}
          </text>
          <text
            x="150"
            y="54"
            fill="#94a3b8"
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.structure")}
          </text>
          <text
            x="150"
            y="72"
            fill="#34d399"
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.pullback")}
          </text>
          <text
            x="150"
            y="92"
            fill="#cbd5e1"
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.key_support")}
          </text>

          {/* Arrow 2 */}
          <path
            d="M 194 70 L 204 70"
            stroke="#94a3b8"
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
            fill="#3b0764"
            stroke="#d946ef"
            strokeWidth="1"
          />
          <text
            x="248"
            y="36"
            fill="#f0abfc"
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.fifteen_minute")}
          </text>
          <text
            x="248"
            y="54"
            fill="#94a3b8"
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {t("learn.visual.sniper_entry")}
          </text>
          <text
            x="248"
            y="72"
            fill="#f0abfc"
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
