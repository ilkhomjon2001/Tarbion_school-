"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckSquareIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import { TODAY } from "@/lib/school/exams";
import {
  CRITERIA,
  OBSERVATIONS,
  VERDICT_LABELS,
  observerName,
  qualitySummary,
  qualityTone,
  scoreOverall,
  verdictOf,
  type CriterionKey,
  type Observation,
  type Verdict,
} from "@/lib/school/quality";
import { ACADEMIC_HEAD, TEACHING_ASSIGNMENTS, allTeachers, staffById } from "@/lib/school/staff";

const VERDICT_TONE: Record<Verdict, "success" | "brand" | "warning" | "danger"> = {
  namunali: "success",
  yaxshi: "brand",
  tavsiya: "warning",
  qayta: "danger",
};

const TONE_TEXT = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

const TONE_BAR = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

type Filter = "all" | "rejada" | "kiritilmagan" | "tavsiya";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Barchasi",
  rejada: "Rejada",
  kiritilmagan: "Varaqa kiritilmagan",
  tavsiya: "Tavsiya berilgan",
};

/**
 * Sifat nazorati — dars kuzatuvi.
 *
 * KPI raqamlardan chiqadi, bu esa darsning oʻzidan. Oʻquv boʻlimi shu
 * yerdan kuzatuv rejalashtiradi, varaqani toʻldiradi va maktabning eng
 * zaif metodik mezonini koʻradi.
 *
 * DEMO: yangi kuzatuv va toʻldirilgan varaqa shu sahifa holatida
 * saqlanadi — brauzer yangilanganda boshlangʻich roʻyxatga qaytadi.
 */
