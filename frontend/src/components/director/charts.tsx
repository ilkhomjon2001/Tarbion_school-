/**
 * Yengil, kutubxonasiz grafiklar (SVG/CSS asosida) — hisobot va bosh
 * sahifa uchun. Faqat mavjud dizayn tokenlar ishlatiladi (CLAUDE.md).
 *
 * Chiziqli grafik ATAYLAB raqamlar bilan koʻrsatiladi: rahbar uchun
 * "chiziq koʻtarildi" yetarli emas — aniq qiymat, oʻzgarish va shkala
 * chegarasi kerak. Shkala 0 dan boshlanmaydi (farq koʻrinmay qoladi),
 * shuning uchun oraliq izohda ochiq yozib qoʻyiladi.
 */

import type { CSSProperties } from "react";

export interface TrendPoint {
  label: string;
  value: number;
}

function formatValue(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${unit}`;
}

/** Shkala chegarasi — maʼlumot atrofida biroz boʻsh joy bilan, 5 ga yaxlitlangan. */
function niceBounds(min: number, max: number, isPercent: boolean) {
  const span = max - min;
  const pad = span === 0 ? 2 : span * 0.4;
  let lower = Math.floor((min - pad) / 5) * 5;
  let upper = Math.ceil((max + pad) / 5) * 5;
  if (isPercent) {
    lower = Math.max(0, lower);
    upper = Math.min(100, upper);
  }
  if (upper - lower < 5) upper = lower + 5;
  return { lower, upper };
}

/** Chetdagi qiymat belgisi grafikdan chiqib ketmasligi uchun. */
function labelPosition(index: number, total: number): CSSProperties {
  if (index === 0) return { left: 0 };
  if (index === total - 1) return { right: 0 };
  return { left: 0, transform: "translateX(-50%)" };
}

export function AreaLineChart({
  points,
  colorVar = "var(--color-brand)",
  unit = "%",
  hint,
  higherIsBetter = true,
  ariaLabel = "Dinamika grafigi",
}: {
  points: TrendPoint[];
  colorVar?: string;
  /** Qiymat birligi — foiz uchun "%", baho uchun "" va h.k. */
  unit?: string;
  /** Grafik nimani anglatishini tushuntiruvchi izoh. */
  hint?: string;
  /** Koʻrsatkich oshgani yaxshimi — oʻzgarish rangini shu belgilaydi. */
  higherIsBetter?: boolean;
  ariaLabel?: string;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-foreground-muted">Maʼlumot yoʻq.</p>;
  }

  const values = points.map((p) => p.value);
  const first = points[0];
  const last = points[points.length - 1];
  const lowest = points.reduce((a, b) => (b.value < a.value ? b : a));
  const highest = points.reduce((a, b) => (b.value > a.value ? b : a));
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const delta = last.value - first.value;

  const isPercent = unit === "%";
  const { lower, upper } = niceBounds(lowest.value, highest.value, isPercent);
  const range = upper - lower || 1;

  const coords = points.map((p, i) => ({
    ...p,
    xPct: points.length === 1 ? 50 : (i / (points.length - 1)) * 100,
    yPct: (1 - (p.value - lower) / range) * 100,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.xPct},${c.yPct}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].xPct},100 L${coords[0].xPct},100 Z`;

  const deltaTone =
    delta === 0
      ? "text-foreground-muted"
      : (delta > 0) === higherIsBetter
        ? "text-success"
        : "text-danger";

  return (
    <div>
      {/* Asosiy raqamlar — grafikdan oldin, chunki rahbar avval shularni oʻqiydi */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="num text-2xl font-bold text-foreground">
          {formatValue(last.value, unit)}
        </span>
        <span className={`num text-sm font-semibold ${deltaTone}`}>
          {delta === 0 ? "oʻzgarishsiz" : `${delta > 0 ? "▲ +" : "▼ "}${formatValue(delta, unit)}`}
        </span>
        <span className="text-xs text-foreground-muted">
          {first.label} — {last.label}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-foreground-muted">
        Eng past{" "}
        <span className="num font-medium text-foreground">
          {formatValue(lowest.value, unit)}
        </span>{" "}
        ({lowest.label}) · Eng yuqori{" "}
        <span className="num font-medium text-foreground">
          {formatValue(highest.value, unit)}
        </span>{" "}
        ({highest.label}) · Oʻrtacha{" "}
        <span className="num font-medium text-foreground">{formatValue(average, unit)}</span>
      </p>

      <div className="mt-3 flex gap-2">
        {/* Y oʻqi qiymatlari */}
        <div className="relative h-40 w-11 shrink-0">
          {[upper, (upper + lower) / 2, lower].map((value, i) => (
            <span
              key={value}
              className="num absolute right-0 -translate-y-1/2 text-[11px] text-foreground-muted"
              style={{ top: `${i * 50}%` }}
            >
              {formatValue(value, unit)}
            </span>
          ))}
        </div>

        <div className="relative h-40 flex-1">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label={`${ariaLabel}: ${points.map((p) => `${p.label} ${formatValue(p.value, unit)}`).join(", ")}`}
          >
            {[0, 50, 100].map((y) => (
              <line
                key={y}
                x1={0}
                y1={y}
                x2={100}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
                strokeDasharray={y === 100 ? undefined : "4 4"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={areaPath} fill={colorVar} fillOpacity={0.12} stroke="none" />
            <path
              d={linePath}
              fill="none"
              stroke={colorVar}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Nuqtalar va qiymatlar — HTML qatlamda, shunda matn choʻzilmaydi */}
          {coords.map((c, i) => (
            <div
              key={c.label}
              className="absolute"
              style={{ left: `${c.xPct}%`, top: `${c.yPct}%` }}
              title={`${c.label}: ${formatValue(c.value, unit)}`}
            >
              <span
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                style={{ backgroundColor: colorVar }}
              />
              <span
                className="num absolute -top-5 whitespace-nowrap text-[11px] font-medium text-foreground"
                style={labelPosition(i, coords.length)}
              >
                {formatValue(c.value, unit)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* X oʻqi belgilari — Y oʻqi ustuni kengligiga moslangan */}
      <div className="mt-1 flex gap-2">
        <div className="w-11 shrink-0" />
        <div className="flex flex-1 justify-between text-[11px] text-foreground-muted">
          {points.map((p, i) => (
            <span
              key={p.label}
              className={
                i === 0 || i === points.length - 1 || points.length <= 7 ? "" : "hidden sm:inline"
              }
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-foreground-muted">
        {hint ? `${hint} ` : ""}
        Shkala{" "}
        <span className="num">
          {formatValue(lower, unit)}–{formatValue(upper, unit)}
        </span>{" "}
        oraligʻida koʻrsatilgan — oʻzgarish yaqqol koʻrinishi uchun 0 dan boshlanmaydi.
      </p>
    </div>
  );
}

export function SimpleBarChart({
  bars,
  toneVar = "var(--color-brand)",
  valueFormatter,
  hint,
}: {
  bars: { label: string; value: number }[];
  toneVar?: string;
  valueFormatter?: (value: number) => string;
  /** Grafik nimani anglatishini tushuntiruvchi izoh. */
  hint?: string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div>
      <div className="flex flex-col gap-3">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs text-foreground-muted">
              {bar.label}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${(bar.value / max) * 100}%`, backgroundColor: toneVar }}
              />
            </div>
            <span className="num w-10 shrink-0 text-right text-xs font-medium text-foreground">
              {valueFormatter ? valueFormatter(bar.value) : bar.value}
            </span>
          </div>
        ))}
      </div>
      {hint && (
        <p className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-foreground-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
