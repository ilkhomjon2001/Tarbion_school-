"use client";

/**
 * Toʻlovlar (TOL-01…TOL-07) — BAZADAN.
 *
 * Jamlanma → oylik hisoblash → oʻquvchilar/qarzdorlar → kartochka
 * (daftar, toʻlov kiritish, storno, shartnoma, chegirma).
 *
 * Toʻlov yozuvi TAHRIRLANMAYDI — xato boʻlsa storno (sabab bilan) va
 * yangi yozuv. Onlayn toʻlovlar hozircha SINOV provayderi orqali.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ConfirmArchiveButton } from "@/components/admin/ConfirmArchiveButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { PlusIcon, WalletIcon, XIcon } from "@/components/ui/icons";
import { schoolSchoolSettings } from "@/lib/api/sdk.gen";
import type { SchoolSettingsOut } from "@/lib/api/types.gen";
import { formatSom } from "@/lib/format";
import {
  addCredit,
  addDiscount,
  archiveDiscount,
  DEFAULT_MONTHLY_FEE,
  fetchFinanceStudents,
  fetchFinanceSummary,
  fetchLedger,
  generateCharges,
  METHOD_LABELS,
  MONTH_NAMES_UZ,
  PAY_STATUS_LABELS,
  recordPayment,
  refundPayment,
  setContract,
  stornoPayment,
  type FinanceSummaryOut,
  type StudentFinanceOut,
  type StudentLedgerOut,
} from "@/lib/payments/api";
import { apiXato } from "@/lib/school/api";
import { withAuth } from "@/lib/session";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50";

/**
 * Roʻyxat filtri. `hammasi` — filtr yoʻq.
 *
 * Ilgari bu yerda «Faqat qarzdorlar» belgisi turardi va u ikki xil
 * odamni bitta roʻyxatga qoʻshib yuborardi: hech narsa toʻlamagan va
 * yarmini toʻlagan. Maktab uchun bular boshqa ish — birinchisiga
 * qoʻngʻiroq qilinadi, ikkinchisiga eslatma yetadi.
 */
const FILTRLAR = [
  { id: "hammasi", label: "Hammasi" },
  { id: "tolanmagan", label: "Toʻlamagan" },
  { id: "qisman", label: "Yarim toʻlagan" },
  { id: "tolangan", label: "Toʻlagan" },
  { id: "hisobsiz", label: "Hisobsiz" },
] as const;

type Filtr = (typeof FILTRLAR)[number]["id"];

/**
 * Kartochkadagi amal panellari. Har tugma OCHIB-YOPADI — shu sabab
 * ochiq holati alohida koʻrinishga ega.
 */
const PANELS = [
  { id: "tolov", label: "Toʻlov kiritish" },
  { id: "shartnoma", label: "Shartnoma" },
  { id: "chegirma", label: "Chegirma" },
  { id: "kredit", label: "Kredit-yozuv" },
  { id: "qaytarish", label: "Avansni qaytarish" },
] as const;

const panelBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:border-brand hover:text-brand-dark";

const panelBtnOpen =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  tolangan: "success",
  qisman: "warning",
  tolanmagan: "danger",
  hisobsiz: "neutral",
};

