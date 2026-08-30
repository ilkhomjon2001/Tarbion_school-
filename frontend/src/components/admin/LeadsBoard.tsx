"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PhoneIcon, PlusIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import { useActiveClasses, useAdmin, useAdminDispatch, useLeadFunnel } from "@/lib/admin/store";
import {
  CALL_OUTCOME_LABELS,
  LEAD_PIPELINE,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
  type CallOutcome,
  type Lead,
  type LeadSource,
  type LeadStage,
} from "@/lib/admin/types";

/** Bugungi sana — kechikkan qadamlarni ajratish uchun. */
const TODAY = "2026-09-20";

const STAGE_TONE: Record<LeadStage, "info" | "warning" | "brand" | "success" | "neutral"> = {
  yangi: "info",
  boglanildi: "warning",
  tashrif: "brand",
  sinov_kuni: "brand",
  ariza: "success",
  rad: "neutral",
};

const LOST_REASONS = [
  "Narx yuqori keldi",
  "Boshqa maktabni tanladi",
  "Uydan uzoq",
  "Bu yil qoldirdi",
  "Bogʻlana olmadik",
];

/**
 * Lidlar — hali ariza bermagan, faqat qiziqqan oilalar.
 *
 * Voronka bosqichma-bosqich: yangi → bogʻlanildi → tashrif → sinov kuni →
 * ariza. Oxirgi bosqichda lid qabul sehrgariga oʻtadi va maʼlumotlari
 * oldindan toʻldirilgan holda ochiladi — ikkinchi marta yozilmaydi.
 */
