"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon, WalletIcon, XIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import {
  debtOf,
  overdueDays,
  useAdmin,
  useAdminDispatch,
  useFinanceSummary,
} from "@/lib/admin/store";
import {
  DEBT_ACTION_LABELS,
  PAYMENT_METHOD_LABELS,
  type AdminStudent,
  type DebtActionType,
  type PaymentMethod,
} from "@/lib/admin/types";
import { allClassNames } from "@/lib/school/staff";

type StatusFilter = "all" | "overdue" | "partial" | "extended";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Holati: Barchasi",
  overdue: "Kechikkan",
  partial: "Qisman",
  extended: "Muddati choʻzilgan",
};

type Drawer = { studentId: string; tab: DrawerTab } | null;
type DrawerTab = "payment" | "extend" | "discount" | "reminder";

const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "payment", label: "Toʻlov kiritish" },
  { id: "extend", label: "Muddatni choʻzish" },
  { id: "discount", label: "Chegirma" },
  { id: "reminder", label: "Eslatma" },
];

export function AdminPaymentsBoard() {
  const { students, debtActions } = useAdmin();
  const finance = useFinanceSummary();
  const [query, setQuery] = useState("");
  const [className, setClassName] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [drawer, setDrawer] = useState<Drawer>(null);

  const extendedIds = useMemo(
    () => new Set(debtActions.filter((a) => a.type === "extend").map((a) => a.studentId)),
    [debtActions],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => s.status === "active" && debtOf(s) > 0)
      .filter((s) => {
        if (className !== "all" && s.className !== className) return false;
        if (status === "overdue" && s.paidAmount > 0) return false;
        if (status === "partial" && s.paidAmount === 0) return false;
        if (status === "extended" && !extendedIds.has(s.id)) return false;
        if (!q) return true;
        return (
          s.fullName.toLowerCase().includes(q) || s.guardianName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => overdueDays(b) - overdueDays(a));
  }, [students, query, className, status, extendedIds]);

  const active = drawer ? students.find((s) => s.id === drawer.studentId) : null;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Toʻlovlar</h1>
        <p className="text-sm text-foreground-muted">
          Qarzdorlar bilan ishlash va toʻlov qabul qilish
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="animate-enter">
          <p className="text-sm text-foreground-muted">Bu oy tushum</p>
          <p className="num mt-1 text-xl font-bold text-foreground">
            {formatSom(finance.collected)}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Rejadan <span className="num">{formatSom(finance.expected)}</span> ·{" "}
            <span className="num font-medium text-success">{finance.collectedPercent}%</span>
          </p>
        </Card>
        <Card className="animate-enter" style={{ animationDelay: "60ms" }}>
          <p className="text-sm text-foreground-muted">Qarzdorlik</p>
          <p className="num mt-1 text-xl font-bold text-danger">{formatSom(finance.debt)}</p>
          <p className="mt-1 text-xs text-foreground-muted">
            <span className="num">{finance.unpaidCount}</span> ta toʻlanmagan,{" "}
            <span className="num">{finance.partialCount}</span> ta qisman ·{" "}
            <span className="num font-medium text-danger">{finance.debtPercent}%</span>
          </p>
        </Card>
        <Card className="animate-enter" style={{ animationDelay: "120ms" }}>
          <p className="text-sm text-foreground-muted">Bugun qabul qilindi</p>
          <p className="num mt-1 text-xl font-bold text-success">
            {formatSom(finance.todayAmount)}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            <span className="num">{finance.todayCount}</span> ta toʻlov
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Oʻquvchi yoki ota-ona ismi"
            aria-label="Qarzdor qidirish"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
        <select
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          aria-label="Sinf"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Sinfni tanlang</option>
          {allClassNames().map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Holati"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<WalletIcon className="h-5 w-5" />}
          title="Qarzdor yoʻq"
          description="Tanlangan kesimda barcha toʻlovlar yopilgan."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Oʻquvchi</th>
                  <th className="px-3 py-3">Ota-ona</th>
                  <th className="px-3 py-3">Shartnoma</th>
                  <th className="px-3 py-3">Toʻlangan</th>
                  <th className="px-3 py-3">Qarz</th>
                  <th className="px-3 py-3">Kechikish</th>
                  <th className="px-3 py-3">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <DebtorRow
                    key={student.id}
                    student={student}
                    extended={extendedIds.has(student.id)}
                    onAction={(tab) => setDrawer({ studentId: student.id, tab })}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            Jami <span className="num">{rows.length}</span> ta qarzdor
          </p>
        </div>
      )}

      {active && drawer && (
        <PaymentDrawer
          student={active}
          tab={drawer.tab}
          onTab={(tab) => setDrawer({ studentId: active.id, tab })}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

function DebtorRow({
  student,
  extended,
  onAction,
}: {
  student: AdminStudent;
  extended: boolean;
  onAction: (tab: DrawerTab) => void;
}) {
  const days = overdueDays(student);
  const debt = debtOf(student);

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50">
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-foreground-muted">
            {student.fullName
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0])
              .join("")}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">{student.fullName}</span>
            <span className="block text-xs text-foreground-muted">{student.className} sinf</span>
          </span>
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="block text-foreground">{student.guardianName}</span>
        <span className="num block text-xs text-foreground-muted">{student.guardianPhone}</span>
      </td>
      <td className="num px-3 py-2.5 text-foreground-muted">{formatSom(student.monthlyFee)}</td>
      <td className="num px-3 py-2.5 text-foreground-muted">{formatSom(student.paidAmount)}</td>
      <td className="num px-3 py-2.5 font-medium text-danger">{formatSom(debt)}</td>
      <td className="px-3 py-2.5">
        {days > 30 ? (
          <Badge tone="danger">{days} kun</Badge>
        ) : days > 0 ? (
          <Badge tone="warning">{days} kun</Badge>
        ) : (
          <span className="text-xs text-foreground-muted">Muddat kelmagan</span>
        )}
        {extended && (
          <span className="mt-1 block text-[11px] text-info">Muddat choʻzilgan</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="flex flex-wrap gap-1">
          {DRAWER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onAction(tab.id)}
              className="focus-ring rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground-muted transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand-dark"
            >
              {tab.label}
            </button>
          ))}
        </span>
      </td>
    </tr>
  );
}

