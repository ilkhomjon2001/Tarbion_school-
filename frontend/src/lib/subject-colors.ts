/**
 * Fan boʻyicha rang — jadvalda qaysi fan qayerda ekani bir qarashda
 * koʻrinishi uchun (xuddi ustoz jadvalidagi sinf ranglari kabi).
 * Faqat mavjud dizayn tokenlar ishlatiladi, xom hex yoʻq (CLAUDE.md).
 */
export const SUBJECT_COLORS: Record<string, { block: string; dot: string }> = {
  Matematika: { block: "bg-brand text-brand-foreground", dot: "bg-brand" },
  "Ona tili": { block: "bg-warning text-brand-foreground", dot: "bg-warning" },
  Fizika: { block: "bg-info text-brand-foreground", dot: "bg-info" },
  "Ingliz tili": {
    block: "bg-brand-tint text-brand-dark ring-1 ring-inset ring-brand/40",
    dot: "bg-brand-tint ring-1 ring-inset ring-brand/50",
  },
  Tarix: {
    block: "bg-info-tint text-info ring-1 ring-inset ring-info/40",
    dot: "bg-info-tint ring-1 ring-inset ring-info/50",
  },
  Kimyo: {
    block: "bg-warning-tint text-warning ring-1 ring-inset ring-warning/40",
    dot: "bg-warning-tint ring-1 ring-inset ring-warning/50",
  },
  "Jismoniy tarbiya": {
    block: "bg-danger-tint text-danger ring-1 ring-inset ring-danger/40",
    dot: "bg-danger-tint ring-1 ring-inset ring-danger/50",
  },
};

export const SUBJECT_FALLBACK_COLOR = {
  block: "bg-foreground-muted text-brand-foreground",
  dot: "bg-foreground-muted",
};

export function subjectColor(subject: string) {
  return SUBJECT_COLORS[subject] ?? SUBJECT_FALLBACK_COLOR;
}