export function LeadsBoard() {
  const { leads } = useAdmin();
  const dispatch = useAdminDispatch();
  const router = useRouter();
  const { funnel, lost, conversion } = useLeadFunnel();

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((l) => {
        if (stageFilter !== "all" && l.stage !== stageFilter) return false;
        if (!q) return true;
        return (
          l.childName.toLowerCase().includes(q) ||
          l.parentName.toLowerCase().includes(q) ||
          l.phone.includes(q)
        );
      })
      // Kechikkan qadamlar tepada — ular bilan bugun ishlash kerak.
      .sort((a, b) => {
        const aLate = a.stage !== "rad" && a.nextActionAt < TODAY;
        const bLate = b.stage !== "rad" && b.nextActionAt < TODAY;
        if (aLate !== bLate) return aLate ? -1 : 1;
        return a.nextActionAt.localeCompare(b.nextActionAt);
      });
  }, [leads, query, stageFilter]);

  const overdue = leads.filter((l) => l.stage !== "rad" && l.nextActionAt < TODAY).length;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Lidlar</h1>
          <p className="text-sm text-foreground-muted">
            Qiziqqan oilalar — birinchi qoʻngʻiroqdan arizagacha
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv("tarbion-lidlar", [
                [
                  "Bola",
                  "Tugʻilgan yili",
                  "Sinf",
                  "Ota-ona",
                  "Telefon",
                  "Manba",
                  "Bosqich",
                  "Keyingi qadam",
                  "Izoh",
                ],
                ...rows.map((l) => [
                  l.childName,
                  String(l.birthYear),
                  l.targetClass,
                  l.parentName,
                  l.phone,
                  LEAD_SOURCE_LABELS[l.source],
                  LEAD_STAGE_LABELS[l.stage],
                  l.nextActionAt,
                  l.lostReason ? `${l.note} · ${l.lostReason}` : l.note,
                ]),
              ])
            }
            className="focus-ring h-10 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            Yuklab olish (CSV)
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            <PlusIcon className="h-4 w-4" />
            Yangi lid
          </button>
        </div>
      </div>

      {creating && <LeadComposer onClose={() => setCreating(false)} />}

      {/* Voronka */}
      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Voronka</h2>
          <p className="text-xs text-foreground-muted">
            Arizagacha yetgani:{" "}
            <span className="num font-semibold text-success">{conversion}%</span> ·
            yoʻqotilgan: <span className="num font-semibold text-danger">{lost}</span>
            {overdue > 0 && (
              <>
                {" "}
                · kechikkan qadam:{" "}
                <span className="num font-semibold text-warning">{overdue}</span>
              </>
            )}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {funnel.map((step) => (
            <li key={step.stage} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setStageFilter(stageFilter === step.stage ? "all" : step.stage)
                }
                aria-pressed={stageFilter === step.stage}
                className={`focus-ring w-32 shrink-0 rounded px-1 py-0.5 text-left text-sm transition-colors ${
                  stageFilter === step.stage
                    ? "font-semibold text-brand-dark"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {LEAD_STAGE_LABELS[step.stage]}
              </button>
              <span className="h-2.5 min-w-0 flex-1 rounded-full bg-surface-muted">
                <span
                  className="bar-fill block h-full rounded-full bg-brand"
                  style={{ width: `${step.percent}%` }}
                />
              </span>
              <span className="num w-16 shrink-0 text-right text-sm text-foreground">
                {step.count} ta
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Filtrlar */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bola, ota-ona yoki telefon boʻyicha…"
            aria-label="Lidlarni qidirish"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as LeadStage | "all")}
          aria-label="Bosqich"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Barcha bosqichlar</option>
          {(Object.keys(LEAD_STAGE_LABELS) as LeadStage[]).map((s) => (
            <option key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center text-sm text-foreground-muted">
          Lid topilmadi. Filtrni oʻzgartiring yoki yangisini qoʻshing.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((lead) => (
            <li key={lead.id}>
              <LeadCard
                lead={lead}
                open={openId === lead.id}
                onToggle={() => setOpenId(openId === lead.id ? null : lead.id)}
                onMove={(stage, lostReason) =>
                  dispatch({ type: "MOVE_LEAD", leadId: lead.id, stage, lostReason })
                }
                onConvert={() => {
                  dispatch({ type: "MOVE_LEAD", leadId: lead.id, stage: "ariza" });
                  router.push(`/admin/qabul?lid=${lead.id}`);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
        Lid oʻchirilmaydi — «Yoʻqotildi» bosqichiga sabab bilan oʻtkaziladi.
        Shunda «nechta qoʻngʻiroqdan nechta oʻquvchi chiqdi» degan savolga
        javob qoladi.
      </p>
    </div>
  );
}

function LeadCard({
  lead,
  open,
  onToggle,
  onMove,
  onConvert,
}: {
  lead: Lead;
  open: boolean;
  onToggle: () => void;
  onMove: (stage: LeadStage, lostReason?: string) => void;
  onConvert: () => void;
}) {
  const { calls } = useAdmin();
  const dispatch = useAdminDispatch();
  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState(LOST_REASONS[0]);
  const [logging, setLogging] = useState(false);

  const myCalls = calls.filter((c) => c.leadId === lead.id);
  const late = lead.stage !== "rad" && lead.nextActionAt < TODAY;
  const stageIndex = LEAD_PIPELINE.indexOf(lead.stage);
  const nextStage = stageIndex >= 0 ? LEAD_PIPELINE[stageIndex + 1] : undefined;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-surface transition-colors ${
        open ? "border-brand/40" : late ? "border-warning/40" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="focus-ring-inset flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-muted/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {lead.childName}
          </span>
          <span className="block truncate text-xs text-foreground-muted">
            {lead.targetClass} · {lead.parentName} · {lead.phone}
          </span>
          <span className="mt-1 block truncate text-xs text-foreground-muted">
            {LEAD_SOURCE_LABELS[lead.source]} · {lead.note}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={STAGE_TONE[lead.stage]}>{LEAD_STAGE_LABELS[lead.stage]}</Badge>
          <span className={`num text-[11px] ${late ? "text-warning" : "text-foreground-muted"}`}>
            {late ? "kechikdi: " : "keyingi: "}
            {lead.nextActionAt}
          </span>
          {myCalls.length > 0 && (
            <span className="num text-[11px] text-foreground-muted">
              {myCalls.length} ta qoʻngʻiroq
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="animate-expand border-t border-border p-4">
          {myCalls.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Qoʻngʻiroqlar tarixi
              </h4>
              <ul className="flex flex-col gap-1.5">
                {myCalls.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-surface-muted px-3 py-1.5 text-xs"
                  >
                    <span className="num text-foreground-muted">{c.at}</span>
                    <span className="font-medium text-foreground">
                      {CALL_OUTCOME_LABELS[c.outcome]}
                    </span>
                    <span className="num text-foreground-muted">
                      {Math.round(c.durationSec / 60)} daq
                    </span>
                    <span className="w-full text-foreground-muted">{c.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {logging ? (
            <CallForm
              phone={lead.phone}
              contactName={lead.parentName}
              onCancel={() => setLogging(false)}
              onSave={(call) => {
                dispatch({ type: "LOG_CALL", call: { ...call, leadId: lead.id } });
                setLogging(false);
              }}
            />
          ) : losing ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-48 flex-1">
                <span className="mb-1.5 block text-xs font-medium text-foreground">
                  Yoʻqotish sababi
                </span>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className={leadInput}
                >
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  onMove("rad", lostReason);
                  setLosing(false);
                }}
                className="focus-ring h-10 rounded-lg bg-danger px-3.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
              >
                Yoʻqotildi deb belgilash
              </button>
              <button
                type="button"
                onClick={() => setLosing(false)}
                className="focus-ring h-10 rounded-lg border border-border px-3.5 text-sm font-medium text-foreground-muted"
              >
                Bekor
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLogging(true)}
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                <PhoneIcon className="h-4 w-4" />
                Qoʻngʻiroq qayd etish
              </button>

              {lead.stage === "sinov_kuni" || lead.stage === "ariza" ? (
                <button
                  type="button"
                  onClick={onConvert}
                  className="focus-ring h-9 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
                >
                  Arizaga oʻtkazish
                </button>
              ) : (
                nextStage && (
                  <button
                    type="button"
                    onClick={() => onMove(nextStage)}
                    className="focus-ring h-9 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
                  >
                    → {LEAD_STAGE_LABELS[nextStage]}
                  </button>
                )
              )}

              {lead.stage !== "rad" && (
                <button
                  type="button"
                  onClick={() => setLosing(true)}
                  className="focus-ring h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:border-danger hover:text-danger"
                >
                  Yoʻqotildi
                </button>
              )}

              {lead.lostReason && (
                <p className="w-full rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
                  Sababi: {lead.lostReason}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Yangi lid — qoʻngʻiroq paytida tez toʻldiriladi, shuning uchun qisqa. */
function LeadComposer({ onClose }: { onClose: () => void }) {
  const dispatch = useAdminDispatch();
  const classes = useActiveClasses();

  const [childName, setChildName] = useState("");
  const [birthYear, setBirthYear] = useState(2016);
  const [targetClass, setTargetClass] = useState(classes[0]?.name ?? "");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("+998 ");
  const [source, setSource] = useState<LeadSource>("telefon");
  const [note, setNote] = useState("");
  const [nextActionAt, setNextActionAt] = useState("2026-09-22");

  const problems: string[] = [];
  if (childName.trim().split(/\s+/).length < 2) problems.push("Bolaning F.I.Sh ini toʻliq yozing.");
  if (parentName.trim().length < 3) problems.push("Ota-ona ismini kiriting.");
  if (!/^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(phone.trim())) {
    problems.push("Telefon format: +998 90 123 45 67.");
  }

  return (
    <div className="animate-expand rounded-xl border border-brand/40 bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Yangi lid</h2>
          <p className="text-xs text-foreground-muted">
            Qoʻngʻiroq paytida toʻldiring — qolgani keyin aniqlashtiriladi
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Bola F.I.Sh</span>
          <input
            autoFocus
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="Familiya Ism"
            className={leadInput}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Tugʻilgan yili</span>
          <input
            type="number"
            min={2005}
            max={2022}
            value={birthYear}
            onChange={(e) => setBirthYear(Number(e.target.value))}
            className={`${leadInput} num`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Qaysi sinfga</span>
          <select
            value={targetClass}
            onChange={(e) => setTargetClass(e.target.value)}
            className={leadInput}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Ota-ona</span>
          <input
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className={leadInput}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Telefon</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className={`${leadInput} num`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Manba</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as LeadSource)}
            className={leadInput}
          >
            {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Keyingi qadam sanasi
          </span>
          <input
            type="date"
            value={nextActionAt}
            onChange={(e) => setNextActionAt(e.target.value)}
            className={leadInput}
          />
        </label>
        <label className="block sm:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Izoh</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nima soʻradi, nimaga qiziqdi"
            className={leadInput}
          />
        </label>
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="focus-ring rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          Bekor qilish
        </button>
        <button
          type="button"
          disabled={problems.length > 0}
          onClick={() => {
            dispatch({
              type: "ADD_LEAD",
              lead: {
                childName: childName.trim(),
                birthYear,
                targetClass,
                parentName: parentName.trim(),
                phone: phone.trim(),
                source,
                stage: "yangi",
                note: note.trim(),
                nextActionAt,
              },
            });
            onClose();
          }}
          className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          Lidni saqlash
        </button>
      </div>
    </div>
  );
}

/** Qoʻngʻiroq qaydi — lid kartochkasida va qoʻngʻiroqlar boʻlimida ishlatiladi. */
export function CallForm({
  phone,
  contactName,
  onCancel,
  onSave,
}: {
  phone: string;
  contactName: string;
  onCancel: () => void;
  onSave: (call: {
    at: string;
    direction: "kirish" | "chiqish";
    phone: string;
    contactName: string;
    durationSec: number;
    outcome: CallOutcome;
    note: string;
  }) => void;
}) {
  const [direction, setDirection] = useState<"kirish" | "chiqish">("chiqish");
  const [outcome, setOutcome] = useState<CallOutcome>("javob_berdi");
  const [minutes, setMinutes] = useState(3);
  const [note, setNote] = useState("");

  return (
    <div className="animate-expand flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Yoʻnalish</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "kirish" | "chiqish")}
            className={leadInput}
          >
            <option value="chiqish">Biz qoʻngʻiroq qildik</option>
            <option value="kirish">Ular qoʻngʻiroq qildi</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Natija</span>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as CallOutcome)}
            className={leadInput}
          >
            {(Object.keys(CALL_OUTCOME_LABELS) as CallOutcome[]).map((o) => (
              <option key={o} value={o}>
                {CALL_OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Davomiyligi (daqiqa)
          </span>
          <input
            type="number"
            min={0}
            max={90}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={`${leadInput} num`}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-foreground">Nima gaplashildi</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Qisqacha mazmun"
          className={leadInput}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted"
        >
          Bekor
        </button>
        <button
          type="button"
          disabled={!note.trim()}
          onClick={() =>
            onSave({
              at: nowStamp(),
              direction,
              phone,
              contactName,
              durationSec: minutes * 60,
              outcome,
              note: note.trim(),
            })
          }
          className="focus-ring rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          Qaydni saqlash
        </button>
      </div>
    </div>
  );
}

export function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const leadInput =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";
