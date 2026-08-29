/**
 * Yengil, kutubxonasiz grafiklar (SVG/CSS asosida) — hisobot va bosh
 * sahifa uchun. Faqat mavjud dizayn tokenlar ishlatiladi (CLAUDE.md).
 */

const VIEW_W = 600;
const VIEW_H = 220;
const PAD_X = 8;
const PAD_Y = 12;

export function AreaLineChart({
  points,
  colorVar = "var(--color-brand)",
}: {
  points: { label: string; value: number }[];
  colorVar?: string;
}) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;

  const stepX = (VIEW_W - PAD_X * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = PAD_X + i * stepX;
    const y = PAD_Y + (1 - (p.value - min) / range) * (VIEW_H - PAD_Y * 2);
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${VIEW_H - PAD_Y} L${coords[0].x},${VIEW_H - PAD_Y} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-48 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Davomat dinamikasi grafigi"
      >
        <line
          x1={PAD_X}
          y1={VIEW_H - PAD_Y}
          x2={VIEW_W - PAD_X}
          y2={VIEW_H - PAD_Y}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        <path d={areaPath} fill={colorVar} fillOpacity={0.12} stroke="none" />
        <path d={linePath} fill="none" stroke={colorVar} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r={3} fill={colorVar} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-foreground-muted">
        <span>{points[0].label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)].label}</span>}
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

export function SimpleBarChart({
  bars,
  toneVar = "var(--color-brand)",
  valueFormatter,
}: {
  bars: { label: string; value: number }[];
  toneVar?: string;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
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
          <span className="w-10 shrink-0 text-right text-xs font-medium text-foreground">
            {valueFormatter ? valueFormatter(bar.value) : bar.value}
          </span>
        </div>
      ))}
    </div>
  );
}
