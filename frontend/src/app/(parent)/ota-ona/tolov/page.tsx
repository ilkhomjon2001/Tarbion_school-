"use client";

import { ParentShell } from "@/components/parent/ParentShell";
import { formatSom, PAYMENTS } from "@/lib/parent/data";
import { useChild } from "@/lib/parent/useChild";

/**
 * Toʻlov holati (OTA-06).
 *
 * Ota-ona uchun ikkita savol: "qarzim bormi?" va "kvitansiya qayerda?".
 * Shuning uchun qarzdorlik eng tepada, katta yozuvda; tarix pastda,
 * har qatorda kvitansiya yuklab olish.
 *
 * Pul CLAUDE.md 2-qoidasi boʻyicha butun sonda, soʻmda saqlanadi.
 */
export default function ParentPaymentPage() {
  const [child, setChild] = useChild();
  const payment = PAYMENTS[child.id];
  const hasDebt = payment.balance > 0;

  return (
    <ParentShell title="Toʻlov" child={child} onChildChange={setChild}>
      {/* Holat */}
      <div
        className={`mb-5 rounded-xl border p-5 ${
          hasDebt ? "border-danger/30 bg-danger-tint" : "border-success/30 bg-success-tint"
        }`}
      >
        <p
          className={`text-xs uppercase tracking-wide ${hasDebt ? "text-danger/80" : "text-success/80"}`}
        >
          {hasDebt ? "Toʻlanishi kerak" : "Qarzdorlik yoʻq"}
        </p>
        <p className={`mt-1 text-3xl font-bold ${hasDebt ? "text-danger" : "text-success"}`}>
          {hasDebt ? formatSom(payment.balance) : "Toʻlangan"}
        </p>
        <p className={`mt-1 text-sm ${hasDebt ? "text-danger/85" : "text-success/85"}`}>
          {hasDebt
            ? `Toʻlash muddati: ${payment.nextDueDate}`
            : `Keyingi toʻlov: ${payment.nextDueDate}`}
        </p>

        {hasDebt && (
          <button
            type="button"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-danger px-4 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Onlayn toʻlash
          </button>
        )}
      </div>

      {/* Shartnoma */}
      <dl className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <dt className="text-xs uppercase tracking-wide text-foreground-muted">
            Oylik toʻlov
          </dt>
          <dd className="mt-1 text-xl font-semibold">{formatSom(payment.monthlyFee)}</dd>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <dt className="text-xs uppercase tracking-wide text-foreground-muted">
            Oʻquvchi
          </dt>
          <dd className="mt-1 text-xl font-semibold">
            {child.shortName}{" "}
            <span className="text-sm font-normal text-foreground-muted">
              · {child.className}
            </span>
          </dd>
        </div>
      </dl>

      {/* Tarix va kvitansiyalar */}
      <section>
        <h2 className="mb-2.5 text-sm font-semibold">Toʻlovlar tarixi</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">
              {child.shortName} boʻyicha toʻlovlar tarixi va kvitansiyalar
            </caption>
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-foreground-muted">
                <th scope="col" className="px-4 py-2.5 font-medium">Sana</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Summa</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Usul</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Kvitansiya</th>
              </tr>
            </thead>
            <tbody>
              {payment.history.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5">{p.paidAt}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                    {formatSom(p.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-foreground-muted">{p.method}</td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
                      </svg>
                      {p.receiptNo}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2.5 text-xs text-foreground-muted">
          Kvitansiya PDF koʻrinishida yuklab olinadi. Toʻlovda xatolik boʻlsa —
          «Murojaat» boʻlimi orqali yozing, toʻlov yozuvi oʻchirilmaydi, tuzatish
          alohida yozuv bilan qilinadi.
        </p>
      </section>
    </ParentShell>
  );
}
