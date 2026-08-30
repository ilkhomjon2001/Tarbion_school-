"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertTriangleIcon, SearchIcon, UserIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import { formatSom } from "@/lib/format";
import { useAdmin, useAdminDispatch, useHrSummary } from "@/lib/admin/store";
import { TODAY } from "@/lib/school/exams";
import {
  CONTRACT_TYPE_LABELS,
  EXIT_REASON_LABELS,
  LEAVE_TYPE_LABELS,
  NORM_HOURS,
  POSITION_LABELS,
  QUALIFICATION_LABELS,
  attestationDue,
  daysBetween,
  onLeaveAt,
  overloadedTeachers,
  subjectLoads,
  unloadedTeachers,
  type ContractType,
  type Employee,
  type ExitReason,
  type LeaveType,
  type Position,
  type Qualification,
} from "@/lib/school/hr";

type Tab = "xodimlar" | "tatil" | "vakansiya" | "ketganlar";

const TAB_LABELS: Record<Tab, string> = {
  xodimlar: "Xodimlar",
  tatil: "Taʼtil va ruxsat",
  vakansiya: "Vakansiyalar",
  ketganlar: "Ishdan boʻshaganlar",
};

const QUALIFICATION_TONE: Record<Qualification, "success" | "brand" | "info" | "neutral"> = {
  oliy: "success",
  birinchi: "brand",
  ikkinchi: "info",
  toifasiz: "neutral",
};

const LEAVE_TONE: Record<LeaveType, "brand" | "danger" | "neutral" | "info"> = {
  tatil: "brand",
  kasallik: "danger",
  "oz-hisobidan": "neutral",
  malaka: "info",
};

/**
 * Kadrlar boʻlimi.
 *
 * Xodim oʻchirilmaydi — ishdan boʻshasa arxivlanadi va sababi bilan
 * «Ishdan boʻshaganlar» roʻyxatiga tushadi (CLAUDE.md 1-qoida). Lavozim,
 * toifa va maoshdagi har oʻzgarish audit jurnaliga eski va yangi qiymati
 * bilan yoziladi.
 */
