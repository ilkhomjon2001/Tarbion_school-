"use client";

/**
 * Baho oʻsishi — kichik chiziqli grafik (OTA-04).
 *
 * Shakl tanlovi: har fanda BITTA seriya (6 ta oxirgi baho). Barcha
 * fanlarni bitta grafikka yigʻish 5 ta rang talab qilardi va ota-onaning
 * savoliga javob bermasdi — u fanlarni bir-biriga solishtirmaydi, "shu
 * fanda oʻsyaptimi?" deb qaraydi. Shuning uchun har fan qatorida oʻz
 * kichik grafigi.
 *
 * Bitta seriya boʻlgani uchun kategorik palitra kerak emas: chiziq bitta
 * rangda. Yoʻnalish (oʻsish/pasayish) rang bilan EMAS — belgi va matn
 * bilan ham beriladi.
 */

export function GradeTrend({
  values,
  max = 5,
  subject,
}: {
  values: number[];
  max?: number;
  subject: string;
}) {
  const W = 108;
  const H = 32;
  const PAD = 4;

  if (values.length < 2) {
    return <span className="text-xs text-foreground-muted">Maʼlumot yetarli emas</span>;
  }

  const stepX = (W - PAD * 2) / (values.length - 1);
  const points = values.map((v, i) => ({
    x: PAD + i * stepX,
    // Pastki chegara 1 dan boshlanadi — 5 ballik tizimda 0 baho yoʻq.
    y: H - PAD - ((v - 1) / (max - 1)) * (H - PAD * 2),
    v,
  }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${subject}: oxirgi ${values.length} ta baho — ${values.join(", ")}`}
      className="shrink-0 overflow-visible"
    >
      {/* Oʻrtacha chizigʻi — sust, faqat orientir uchun */}
      <line
        x1={PAD}
        x2={W - PAD}
        y1={H / 2}
        y2={H / 2}
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />

      <path
        d={path}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Oxirgi nuqta — hozirgi holat. Fon halqasi bilan ajratiladi. */}
      <circle cx={last.x} cy={last.y} r="4.5" fill="var(--color-surface)" />
      <circle cx={last.x} cy={last.y} r="3" fill="var(--color-brand)" />

      {/* Har nuqta uchun brauzer maslahat oynasi */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="7" fill="transparent">
          <title>{`${i + 1}-baho: ${p.v}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Yoʻnalish belgisi — rang yolgʻiz maʼno tashimaydi, belgi va matn bor. */
export function TrendBadge({ values }: { values: number[] }) {
  if (values.length < 4) return null;

  const half = Math.floor(values.length / 2);
  const before = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const after =
    values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
  const delta = after - before;

  if (Math.abs(delta) < 0.25) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground-muted">
        <span aria-hidden>→</span> Barqaror
      </span>
    );
  }

  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        up ? "bg-success-tint text-success" : "bg-warning-tint text-warning"
      }`}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {up ? "Oʻsmoqda" : "Pasaymoqda"}
    </span>
  );
}