export function AdminPaymentsBoard() {
  const [summary, setSummary] = useState<FinanceSummaryOut | null>(null);
  const [rows, setRows] = useState<StudentFinanceOut[] | null>(null);
  const [filtr, setFiltr] = useState<Filtr>("hammasi");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const yukla = useCallback(async () => {
    try {
      // Filtr brauzerda: oʻquvchi soni yuzlab, har bosishda soʻrov
      // yubormaymiz va holatlar boʻyicha sanoq darhol koʻrinadi.
      const [s, r] = await Promise.all([fetchFinanceSummary(), fetchFinanceStudents()]);
      setSummary(s);
      setRows(r);
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Moliya maʼlumotini olib boʻlmadi."));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function hisobla() {
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const soni = await generateCharges(now.getFullYear(), now.getMonth() + 1);
      setError(null);
      await yukla();
      // Xabar sifatida koʻrsatamiz — xato emas.
      setError(
        soni > 0
          ? `${soni} ta oʻquvchiga joriy oy qarzi yozildi.`
          : "Joriy oy allaqachon hisoblangan — yangi yozuv yoʻq.",
      );
    } catch (err) {
      setError(apiXato(err, "Hisoblab boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  const all = rows ?? [];
  const sanoq: Record<string, number> = { hammasi: all.length };
  for (const r of all) sanoq[r.status] = (sanoq[r.status] ?? 0) + 1;

  const filtered = all.filter(
    (r) =>
      (filtr === "hammasi" || r.status === filtr) &&
      (!query || r.student_name.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Toʻlovlar</h1>
          <p className="text-sm text-foreground-muted">
            Standart shartnoma {formatSom(DEFAULT_MONTHLY_FEE)}/oy · oʻquv yili 9 oy
            (sentabr–may)
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void hisobla()} className={primaryBtn}>
          Joriy oyni hisoblash
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary === null ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          [
            ["Hisoblangan", formatSom(summary.charged)],
            ["Tushum", formatSom(summary.paid)],
            ["Qarz", formatSom(summary.debt)],
            ["Qarzdorlar", String(summary.debtors)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {label}
              </p>
              <p className="num mt-1 text-xl font-bold text-foreground">{value}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Oʻquvchini qidirish…"
          aria-label="Oʻquvchini qidirish"
          className={`${inputClass} max-w-xs`}
        />
        {/* Sanoq tugmaning OʻZIDA: «nechta qarzdor, nechta yarim
            toʻlagan» degan savolga bosmasdan javob beradi. */}
        <div role="group" aria-label="Toʻlov holati" className="flex flex-wrap gap-1.5">
          {FILTRLAR.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtr === f.id}
              onClick={() => setFiltr(f.id)}
              className={`focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                filtr === f.id
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border text-foreground hover:bg-surface-muted"
              }`}
            >
              {f.label}
              <span className="num text-xs opacity-70">{sanoq[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <ListSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<WalletIcon className="h-5 w-5" />}
          title={
            filtr === "hammasi"
              ? "Oʻquvchi topilmadi"
              : `«${FILTRLAR.find((f) => f.id === filtr)?.label}» holatida oʻquvchi yoʻq`
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Oʻquvchi</th>
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3 text-right">Oylik</th>
                  <th className="px-3 py-3 text-right">Hisoblangan</th>
                  <th className="px-3 py-3 text-right">Toʻlangan</th>
                  <th className="px-3 py-3 text-right">Balans</th>
                  <th className="px-3 py-3">Holat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.student_id}
                    onClick={() => setOpenId(r.student_id)}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-brand-dark">
                      {r.student_name}
                      {r.is_archived && (
                        <span className="ml-2">
                          <Badge tone="neutral">Ketgan</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">{r.class_name ?? "—"}</td>
                    <td className="num px-3 py-2.5 text-right text-foreground-muted">
                      {r.monthly_fee === null ? (
                        <Badge tone="warning">Shartnomasiz</Badge>
                      ) : (
                        formatSom(r.monthly_fee)
                      )}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-foreground-muted">
                      {formatSom(r.charged)}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-foreground-muted">
                      {formatSom(r.paid)}
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      <span
                        className={
                          r.balance < 0 ? "font-semibold text-danger" : "text-success"
                        }
                      >
                        {formatSom(r.balance)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                        {PAY_STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openId && (
        <LedgerDrawer
          studentId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void yukla()}
        />
      )}
    </div>
  );
}

/** Oʻquvchi moliya kartochkasi: daftar + amallar. */
function LedgerDrawer({
  studentId,
  onClose,
  onChanged,
}: {
  studentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [ledger, setLedger] = useState<StudentLedgerOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"tolov" | "shartnoma" | "chegirma" | "kredit" | "qaytarish" | null>(null);

  // Kvitansiya sarlavhasi uchun maktab nomi — sozlamalardan (fallback bilan).
  const [schoolName, setSchoolName] = useState("«Tarbion» xususiy maktabi");
  useEffect(() => {
    let alive = true;
    withAuth<SchoolSettingsOut>(() => schoolSchoolSettings())
      .then((r) => alive && r.name && setSchoolName(r.name))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const [stornoId, setStornoId] = useState<string | null>(null);
  const [stornoReason, setStornoReason] = useState("Summa xato kiritilgan");

  const yukla = useCallback(async () => {
    try {
      setLedger(await fetchLedger(studentId));
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Daftarni olib boʻlmadi."));
    }
  }, [studentId]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function amal(f: () => Promise<StudentLedgerOut>) {
    setBusy(true);
    setError(null);
    try {
      setLedger(await f());
      setPanel(null);
      setStornoId(null);
      onChanged();
    } catch (err) {
      setError(apiXato(err, "Amalni bajarib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  const fin = ledger?.finance;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Toʻlov kartochkasi"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[500px] flex-col gap-3 overflow-y-auto bg-surface p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {fin?.student_name ?? "Yuklanmoqda…"}
            </h2>
            {fin && (
              <p className="num text-sm text-foreground-muted">
                {fin.class_name ?? "sinfsiz"} · balans{" "}
                <span className={fin.balance < 0 ? "font-semibold text-danger" : "text-success"}>
                  {formatSom(fin.balance)}
                </span>
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Yopish
          </button>
        </div>

        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

        {/* Tugmalar OCHIB-YOPADI, shuning uchun bosilgani koʻrinib
            tursin. Ilgari «Toʻlov kiritish» doim yashil edi va ochiq
            kabi oʻqilardi — administrator bosmasdan «summa kiritadigan
            joy qani» deb qidirardi. */}
        <div role="group" aria-label="Amallar" className="flex flex-wrap gap-2">
          {PANELS.filter((p) => p.id !== "qaytarish" || (fin?.balance ?? 0) > 0).map((p) => (
            <button
              key={p.id}
              type="button"
              aria-expanded={panel === p.id}
              onClick={() => setPanel(panel === p.id ? null : p.id)}
              className={panel === p.id ? panelBtnOpen : panelBtn}
            >
              {panel === p.id ? <XIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              {p.label}
            </button>
          ))}
        </div>

        {/* Forma tugmaning OʻZI ostida. Ilgari u oylar chizigʻidan
            keyin turardi va uzun daftarda koʻzga tashlanmasdi. */}
        {panel === "tolov" && (
          <PaymentForm
            studentId={studentId}
            busy={busy}
            onSubmit={(input) => void amal(() => recordPayment(input))}
          />
        )}
        {panel === "shartnoma" && (
          <ContractForm
            current={fin?.monthly_fee ?? null}
            busy={busy}
            onSubmit={(fee, startsOn) => void amal(() => setContract(studentId, fee, startsOn))}
          />
        )}
        {panel === "kredit" && (
          <CreditForm
            busy={busy}
            onSubmit={(input) => void amal(() => addCredit(studentId, input))}
          />
        )}
        {panel === "qaytarish" && (
          <RefundForm
            busy={busy}
            max={fin?.balance ?? 0}
            onSubmit={(amount, reason) =>
              void amal(() => refundPayment(studentId, amount, reason))
            }
          />
        )}
        {panel === "chegirma" && (
          <DiscountForm
            busy={busy}
            discounts={ledger?.discounts ?? []}
            onArchive={(id) =>
              void amal(async () => {
                await archiveDiscount(id);
                return fetchLedger(studentId);
              })
            }
            onSubmit={(input) => void amal(() => addDiscount(studentId, input))}
          />
        )}

        {ledger && ledger.months.length > 0 && <MonthsStrip months={ledger.months} />}

        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Daftar
          </h3>
          {ledger === null ? (
            <ListSkeleton count={4} />
          ) : ledger.rows.length === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
              Hali yozuv yoʻq. Avval shartnoma ochib, oyni hisoblang.
            </p>
          ) : (
            ledger.rows.map((r, i) => (
              <div
                key={`${r.kind}-${r.payment_id ?? i}-${r.when}`}
                className="rounded-lg bg-surface-muted px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={`min-w-0 truncate ${r.stornod ? "line-through opacity-60" : ""} text-foreground`}
                  >
                    {r.title}
                    {r.method && ` · ${METHOD_LABELS[r.method] ?? r.method}`}
                    {r.receipt_no && ` · ${r.receipt_no}`}
                  </span>
                  <span
                    className={`num shrink-0 font-medium ${
                      r.kind === "charge" || r.kind === "storno"
                        ? "text-danger"
                        : "text-success"
                    }`}
                  >
                    {r.amount > 0 ? "+" : ""}
                    {formatSom(r.amount)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="num text-xs text-foreground-muted">{r.when}</span>
                  {r.kind === "payment" && r.payment_id && (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          printReceipt({
                            schoolName,
                            studentName: fin?.student_name ?? "",
                            className: fin?.class_name ?? "",
                            title: r.title,
                            amount: -r.amount,
                            method: r.method ?? "",
                            receiptNo: r.receipt_no ?? "",
                            when: r.when,
                          })
                        }
                        className="focus-ring rounded px-1.5 py-0.5 text-xs font-medium text-brand-dark hover:underline"
                      >
                        Kvitansiya
                      </button>
                      {!r.stornod && (
                        <button
                          type="button"
                          onClick={() => setStornoId(stornoId === r.payment_id ? null : r.payment_id)}
                          className="focus-ring rounded px-1.5 py-0.5 text-xs font-medium text-foreground-muted hover:text-danger"
                        >
                          Storno
                        </button>
                      )}
                    </span>
                  )}
                </div>
                {stornoId === r.payment_id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (stornoReason.trim().length < 3 || !r.payment_id) return;
                      void amal(() => stornoPayment(r.payment_id as string, stornoReason.trim()));
                    }}
                    className="mt-2 flex gap-2 border-t border-border pt-2"
                  >
                    <input
                      value={stornoReason}
                      onChange={(e) => setStornoReason(e.target.value.slice(0, 200))}
                      placeholder="Storno sababi"
                      className={inputClass}
                    />
                    <button
                      type="submit"
                      disabled={busy || stornoReason.trim().length < 3}
                      className="focus-ring inline-flex h-9 shrink-0 items-center rounded-lg bg-danger px-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Storno
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
        </section>
      </aside>
    </div>
  );
}

function PaymentForm({
  studentId,
  busy,
  onSubmit,
}: {
  studentId: string;
  busy: boolean;
  onSubmit: (input: {
    student_id: string;
    amount: number;
    method: string;
    receipt_no?: string | null;
  }) => void;
}) {
  const [amount, setAmount] = useState(String(DEFAULT_MONTHLY_FEE));
  const [method, setMethod] = useState("naqd");
  const [receipt, setReceipt] = useState("");

  // Server `KV-{yil}-{tartib}` shaklida beradi (`record_payment`).
  // Namunani shu yerda ham koʻrsatamiz — ilgari placeholder «KV-0001»
  // derdi va yozilgan raqam boshqacha chiqib, chalgʻitardi.
  const namuna = `KV-${new Date().getFullYear()}-0001`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const summa = Number(amount);
        if (summa > 0) {
          onSubmit({
            student_id: studentId,
            amount: summa,
            method,
            receipt_no: receipt.trim() || null,
          });
        }
      }}
      className="flex flex-col gap-2 rounded-lg border border-brand/40 bg-brand/5 p-3"
    >
      <h3 className="text-sm font-semibold text-foreground">Yangi toʻlov</h3>
      <span className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-foreground">Summa (soʻm)</span>
          <input
            autoFocus
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} num`}
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-foreground">Usul</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            {Object.entries(METHOD_LABELS)
              .filter(([id]) => id !== "onlayn")
              .map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </span>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">
          Chek raqami{" "}
          <span className="font-normal text-foreground-muted">— ixtiyoriy</span>
        </span>
        <input
          value={receipt}
          onChange={(e) => setReceipt(e.target.value.slice(0, 60))}
          placeholder={`Boʻsh qoldiring — ${namuna}`}
          className={inputClass}
        />
        {/* Maydon boʻsh qolsa server oʻzi tartib raqam beradi. Buni
            aytmasak administrator har safar nima yozishni oʻylab
            qoladi va qoʻlbola raqamlar aralashib ketadi. */}
        <span className="mt-1 block text-xs text-foreground-muted">
          Boʻsh qoldirsangiz tizim tartib raqam beradi ({namuna}). Kassa cheki yoki
          bank kvitansiyasi raqami boʻlsa — oʻshani yozing. Raqam takrorlanmaydi.
        </span>
      </label>
      <p className="text-xs text-foreground-muted">
        Toʻlov yozuvi keyin tahrirlanmaydi — xato boʻlsa storno qilinadi.
      </p>
      <button type="submit" disabled={busy || Number(amount) <= 0} className={primaryBtn}>
        Toʻlovni yozish
      </button>
    </form>
  );
}

function ContractForm({
  current,
  busy,
  onSubmit,
}: {
  current: number | null;
  busy: boolean;
  onSubmit: (fee: number, startsOn: string) => void;
}) {
  const now = new Date();
  const [fee, setFee] = useState(String(current ?? DEFAULT_MONTHLY_FEE));
  const [startsOn, setStartsOn] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (Number(fee) > 0) onSubmit(Number(fee), startsOn);
      }}
      className="flex flex-col gap-2 rounded-lg border border-border p-3"
    >
      <span className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-foreground">
            Oylik summa (soʻm)
          </span>
          <input
            type="number"
            min={1}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className={`${inputClass} num`}
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-foreground">Qaysi oydan</span>
          <input
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={inputClass}
          />
        </label>
      </span>
      <p className="text-xs text-foreground-muted">
        Oʻtgan oylarda hisoblangan qarzlar oʻzgarmaydi — yangi summa keyingi
        hisoblashdan amal qiladi.
      </p>
      <button type="submit" disabled={busy || Number(fee) <= 0} className={primaryBtn}>
        Shartnomani saqlash
      </button>
    </form>
  );
}

function DiscountForm({
  busy,
  discounts,
  onSubmit,
  onArchive,
}: {
  busy: boolean;
  discounts: StudentLedgerOut["discounts"];
  onSubmit: (input: {
    kind: string;
    value: number;
    reason: string;
    starts_on: string;
  }) => void;
  onArchive: (id: string) => void;
}) {
  const now = new Date();
  const [kind, setKind] = useState("percent");
  const [value, setValue] = useState("10");
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      {discounts.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {discounts.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
            >
              <span className="num text-foreground">
                {d.kind === "percent" ? `${d.value}%` : formatSom(d.value)} — {d.reason}
              </span>
              <ConfirmArchiveButton
                disabled={busy}
                onConfirm={() => onArchive(d.id)}
                label="Bekor qilish"
                question="Chegirma bekor qilinsinmi?"
                className="focus-ring rounded px-1.5 py-0.5 text-xs text-foreground-muted hover:text-danger"
              />
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(value) > 0 && reason.trim().length >= 3) {
            onSubmit({
              kind,
              value: Number(value),
              reason: reason.trim(),
              starts_on: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
            });
          }
        }}
        className="flex flex-col gap-2"
      >
        <span className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
            <option value="percent">Foiz (%)</option>
            <option value="amount">Summa (soʻm)</option>
          </select>
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`${inputClass} num`}
          />
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 200))}
          placeholder="Sabab (majburiy) — masalan, aka-uka chegirmasi"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={busy || Number(value) <= 0 || reason.trim().length < 3}
          className={primaryBtn}
        >
          Chegirma qoʻshish
        </button>
      </form>
    </div>
  );
}


/** Oylar chiziqchasi: sentyabr ✓, oktyabr ◐, noyabr ✗ (kechikdi qizil). */
function MonthsStrip({
  months,
}: {
  months: { year: number; month: number; amount: number; covered: number; status: string; overdue: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {months.map((m) => {
        const uslub =
          m.status === "tolangan"
            ? "bg-success-tint text-success border-success/30"
            : m.overdue
              ? "bg-danger-tint text-danger border-danger/30"
              : m.status === "qisman"
                ? "bg-warning-tint text-warning border-warning/30"
                : "bg-surface-muted text-foreground-muted border-border";
        const belgi = m.status === "tolangan" ? "✓" : m.status === "qisman" ? "◐" : "✗";
        return (
          <span
            key={`${m.year}-${m.month}`}
            title={`${MONTH_NAMES_UZ[m.month]} ${m.year}: ${formatSom(m.covered)} / ${formatSom(m.amount)}${m.overdue ? " — kechikdi" : ""}`}
            className={`num inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${uslub}`}
          >
            {belgi} {MONTH_NAMES_UZ[m.month]}
          </span>
        );
      })}
    </div>
  );
}

/** Kredit-yozuv: qarzni sabab bilan kamaytirish (kelishuv, ketish). */
function CreditForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (input: { amount: number; reason: string; year?: number; month?: number }) => void;
}) {
  const now = new Date();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [targeted, setTargeted] = useState(true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (Number(amount) <= 0 || reason.trim().length < 3) return;
        onSubmit({
          amount: Number(amount),
          reason: reason.trim(),
          ...(targeted
            ? { year: now.getFullYear(), month: now.getMonth() + 1 }
            : {}),
        });
      }}
      className="flex flex-col gap-2 rounded-lg border border-border p-3"
    >
      <p className="text-xs text-foreground-muted">
        Qarzni sabab bilan kamaytirish — masalan, oʻquvchi oy oʻrtasida ketdi.
        Qarz yozuvining oʻzi oʻzgarmaydi, tuzatish alohida qatorda va auditda.
      </p>
      <span className="flex gap-2">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Summa (soʻm)"
          aria-label="Kredit summasi"
          className={`${inputClass} num`}
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-foreground">
          <input
            type="checkbox"
            checked={targeted}
            onChange={(e) => setTargeted(e.target.checked)}
            className="h-4 w-4"
          />
          Joriy oyga
        </label>
      </span>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 200))}
        placeholder="Sabab (majburiy)"
        aria-label="Kredit sababi"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={busy || Number(amount) <= 0 || reason.trim().length < 3}
        className={primaryBtn}
      >
        Kredit-yozuvni saqlash
      </button>
    </form>
  );
}

/** Avansni qaytarish — faqat musbat balansdan. */
function RefundForm({
  busy,
  max,
  onSubmit,
}: {
  busy: boolean;
  max: number;
  onSubmit: (amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState(String(max));
  const [reason, setReason] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (Number(amount) <= 0 || reason.trim().length < 3) return;
        onSubmit(Number(amount), reason.trim());
      }}
      className="flex flex-col gap-2 rounded-lg border border-border p-3"
    >
      <p className="text-xs text-foreground-muted">
        Avans: <span className="num font-medium">{formatSom(max)}</span>. Undan
        koʻp qaytarib boʻlmaydi.
      </p>
      <input
        type="number"
        min={1}
        max={max}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="Qaytariladigan summa"
        className={`${inputClass} num`}
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 200))}
        placeholder="Sabab (majburiy)"
        aria-label="Qaytarish sababi"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={busy || Number(amount) <= 0 || reason.trim().length < 3}
        className={primaryBtn}
      >
        Qaytarishni yozish
      </button>
    </form>
  );
}

/**
 * HTML uchun xavfsiz matn (X-5 ruhida, XSS'ga qarshi).
 *
 * `document.write` ga ketadigan HAR BIR qiymat shu yerdan oʻtadi:
 * oʻquvchi ismi yoki toʻlov izohiga `<script>` yozib qoʻygan odam
 * kvitansiya oynasida kod bajara olmasin.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Kvitansiyani yangi oynada chop etish (TOL-04). */
function printReceipt(r: {
  schoolName: string;
  studentName: string;
  className: string;
  title: string;
  amount: number;
  method: string;
  receiptNo: string;
  when: string;
}) {
  const oyna = window.open("", "_blank", "width=480,height=640");
  if (!oyna) return;
  const e = escapeHtml;
  oyna.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Kvitansiya ${e(r.receiptNo)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 420px; margin: 24px auto; color: #111; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
  h2 { font-size: 13px; text-align: center; font-weight: normal; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 6px 4px; border-bottom: 1px dotted #999; }
  td:last-child { text-align: right; font-weight: bold; }
  .imzo { margin-top: 28px; font-size: 12px; display: flex; justify-content: space-between; }
</style></head><body>
<h1>${e(r.schoolName)}</h1>
<h2>Toʻlov kvitansiyasi № ${e(r.receiptNo)}</h2>
<table>
  <tr><td>Oʻquvchi</td><td>${e(r.studentName)} (${e(r.className)})</td></tr>
  <tr><td>Asos</td><td>${e(r.title)}</td></tr>
  <tr><td>Summa</td><td>${e(r.amount.toLocaleString("uz-UZ"))} soʻm</td></tr>
  <tr><td>Usul</td><td>${e(r.method)}</td></tr>
  <tr><td>Sana</td><td>${e(r.when)}</td></tr>
</table>
<div class="imzo"><span>Qabul qildi: ____________</span><span>Imzo: ____________</span></div>
<script>window.print();</script>
</body></html>`);
  oyna.document.close();
}
