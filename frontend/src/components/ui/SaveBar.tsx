"use client";

/**
 * «Oʻzgarishlar bor → Saqlash» paneli — qoralama (draft) patterni uchun
 * yagona komponent.
 *
 * UX qoidasi: foydalanuvchi nechta oʻzgarish qilganini KOʻRADI va uni
 * oʻzi tasdiqlaydi; jimgina avto-saqlash sezilmay qoladi va «saqlandimi?»
 * degan ishonchsizlik tugʻdiradi. Panel faqat oʻzgarish borida chiqadi.
 *
 * A11y: holat oʻzgarishi `aria-live` bilan eʼlon qilinadi (WCAG 4.1.3),
 * tugmalar 40px nishonli, xato `role="alert"` bilan.
 */

export function SaveBar({
  ozgarishlar,
  busy,
  savedAt,
  xato,
  onSave,
  onCancel,
  sticky = false,
}: {
  /** Saqlanmagan oʻzgarishlar soni — 0 boʻlsa panel koʻrinmaydi. */
  ozgarishlar: number;
  busy: boolean;
  /** Oxirgi muvaffaqiyatli saqlash vaqti («14:05») — ✓ bilan koʻrsatiladi. */
  savedAt?: string | null;
  xato?: string | null;
  onSave: () => void;
  onCancel: () => void;
  /** Uzun roʻyxatlar uchun: panel skrollda ekran pastiga yopishadi. */
  sticky?: boolean;
}) {
  const korinadi = ozgarishlar > 0 || xato || savedAt;
  if (!korinadi) return null;

  return (
    <div
      className={
        sticky ? "sticky bottom-3 z-30 motion-reduce:transition-none" : undefined
      }
    >
      <div
        className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
          ozgarishlar > 0
            ? "border-brand/40 bg-surface shadow-lg"
            : "border-border bg-surface shadow-sm"
        }`}
      >
        <p aria-live="polite" className="w-full min-w-0 text-sm sm:w-auto sm:flex-1">
          {ozgarishlar > 0 ? (
            <span className="font-medium text-foreground">
              <span className="num">{ozgarishlar}</span> ta saqlanmagan oʻzgarish
            </span>
          ) : (
            savedAt && (
              <span className="num text-success">✓ Saqlandi · {savedAt}</span>
            )
          )}
          {xato && (
            <span role="alert" className="block text-danger">
              {xato}
            </span>
          )}
        </p>

        {ozgarishlar > 0 && (
          <>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="focus-ring h-11 flex-1 rounded-lg border border-border px-3.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50 sm:h-10 sm:flex-none"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="focus-ring h-11 flex-1 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50 sm:h-10 sm:flex-none"
            >
              {busy ? "Saqlanmoqda…" : "Oʻzgarishlarni saqlash"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