export function HrBoard() {
  const [tab, setTab] = useState<Tab>("xodimlar");
  const summary = useHrSummary();

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Kadrlar</h1>
        <p className="text-sm text-foreground-muted">
          Xodimlar reyestri, yuklama, taʼtil va vakansiyalar
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Shtatdagi xodim"
          value={String(summary.headcount)}
          hint={`${summary.teachers} nafari oʻqituvchi`}
        />
        <StatCard
          label="Oylik ish haqi fondi"
          value={formatSom(summary.payroll)}
          hint={`oʻrtacha staj ${summary.averageExperience} yil`}
        />
        <StatCard
          label="Bugun ishda emas"
          value={String(summary.onLeave)}
          hint="taʼtil, kasallik yoki malaka oshirish"
          tone={summary.onLeave > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Ochiq vakansiya"
          value={String(summary.openVacancies)}
          hint={`kadrlar aylanmasi ${summary.turnoverPercent}%`}
          tone={summary.openVacancies > 0 ? "warning" : undefined}
        />
      </div>

      <RiskPanel />

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`focus-ring rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-brand text-brand-foreground"
                : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {tab === "xodimlar" && <EmployeesTab />}
      {tab === "tatil" && <LeavesTab />}
      {tab === "vakansiya" && <VacanciesTab />}
      {tab === "ketganlar" && <ExitsTab />}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "warning" | "danger";
}) {
  const valueClass =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}

/** Kadrlar xavfi — attestatsiya muddati, ortiqcha va boʻsh yuklama. */
function RiskPanel() {
  const { employees } = useAdmin();

  const due = attestationDue(employees);
  const over = overloadedTeachers(employees);
  const idle = unloadedTeachers(employees);
  const loads = useMemo(() => subjectLoads().slice(0, 3), []);

  if (due.length === 0 && over.length === 0 && idle.length === 0) return null;

  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <RiskCard
        title="Attestatsiya muddati"
        count={due.length}
        note="toifasi yoʻq yoki 5 yildan oshgan"
        names={due.map((e) => e.shortName)}
      />
      <RiskCard
        title={`Yuklama normadan yuqori (${NORM_HOURS} soat)`}
        count={over.length}
        note={
          loads.length > 0
            ? `eng ogʻir fan: ${loads[0].subject} — oʻrtacha ${loads[0].averagePerTeacher} soat`
            : ""
        }
        names={over.map((e) => `${e.shortName} · ${e.weeklyHours} soat`)}
      />
      <RiskCard
        title="Dars yuklamasi yoʻq"
        count={idle.length}
        note="stavka boʻsh turibdi"
        names={idle.map((e) => e.shortName)}
      />
    </section>
  );
}

function RiskCard({
  title,
  count,
  note,
  names,
}: {
  title: string;
  count: number;
  note: string;
  names: string[];
}) {
  return (
    <div className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-2.5">
        <AlertTriangleIcon
          className={`mt-0.5 h-5 w-5 shrink-0 ${count > 0 ? "text-warning" : "text-foreground-muted"}`}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="num text-lg font-bold text-foreground">{count}</p>
          {note && <p className="text-xs text-foreground-muted">{note}</p>}
        </div>
      </div>
      {names.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {names.slice(0, 5).map((n) => (
            <li key={n}>
              <Badge tone="neutral">{n}</Badge>
            </li>
          ))}
          {names.length > 5 && (
            <li>
              <Badge tone="neutral">+{names.length - 5}</Badge>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── Xodimlar ─────────────────────────

function EmployeesTab() {
  const { employees, leaves } = useAdmin();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const onLeaveIds = useMemo(
    () => new Set(onLeaveAt(TODAY, leaves).map((l) => l.staffId)),
    [leaves],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (!showArchived && e.status === "archived") return false;
      if (position !== "all" && e.position !== position) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        POSITION_LABELS[e.position].toLowerCase().includes(q)
      );
    });
  }, [employees, query, position, showArchived]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism yoki lavozim boʻyicha qidirish"
            aria-label="Xodimlarni qidirish"
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground"
          />
        </label>

        <select
          value={position}
          onChange={(e) => setPosition(e.target.value as Position | "all")}
          aria-label="Lavozim boʻyicha filtr"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
        >
          <option value="all">Barcha lavozimlar</option>
          {(Object.keys(POSITION_LABELS) as Position[]).map((p) => (
            <option key={p} value={p}>
              {POSITION_LABELS[p]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-foreground-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="focus-ring h-4 w-4 rounded border-border"
          />
          Arxivdagilar
        </label>

        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv("tarbion-kadrlar", [
              [
                "F.I.Sh.",
                "Lavozim",
                "Ishga kirgan",
                "Shartnoma",
                "Toifa",
                "Toifa sanasi",
                "Maʼlumoti",
                "Haftalik soat",
                "Maosh",
                "Telefon",
                "Holati",
              ],
              ...rows.map((e) => [
                e.fullName,
                POSITION_LABELS[e.position],
                e.hiredAt,
                CONTRACT_TYPE_LABELS[e.contractType],
                QUALIFICATION_LABELS[e.qualification],
                e.qualifiedAt,
                e.education,
                String(e.weeklyHours),
                String(e.salary),
                e.phone,
                e.status === "active" ? "Faol" : "Arxivda",
              ]),
            ])
          }
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<UserIcon className="h-5 w-5" />}
          title="Xodim topilmadi"
          description="Qidiruv yoki filtrni oʻzgartiring."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((e) => (
            <EmployeeRow
              key={e.staffId}
              employee={e}
              onLeave={onLeaveIds.has(e.staffId)}
              open={openId === e.staffId}
              onToggle={() => setOpenId((id) => (id === e.staffId ? null : e.staffId))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmployeeRow({
  employee: e,
  onLeave,
  open,
  onToggle,
}: {
  employee: Employee;
  onLeave: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="animate-enter overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="focus-ring flex w-full flex-wrap items-center gap-3 p-4 text-left transition-colors hover:bg-surface-muted/50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand-dark">
          {e.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {e.fullName}
          </span>
          <span className="block truncate text-xs text-foreground-muted">
            {POSITION_LABELS[e.position]} · {CONTRACT_TYPE_LABELS[e.contractType]}
            {e.weeklyHours > 0 && (
              <>
                {" "}
                · <span className="num">{e.weeklyHours}</span> soat/hafta
              </>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          {e.status === "archived" && <Badge tone="neutral">Arxivda</Badge>}
          {onLeave && <Badge tone="warning">Ishda emas</Badge>}
          {e.weeklyHours > NORM_HOURS && <Badge tone="danger">Ortiqcha yuklama</Badge>}
          <Badge tone={QUALIFICATION_TONE[e.qualification]}>
            {QUALIFICATION_LABELS[e.qualification]}
          </Badge>
          <span className="num w-28 text-right text-sm font-semibold text-foreground">
            {formatSom(e.salary)}
          </span>
        </span>
      </button>

      {open && <EmployeeDetail employee={e} />}
    </li>
  );
}

function EmployeeDetail({ employee: e }: { employee: Employee }) {
  const dispatch = useAdminDispatch();
  const { leaves } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const [position, setPosition] = useState<Position>(e.position);
  const [contractType, setContractType] = useState<ContractType>(e.contractType);
  const [qualification, setQualification] = useState<Qualification>(e.qualification);
  const [salary, setSalary] = useState(String(e.salary));

  const [reason, setReason] = useState<ExitReason>("oz-arizasi");
  const [leftAt, setLeftAt] = useState(TODAY);
  const [exitNote, setExitNote] = useState("");

  const own = leaves.filter((l) => l.staffId === e.staffId);

  return (
    <div className="border-t border-border bg-surface-muted/30 p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:grid-cols-4">
        <Field label="Ishga kirgan" value={e.hiredAt} mono />
        <Field label="Tugʻilgan sana" value={e.birthDate} mono />
        <Field label="Maʼlumoti" value={e.education} />
        <Field label="Toifa berilgan" value={e.qualifiedAt} mono />
        <Field label="Telefon" value={e.phone} mono />
        <Field label="Elektron pochta" value={e.email} />
        <Field
          label="Haftalik yuklama"
          value={e.weeklyHours > 0 ? `${e.weeklyHours} / ${NORM_HOURS} soat` : "—"}
          mono
        />
        <Field label="Oylik maosh" value={formatSom(e.salary)} mono />
      </dl>

      {own.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-foreground">Taʼtil va ruxsatlar</p>
          <ul className="flex flex-col gap-1.5">
            {own.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={LEAVE_TONE[l.type]}>{LEAVE_TYPE_LABELS[l.type]}</Badge>
                <span className="num text-foreground-muted">
                  {l.from} — {l.to} ({l.days} kun)
                </span>
                <span className="text-foreground-muted">{l.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {e.status === "active" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setDismissing(false);
            }}
            className="focus-ring rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            {editing ? "Tahrirni yopish" : "Mehnat maʼlumotini oʻzgartirish"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissing((v) => !v);
              setEditing(false);
            }}
            className="focus-ring rounded-lg border border-danger bg-surface px-3.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-brand-foreground"
          >
            {dismissing ? "Bekor qilish" : "Ishdan boʻshatish"}
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground">Lavozim</span>
              <select
                value={position}
                onChange={(ev) => setPosition(ev.target.value as Position)}
                className="focus-ring h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              >
                {(Object.keys(POSITION_LABELS) as Position[]).map((p) => (
                  <option key={p} value={p}>
                    {POSITION_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground">Shartnoma</span>
              <select
                value={contractType}
                onChange={(ev) => setContractType(ev.target.value as ContractType)}
                className="focus-ring h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              >
                {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((c) => (
                  <option key={c} value={c}>
                    {CONTRACT_TYPE_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground">Toifa</span>
              <select
                value={qualification}
                onChange={(ev) => setQualification(ev.target.value as Qualification)}
                className="focus-ring h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              >
                {(Object.keys(QUALIFICATION_LABELS) as Qualification[]).map((q) => (
                  <option key={q} value={q}>
                    {QUALIFICATION_LABELS[q]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground">
                Maosh, soʻm
              </span>
              <input
                inputMode="numeric"
                value={salary}
                onChange={(ev) => setSalary(ev.target.value.replace(/\D/g, ""))}
                className="focus-ring num h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              dispatch({
                type: "UPDATE_EMPLOYEE",
                staffId: e.staffId,
                patch: {
                  position,
                  contractType,
                  qualification,
                  salary: Number(salary) || e.salary,
                },
              });
              setEditing(false);
            }}
            className="focus-ring mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            Oʻzgarishlarni saqlash
          </button>
          <p className="mt-2 text-xs text-foreground-muted">
            Har bir oʻzgarish audit jurnaliga eski va yangi qiymati bilan tushadi.
          </p>
        </div>
      )}

      {dismissing && (
        <div className="mt-3 rounded-lg border border-danger-tint bg-surface p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground">Sababi</span>
              <select
                value={reason}
                onChange={(ev) => setReason(ev.target.value as ExitReason)}
                className="focus-ring h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              >
                {(Object.keys(EXIT_REASON_LABELS) as ExitReason[]).map((r) => (
                  <option key={r} value={r}>
                    {EXIT_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground">
                Oxirgi ish kuni
              </span>
              <input
                type="date"
                value={leftAt}
                onChange={(ev) => setLeftAt(ev.target.value)}
                className="focus-ring h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground">Izoh</span>
              <input
                value={exitNote}
                onChange={(ev) => setExitNote(ev.target.value)}
                placeholder="Ixtiyoriy"
                className="focus-ring h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "DISMISS_EMPLOYEE",
                staffId: e.staffId,
                reason,
                leftAt,
                note: exitNote.trim(),
              })
            }
            className="focus-ring mt-3 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:opacity-90"
          >
            Ishdan boʻshatishni rasmiylashtirish
          </button>
          <p className="mt-2 text-xs text-foreground-muted">
            Yozuv oʻchirilmaydi: xodim arxivga oʻtadi va sababi bilan «Ishdan
            boʻshaganlar» roʻyxatida qoladi.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className={`text-sm text-foreground ${mono ? "num" : ""}`}>{value}</dd>
    </div>
  );
}

// ───────────────────────── Taʼtil ─────────────────────────

function LeavesTab() {
  const { leaves, employees } = useAdmin();
  const dispatch = useAdminDispatch();
  const [adding, setAdding] = useState(false);

  const active = employees.filter((e) => e.status === "active");
  const [staffId, setStaffId] = useState(active[0]?.staffId ?? "");
  const [type, setType] = useState<LeaveType>("tatil");
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(TODAY);
  const [note, setNote] = useState("");

  const nameOf = useMemo(
    () => new Map(employees.map((e) => [e.staffId, e.fullName])),
    [employees],
  );

  const sorted = useMemo(() => [...leaves].sort((a, b) => b.from.localeCompare(a.from)), [leaves]);
  const today = onLeaveAt(TODAY, leaves);
  const invalid = to < from;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          Bugun ishda emas: <span className="num font-semibold text-foreground">{today.length}</span>{" "}
          nafar
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="focus-ring h-10 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          {adding ? "Bekor qilish" : "Taʼtil rasmiylashtirish"}
        </button>
      </div>

      {adding && (
        <div className="animate-expand rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Xodim</span>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              >
                {active.map((e) => (
                  <option key={e.staffId} value={e.staffId}>
                    {e.shortName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Turi</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LeaveType)}
                className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              >
                {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Boshlanishi</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Tugashi</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-foreground">Asos</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ariza raqami, shifokor xulosasi yoki buyruq"
              className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            />
          </label>

          {invalid ? (
            <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              Tugash sanasi boshlanish sanasidan oldin boʻlishi mumkin emas.
            </p>
          ) : (
            <p className="mt-3 text-sm text-foreground-muted">
              Muddat: <span className="num font-semibold">{daysBetween(from, to)}</span> kun
            </p>
          )}

          <button
            type="button"
            disabled={invalid || !staffId}
            onClick={() => {
              dispatch({ type: "ADD_LEAVE", staffId, leaveType: type, from, to, note: note.trim() });
              setAdding(false);
              setNote("");
            }}
            className="focus-ring mt-3 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            Taʼtilni rasmiylashtirish
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">Xodim</th>
                <th className="px-3 py-3">Turi</th>
                <th className="px-3 py-3">Muddat</th>
                <th className="px-3 py-3">Kun</th>
                <th className="px-3 py-3">Asos</th>
                <th className="px-3 py-3">Rasmiylashtirdi</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => {
                const ongoing = l.from <= TODAY && TODAY <= l.to;
                return (
                  <tr
                    key={l.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {nameOf.get(l.staffId) ?? l.staffId}
                      {ongoing && (
                        <span className="ml-2 align-middle">
                          <Badge tone="warning">Davom etmoqda</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={LEAVE_TONE[l.type]}>{LEAVE_TYPE_LABELS[l.type]}</Badge>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-foreground-muted">
                      {l.from} — {l.to}
                    </td>
                    <td className="num px-3 py-2.5 text-foreground-muted">{l.days}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">{l.note}</td>
                    <td className="px-3 py-2.5 text-xs text-foreground-muted">{l.createdBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Vakansiyalar ─────────────────────────

function VacanciesTab() {
  const { vacancies } = useAdmin();
  const dispatch = useAdminDispatch();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [hours, setHours] = useState(16);
  const [reason, setReason] = useState("");

  const loads = useMemo(() => subjectLoads(), []);
  const ready = title.trim().length > 2 && reason.trim().length > 2;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          Ochiq:{" "}
          <span className="num font-semibold text-foreground">
            {vacancies.filter((v) => v.status === "ochiq").length}
          </span>{" "}
          ta
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="focus-ring h-10 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          {adding ? "Bekor qilish" : "Vakansiya ochish"}
        </button>
      </div>

      {adding && (
        <div className="animate-expand rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-foreground">Lavozim nomi</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Fizika oʻqituvchisi"
                className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Fan</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Fan yoki —"
                className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">
                Haftalik soat
              </span>
              <input
                type="number"
                min={1}
                max={36}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="focus-ring num h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-foreground">Asos</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nega kerak — yuklama, ketgan xodim yoki yangi sinf"
              className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            />
          </label>

          {/* Yuklama tahlili — vakansiya taxminan emas, raqam bilan asoslansin. */}
          <div className="mt-3 rounded-lg bg-surface-muted/60 p-3">
            <p className="text-xs font-medium text-foreground">
              Fan boʻyicha oʻrtacha yuklama (norma {NORM_HOURS} soat)
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {loads.slice(0, 6).map((l) => (
                <li key={l.subject}>
                  <Badge tone={l.averagePerTeacher > NORM_HOURS ? "danger" : "neutral"}>
                    {l.subject}: {l.averagePerTeacher} soat
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              dispatch({
                type: "OPEN_VACANCY",
                title: title.trim(),
                subject: subject.trim() || "—",
                hoursPerWeek: hours,
                reason: reason.trim(),
              });
              setAdding(false);
              setTitle("");
              setSubject("");
              setReason("");
            }}
            className="focus-ring mt-3 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            Vakansiyani ochish
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {vacancies.map((v) => (
          <li
            key={v.id}
            className="animate-enter flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{v.title}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {v.subject} · haftasiga <span className="num">{v.hoursPerWeek}</span> soat ·
                ochilgan <span className="num">{v.openedAt}</span>
              </p>
              <p className="mt-1 text-sm text-foreground-muted">{v.reason}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={v.status === "ochiq" ? "warning" : "neutral"}>
                {v.status === "ochiq" ? "Ochiq" : "Yopilgan"}
              </Badge>
              {v.status === "ochiq" && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "CLOSE_VACANCY", vacancyId: v.id })}
                  className="focus-ring rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  Yopish
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── Ketganlar ─────────────────────────

function ExitsTab() {
  const { exits } = useAdmin();

  const byReason = useMemo(() => {
    const map = new Map<ExitReason, number>();
    for (const e of exits) map.set(e.reason, (map.get(e.reason) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [exits]);

  if (exits.length === 0) {
    return (
      <EmptyState
        icon={<UserIcon className="h-5 w-5" />}
        title="Yozuv yoʻq"
        description="Ishdan boʻshagan xodimlar shu yerda sanasi va sababi bilan qoladi."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-1.5">
        {byReason.map(([reason, count]) => (
          <li key={reason}>
            <Badge tone="neutral">
              {EXIT_REASON_LABELS[reason]}: {count}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">F.I.Sh.</th>
                <th className="px-3 py-3">Lavozim</th>
                <th className="px-3 py-3">Ishlagan davri</th>
                <th className="px-3 py-3">Sababi</th>
                <th className="px-3 py-3">Izoh</th>
              </tr>
            </thead>
            <tbody>
              {[...exits]
                .sort((a, b) => b.leftAt.localeCompare(a.leftAt))
                .map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{e.fullName}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {POSITION_LABELS[e.position]}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-foreground-muted">
                      {e.hiredAt} — {e.leftAt}
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {EXIT_REASON_LABELS[e.reason]}
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">{e.note}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
          Yozuv oʻchirilmaydi — kadrlar aylanmasi va staj maʼlumotnomalari shundan
          hisoblanadi.
        </p>
      </div>
    </div>
  );
}