/** Oʻng tomondan chiqadigan panel — toʻrtala amal shu yerda. */
function PaymentDrawer({
  student,
  tab,
  onTab,
  onClose,
}: {
  student: AdminStudent;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  onClose: () => void;
}) {
  const dispatch = useAdminDispatch();
  const { payments } = useAdmin();
  const debt = debtOf(student);
  const days = overdueDays(student);
  const history = payments.filter((p) => p.studentId === student.id);

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="flex-1 bg-foreground/20"
      />
      <aside className="animate-expand flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-lg sm:w-[440px]">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {DRAWER_TABS.find((t) => t.id === tab)?.label}
            </h2>
            <p className="text-sm text-foreground-muted">
              {student.fullName} ({student.className})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Panelni yopish"
            className="focus-ring rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-surface-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Qisqacha holat */}
        <dl className="grid grid-cols-2 gap-3 border-b border-border bg-surface-muted/50 p-4 text-sm">
          <div>
            <dt className="text-xs text-foreground-muted">Shartnoma summasi</dt>
            <dd className="num font-medium text-foreground">{formatSom(student.monthlyFee)}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Toʻlangan</dt>
            <dd className="num font-medium text-foreground">{formatSom(student.paidAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Qolgan qarz</dt>
            <dd className="num font-semibold text-danger">{formatSom(debt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground-muted">Muddat</dt>
            <dd className="num font-medium text-foreground">
              {student.dueDate}
              {days > 0 && (
                <span className="ml-1 text-xs font-normal text-danger">({days} kun)</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex gap-1 border-b border-border px-4 py-2">
          {DRAWER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-pressed={tab === t.id}
              className={`focus-ring rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4">
          {tab === "payment" && (
            <PaymentForm student={student} debt={debt} onDone={onClose} dispatch={dispatch} />
          )}
          {tab === "extend" && <ExtendForm student={student} onDone={onClose} dispatch={dispatch} />}
          {tab === "discount" && (
            <DiscountForm student={student} debt={debt} onDone={onClose} dispatch={dispatch} />
          )}
          {tab === "reminder" && (
            <ReminderForm student={student} debt={debt} onDone={onClose} dispatch={dispatch} />
          )}

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Toʻlov tarixi
            </h3>
            {history.length === 0 ? (
              <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-foreground-muted">
                Joriy oʻquv yilida toʻlovlar mavjud emas.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span
                        className={`num block font-medium ${p.kind === "storno" ? "text-danger" : "text-foreground"}`}
                      >
                        {p.kind === "storno" ? "Storno " : ""}
                        {formatSom(Math.abs(p.amount))}
                      </span>
                      <span className="block text-xs text-foreground-muted">
                        {p.paidAt} · {PAYMENT_METHOD_LABELS[p.method]}
                        {p.receiptNo ? ` · ${p.receiptNo}` : ""}
                      </span>
                    </span>
                    {p.kind === "payment" && (
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "STORNO_PAYMENT",
                            paymentId: p.id,
                            reason: "Xato kiritilgan",
                          })
                        }
                        className="focus-ring shrink-0 rounded px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-tint"
                      >
                        Storno
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

type Dispatch = ReturnType<typeof useAdminDispatch>;

function PaymentForm({
  student,
  debt,
  onDone,
  dispatch,
}: {
  student: AdminStudent;
  debt: number;
  onDone: () => void;
  dispatch: Dispatch;
}) {
  const [method, setMethod] = useState<PaymentMethod>("naqd");
  const [amount, setAmount] = useState(debt);
  const [paidAt, setPaidAt] = useState("2026-09-20");
  const [receiptNo, setReceiptNo] = useState("");
  const [note, setNote] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (amount <= 0) return;
        dispatch({
          type: "RECORD_PAYMENT",
          studentId: student.id,
          amount,
          method,
          paidAt,
          receiptNo,
          note,
        });
        onDone();
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Toʻlov turi">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={`focus-ring flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                method === m
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {PAYMENT_METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Summa (soʻm)">
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className={inputClass}
        />
        <div className="mt-1.5 flex gap-1.5">
          <Chip onClick={() => setAmount(debt)}>Toʻliq summa</Chip>
          <Chip onClick={() => setAmount(Math.round(debt / 2 / 100_000) * 100_000)}>Yarmi</Chip>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Toʻlov sanasi">
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Chek / hujjat raqami">
          <input
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            placeholder="Ixtiyoriy"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Izoh">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Toʻlov haqida qoʻshimcha maʼlumot…"
          className={`${inputClass} resize-none`}
        />
      </Field>

      <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs leading-relaxed text-warning">
        Toʻlov yozuvi kiritilgandan keyin tahrirlanmaydi va oʻchirilmaydi. Xato boʻlsa —
        storno yozuvi qoʻshiladi. Barcha amallar audit jurnalida qayd etiladi.
      </p>

      <SubmitRow onCancel={onDone} label="Toʻlovni saqlash" />
    </form>
  );
}

function ExtendForm({
  student,
  onDone,
  dispatch,
}: {
  student: AdminStudent;
  onDone: () => void;
  dispatch: Dispatch;
}) {
  const [newDueDate, setNewDueDate] = useState("2026-10-05");
  const [reason, setReason] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        dispatch({
          type: "DEBT_ACTION",
          studentId: student.id,
          actionType: "extend",
          newDueDate,
          amount: 0,
          reason: reason || "Ota-ona bilan kelishildi",
        });
        onDone();
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Yangi toʻlov muddati">
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Sababi">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Masalan: ota-ona ish haqi 10-sanada keladi, shunga kelishildi"
          className={`${inputClass} resize-none`}
        />
      </Field>
      <p className="rounded-lg bg-info-tint px-3 py-2 text-xs text-info">
        Muddat choʻzilishi qarzni yopmaydi — faqat kechikish hisobini toʻxtatadi va
        eslatmalarni surib qoʻyadi.
      </p>
      <SubmitRow onCancel={onDone} label="Muddatni saqlash" />
    </form>
  );
}

function DiscountForm({
  student,
  debt,
  onDone,
  dispatch,
}: {
  student: AdminStudent;
  debt: number;
  onDone: () => void;
  dispatch: Dispatch;
}) {
  const [mode, setMode] = useState<DebtActionType>("discount");
  const [percent, setPercent] = useState(10);
  const [reason, setReason] = useState("");

  const amount =
    mode === "discount" ? Math.round((debt * percent) / 100 / 1000) * 1000 : debt;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        dispatch({
          type: "DEBT_ACTION",
          studentId: student.id,
          actionType: mode,
          percent: mode === "discount" ? percent : undefined,
          amount,
          reason,
        });
        onDone();
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Amal turi">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(["discount", "writeoff"] as DebtActionType[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`focus-ring flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {DEBT_ACTION_LABELS[m]}
            </button>
          ))}
        </div>
      </Field>

      {mode === "discount" && (
        <Field label="Chegirma foizi">
          <div className="flex gap-1.5">
            {[10, 25, 50, 100].map((p) => (
              <Chip key={p} active={percent === p} onClick={() => setPercent(p)}>
                {p}%
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
        <span className="text-foreground-muted">Qarzdan ayiriladi: </span>
        <span className="num font-semibold text-foreground">{formatSom(amount)}</span>
      </div>

      <Field label="Asosi (majburiy)">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          required
          placeholder="Masalan: koʻp bolali oila, direktor buyrugʻi №12"
          className={`${inputClass} resize-none`}
        />
      </Field>

      <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs leading-relaxed text-warning">
        Chegirma va hisobdan chiqarish rahbariyat tasdigʻini talab qiladi. Amal audit
        jurnaliga asosi bilan tushadi.
      </p>

      <SubmitRow onCancel={onDone} label="Amalni saqlash" />
    </form>
  );
}

function ReminderForm({
  student,
  debt,
  onDone,
  dispatch,
}: {
  student: AdminStudent;
  debt: number;
  onDone: () => void;
  dispatch: Dispatch;
}) {
  const [channel, setChannel] = useState<"bot" | "sms">("bot");
  const [text, setText] = useState(
    `Hurmatli ota-ona, ${student.fullName} uchun oylik toʻlov boʻyicha ${formatSom(debt)} qarzdorlik mavjud. Iltimos, maktab administratori bilan bogʻlaning.`,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        dispatch({ type: "SEND_REMINDER", studentIds: [student.id], channel, text });
        onDone();
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Kanal">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(["bot", "sms"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              aria-pressed={channel === c}
              className={`focus-ring flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                channel === c
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {c === "bot" ? "Telegram bot" : "SMS"}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Xabar matni">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className={`${inputClass} resize-none`}
        />
      </Field>
      <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
        Qabul qiluvchi: {student.guardianName} · {student.guardianPhone}
      </p>
      <SubmitRow onCancel={onDone} label="Eslatmani yuborish" />
    </form>
  );
}

// ─────────────────────────── Kichik yordamchilar ───────────────────────────

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function Chip({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-brand text-brand-foreground"
          : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
      }`}
    >
      {children}
    </button>
  );
}

function SubmitRow({ onCancel, label }: { onCancel: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="focus-ring rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
      >
        Bekor qilish
      </button>
      <button
        type="submit"
        className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
      >
        {label}
      </button>
    </div>
  );
}