export function QualityBoard() {
  // Generatsiya qilingan roʻyxat ustiga sahifada kiritilganlari qoʻshiladi.
  const [added, setAdded] = useState<Observation[]>([]);
  const [filled, setFilled] = useState<Record<string, Observation>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [planning, setPlanning] = useState(false);
  const [fillingId, setFillingId] = useState<string | null>(null);

  const all = useMemo(() => {
    const merged = [...added, ...OBSERVATIONS].map((o) => filled[o.id] ?? o);
    return merged.sort((a, b) => b.date.localeCompare(a.date));
  }, [added, filled]);

  const summary = useMemo(() => qualitySummary(all), [all]);

  const rows = useMemo(() => {
    return all.filter((o) => {
      if (teacherFilter !== "all" && o.teacherId !== teacherFilter) return false;
      if (filter === "rejada") return o.status === "rejada";
      if (filter === "kiritilmagan") return o.status === "otkazildi" && o.overall === null;
      if (filter === "tavsiya") return o.followUp !== null;
      return true;
    });
  }, [all, filter, teacherFilter]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Sifat nazorati</h1>
          <p className="text-sm text-foreground-muted">
            Dars kuzatuvi — beshta mezon boʻyicha baholanadi
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv("tarbion-sifat-nazorati", [
                [
                  "Sana",
                  "Ustoz",
                  "Sinf",
                  "Fan",
                  "Kuzatuvchi",
                  "Holat",
                  "Umumiy ball",
                  "Xulosa",
                  ...CRITERIA.map((c) => c.label),
                  "Tavsiya",
                ],
                ...rows.map((o) => [
                  o.date,
                  staffById(o.teacherId)?.fullName ?? o.teacherId,
                  o.className,
                  o.subject,
                  observerName(o.observerId),
                  o.status === "rejada" ? "Rejada" : "Oʻtkazildi",
                  o.overall === null ? "—" : String(o.overall),
                  o.verdict ? VERDICT_LABELS[o.verdict] : "—",
                  ...CRITERIA.map((c) =>
                    o.scores ? String(o.scores[c.key]) : "—",
                  ),
                  o.followUp ?? "—",
                ]),
              ])
            }
            className="focus-ring h-10 shrink-0 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => setPlanning((v) => !v)}
            className="focus-ring h-10 shrink-0 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            {planning ? "Bekor qilish" : "Kuzatuv rejalashtirish"}
          </button>
        </div>
      </div>

      {planning && (
        <ObservationPlanner
          existing={all}
          onCreate={(observation) => {
            setAdded((list) => [observation, ...list]);
            setPlanning(false);
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Oʻtkazilgan kuzatuv"
          value={String(summary.conducted)}
          hint={`${summary.planned} tasi rejada`}
        />
        <SummaryCard
          label="Oʻrtacha ball"
          value={summary.average === null ? "—" : String(summary.average)}
          hint="100 ballik shkala"
          tone={summary.average === null ? undefined : qualityTone(summary.average)}
        />
        <SummaryCard
          label="Varaqa kiritilmagan"
          value={String(summary.awaitingScores)}
          hint="dars koʻrilgan, baho yoʻq"
          tone={summary.awaitingScores > 0 ? "warning" : undefined}
        />
        <SummaryCard
          label="Ochiq tavsiya"
          value={String(summary.openFollowUps)}
          hint="bajarilishi kutilmoqda"
          tone={summary.openFollowUps > 0 ? "warning" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Mezonlar kesimi — maktabning zaif tomoni shu yerda koʻrinadi. */}
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <h2 className="border-b border-border px-4 py-3 text-base font-semibold text-foreground">
            Mezonlar kesimi
          </h2>
          <ul className="divide-y divide-border">
            {summary.byCriterion.map((c) => {
              const criterion = CRITERIA.find((x) => x.key === c.key)!;
              const weakest = summary.weakest?.key === c.key;
              const percent = (c.average / 5) * 100;
              return (
                <li key={c.key} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {c.label}
                      {weakest && (
                        <span className="ml-2 align-middle">
                          <Badge tone="warning">Eng zaif</Badge>
                        </span>
                      )}
                    </span>
                    <span className={`num text-sm font-semibold ${TONE_TEXT[qualityTone(percent)]}`}>
                      {c.average.toFixed(2)}
                      <span className="text-xs font-normal text-foreground-muted"> / 5</span>
                    </span>
                  </div>
                  <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className={`bar-fill block h-full rounded-full ${TONE_BAR[qualityTone(percent)]}`}
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <p className="mt-1.5 text-xs text-foreground-muted">{criterion.hint}</p>
                </li>
              );
            })}
          </ul>
          {summary.weakest && (
            <p className="border-t border-border bg-warning-tint/40 px-4 py-3 text-xs text-foreground">
              Maktab boʻyicha eng past mezon —{" "}
              <span className="font-semibold">{summary.weakest.label}</span>. Keyingi
              metodik seminar mavzusi shundan olinishi tavsiya etiladi.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <h2 className="border-b border-border px-4 py-3 text-base font-semibold text-foreground">
              Xulosalar taqsimoti
            </h2>
            <ul className="divide-y divide-border">
              {(Object.keys(VERDICT_LABELS) as Verdict[]).map((v) => (
                <li key={v} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-foreground-muted">{VERDICT_LABELS[v]}</span>
                  <Badge tone={VERDICT_TONE[v]}>{summary.byVerdict[v]} ta</Badge>
                </li>
              ))}
            </ul>
          </section>

          {summary.notObserved.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-warning-tint bg-surface shadow-sm">
              <h2 className="border-b border-border px-4 py-3 text-base font-semibold text-foreground">
                Kuzatuvsiz qolgan ustozlar
              </h2>
              <ul className="divide-y divide-border">
                {summary.notObserved.map((t) => (
                  <li key={t.id} className="px-4 py-2.5 text-sm text-foreground">
                    {t.fullName}
                  </li>
                ))}
              </ul>
              <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
                Dars yuklamasi biriktirilmagani uchun kuzatuvga rejalashtirilmagan.
              </p>
            </section>
          )}
        </div>
      </div>

      {/* Kuzatuvlar roʻyxati */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`focus-ring rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? "bg-brand text-brand-foreground"
                : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}
        <select
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          aria-label="Ustoz boʻyicha filtr"
          className="focus-ring ml-auto h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
        >
          <option value="all">Barcha ustozlar</option>
          {allTeachers().map((t) => (
            <option key={t.id} value={t.id}>
              {t.shortName}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CheckSquareIcon className="h-5 w-5" />}
          title="Kuzatuv topilmadi"
          description="Filtrni oʻzgartiring yoki yangi kuzatuv rejalashtiring."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.slice(0, 60).map((o) => (
            <ObservationCard
              key={o.id}
              observation={o}
              filling={fillingId === o.id}
              onToggleFill={() => setFillingId((id) => (id === o.id ? null : o.id))}
              onSave={(scores, note) => {
                const overall = scoreOverall(scores);
                const verdict = verdictOf(overall);
                setFilled((map) => ({
                  ...map,
                  [o.id]: { ...o, scores, overall, verdict, note },
                }));
                setFillingId(null);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <div className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${tone ? TONE_TEXT[tone] : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}

function ObservationCard({
  observation: o,
  filling,
  onToggleFill,
  onSave,
}: {
  observation: Observation;
  filling: boolean;
  onToggleFill: () => void;
  onSave: (scores: Record<CriterionKey, number>, note: string) => void;
}) {
  const teacher = staffById(o.teacherId);
  const awaiting = o.status === "otkazildi" && o.overall === null;

  return (
    <li className="animate-enter overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {teacher?.fullName ?? o.teacherId}
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {o.className} · {o.subject} · <span className="num">{o.lessonNo}</span>-dars ·{" "}
            <span className="num">{o.date}</span> · kuzatuvchi {observerName(o.observerId)}
          </p>
          {o.note && <p className="mt-2 text-sm text-foreground-muted">{o.note}</p>}
          {o.followUp && (
            <p className="mt-2 rounded-lg bg-warning-tint/50 px-3 py-2 text-xs text-foreground">
              <span className="font-semibold">Tavsiya:</span> {o.followUp}
              {o.recheckAt && (
                <>
                  {" "}
                  · qayta kuzatuv <span className="num">{o.recheckAt}</span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {o.status === "rejada" ? (
            <Badge tone="info">Rejada</Badge>
          ) : o.overall === null ? (
            <Badge tone="warning">Varaqa kiritilmagan</Badge>
          ) : (
            <>
              <span className={`num text-lg font-bold ${TONE_TEXT[qualityTone(o.overall)]}`}>
                {o.overall}
              </span>
              {o.verdict && <Badge tone={VERDICT_TONE[o.verdict]}>{VERDICT_LABELS[o.verdict]}</Badge>}
            </>
          )}
          {awaiting && (
            <button
              type="button"
              onClick={onToggleFill}
              className="focus-ring rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
            >
              {filling ? "Yopish" : "Varaqani toʻldirish"}
            </button>
          )}
        </div>
      </div>

      {o.scores && (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-border px-4 py-3 sm:grid-cols-2">
          {CRITERIA.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-foreground-muted">{c.label}</span>
              <span className="num shrink-0 font-semibold text-foreground">
                {o.scores![c.key]}
                <span className="font-normal text-foreground-muted"> / 5</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {filling && <ObservationForm onSave={onSave} />}
    </li>
  );
}

/** Kuzatuv varaqasi — beshta mezon 1 dan 5 gacha. */
function ObservationForm({
  onSave,
}: {
  onSave: (scores: Record<CriterionKey, number>, note: string) => void;
}) {
  const [scores, setScores] = useState<Record<CriterionKey, number>>(
    () => Object.fromEntries(CRITERIA.map((c) => [c.key, 4])) as Record<CriterionKey, number>,
  );
  const [note, setNote] = useState("");

  const overall = scoreOverall(scores);

  return (
    <div className="border-t border-border bg-surface-muted/40 p-4">
      <ul className="flex flex-col gap-3">
        {CRITERIA.map((c) => (
          <li key={c.key}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{c.label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                    aria-pressed={scores[c.key] === n}
                    aria-label={`${c.label}: ${n} ball`}
                    className={`focus-ring num h-8 w-8 rounded-lg border text-sm font-semibold transition-colors ${
                      scores[c.key] === n
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">{c.hint}</p>
          </li>
        ))}
      </ul>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-foreground">Kuzatuvchi izohi</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Darsda nima yaxshi kechdi, nimani tuzatish kerak"
          className="focus-ring w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-muted">
          Umumiy ball:{" "}
          <span className={`num font-bold ${TONE_TEXT[qualityTone(overall)]}`}>{overall}</span> ·{" "}
          {VERDICT_LABELS[verdictOf(overall)]}
        </p>
        <button
          type="button"
          onClick={() => onSave(scores, note.trim())}
          className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          Varaqani saqlash
        </button>
      </div>
    </div>
  );
}

/**
 * Kuzatuv rejalashtirish. Ustoz va sinf tanlanganda fan haqiqiy dars
 * yuklamasidan olinadi — kuzatuvchi oʻqitilmaydigan fanni tanlab
 * qoʻymasin.
 */
function ObservationPlanner({
  existing,
  onCreate,
}: {
  existing: Observation[];
  onCreate: (o: Observation) => void;
}) {
  const teachers = allTeachers().filter((t) =>
    TEACHING_ASSIGNMENTS.some((a) => a.teacherId === t.id),
  );
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [pairIndex, setPairIndex] = useState(0);
  const [date, setDate] = useState("2026-10-20");
  const [lessonNo, setLessonNo] = useState(2);

  const pairs = useMemo(
    () => TEACHING_ASSIGNMENTS.filter((a) => a.teacherId === teacherId),
    [teacherId],
  );
  const pair = pairs[pairIndex] ?? pairs[0];

  // Bir oyda bir ustozni ikki marta kuzatish — ish rejasining xatosi.
  const sameMonth = existing.find(
    (o) => o.teacherId === teacherId && o.date.slice(0, 7) === date.slice(0, 7),
  );
  const past = date < TODAY;
  const blocked = !pair || past;

  return (
    <div className="animate-expand rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">Yangi kuzatuv</h2>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Ustoz</span>
          <select
            value={teacherId}
            onChange={(e) => {
              setTeacherId(e.target.value);
              setPairIndex(0);
            }}
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Sinf va fan</span>
          <select
            value={pairIndex}
            onChange={(e) => setPairIndex(Number(e.target.value))}
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
          >
            {pairs.map((a, i) => (
              <option key={`${a.className}-${a.subject}`} value={i}>
                {a.className} · {a.subject}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Sana</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Nechanchi dars</span>
          <input
            type="number"
            min={1}
            max={8}
            value={lessonNo}
            onChange={(e) => setLessonNo(Number(e.target.value))}
            className="focus-ring num h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
          />
        </label>
      </div>

      {past && (
        <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Sana oʻtib ketgan — kuzatuv {TODAY} yoki undan keyin rejalashtiriladi.
        </p>
      )}
      {sameMonth && !past && (
        <p className="mt-3 rounded-lg bg-warning-tint px-3 py-2 text-sm text-foreground">
          Bu ustoz shu oyda allaqachon kuzatilgan ({sameMonth.date}). Rejalashtirish
          mumkin, lekin odatda oyiga bitta kuzatuv yetarli.
        </p>
      )}

      <button
        type="button"
        disabled={blocked}
        onClick={() => {
          if (!pair) return;
          onCreate({
            id: `obs-new-${teacherId}-${date}`,
            teacherId,
            className: pair.className,
            subject: pair.subject,
            date,
            lessonNo,
            observerId: ACADEMIC_HEAD.id,
            status: "rejada",
            scores: null,
            overall: null,
            verdict: null,
            note: "",
            followUp: null,
            recheckAt: null,
          });
        }}
        className="focus-ring mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        Kuzatuvni rejaga qoʻshish
      </button>

      <p className="mt-2 text-xs text-foreground-muted">
        DEMO: reja shu sahifa ochiq turganda saqlanadi — backend ulanganda bazaga
        yoziladi va ustozga bildirishnoma boradi.
      </p>
    </div>
  );
}
