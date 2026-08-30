"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PlusIcon } from "@/components/ui/icons";
import { SurveyBuilder } from "@/components/admin/SurveyBuilder";
import { downloadCsv } from "@/lib/csv";
import { buildSurveyResults, useAdmin, useAdminDispatch } from "@/lib/admin/store";
import { SURVEY_STATUS_LABELS, type TeacherSurveyResult } from "@/lib/admin/types";
import { homeroomClassOf, staffById } from "@/lib/school/staff";

const ATTENTION_THRESHOLD = 3.5;

type Tab = "active" | "results";

/**
 * Ustozlar reytingi — ikkita manba bitta joyda:
 *   1) ota-onalarga yuborilgan soʻrovnoma javoblari,
 *   2) administrator suhbatdan keyin qoʻlda kiritgan qaydlar.
 * Ikkinchisi do'kondan olinadi, shuning uchun murojaatlar boʻlimida
 * saqlangan qayd shu yerda darhol koʻrinadi.
 */
export function SurveyBoard() {
  const { notes, surveys } = useAdmin();
  const dispatch = useAdminDispatch();
  const results = useMemo(() => buildSurveyResults(), []);
  const [tab, setTab] = useState<Tab>("results");
  const [openId, setOpenId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  // Reyting hozircha faol soʻrovnomalarning eng soʻnggisi boʻyicha.
  const current = surveys.find((s) => s.status === "active") ?? surveys[0];
  const answeredPercent = current?.sentCount
    ? Math.round((current.answeredCount / current.sentCount) * 100)
    : 0;

  function exportResults() {
    const rows: (string | number)[][] = [
      ["Oʻqituvchi", "Fanlar", "Sinf rahbari", "Oʻrtacha", "Javoblar", ...results[0].criteria.map((c) => c.label)],
    ];
    for (const result of results) {
      const teacher = staffById(result.teacherId);
      if (!teacher) continue;
      rows.push([
        teacher.fullName,
        teacher.subjects.join(", "),
        homeroomClassOf(teacher.id) ?? "—",
        result.average.toFixed(1),
        result.responseCount,
        ...result.criteria.map((c) => c.score.toFixed(1)),
      ]);
    }
    downloadCsv("tarbion-oqituvchilar-reytingi", rows);
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Soʻrovnomalar</h1>
          <p className="text-sm text-foreground-muted">
            Ota-onalar soʻrovnomasi va administrator qaydlari asosida ustozlar reytingi
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBuilding(true)}
          className="focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Yangi soʻrovnoma yaratish
        </button>
      </div>

      <div role="tablist" aria-label="Soʻrovnoma boʻlimlari" className="flex gap-1 border-b border-border">
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          Soʻrovnomalar ({surveys.length})
        </TabButton>
        <TabButton active={tab === "results"} onClick={() => setTab("results")}>
          Natijalar
        </TabButton>
      </div>

      {tab === "active" ? (
        <ul className="flex flex-col gap-3">
          {surveys.map((survey) => {
            const percent = survey.sentCount
              ? Math.round((survey.answeredCount / survey.sentCount) * 100)
              : 0;
            return (
              <li
                key={survey.id}
                className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{survey.title}</p>
                    <p className="mt-0.5 text-xs text-foreground-muted">
                      {survey.period} ·{" "}
                      {survey.audience === "all"
                        ? "Barcha ota-onalar"
                        : `${survey.classNames.length} ta sinf: ${survey.classNames.join(", ")}`}{" "}
                      · <span className="num">{survey.questions.length}</span> ta savol
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={survey.status === "active" ? "success" : "neutral"}>
                      {SURVEY_STATUS_LABELS[survey.status]}
                    </Badge>
                    {survey.status === "active" && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "CLOSE_SURVEY", surveyId: survey.id })}
                        className="focus-ring rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:border-danger hover:text-danger"
                      >
                        Yopish
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs text-foreground-muted">
                    Yubordi:{" "}
                    <span className="num font-medium text-foreground">{survey.sentCount}</span> ta ·
                    Javob berdi:{" "}
                    <span className="num font-medium text-foreground">{survey.answeredCount}</span>{" "}
                    ta (<span className="num">{percent}%</span>)
                  </p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="bar-fill h-full rounded-full bg-brand"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {survey.questions.map((q) => (
                    <li
                      key={q.id}
                      className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-foreground-muted"
                    >
                      {q.text}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-[11px] text-foreground-muted">
                  Yaratdi: {survey.createdBy} · {survey.createdAt}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <span className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground">
              {current?.period ?? "—"}
            </span>
            <div className="min-w-[180px] flex-1">
              <p className="text-xs text-foreground-muted">
                Yubordi:{" "}
                <span className="num font-medium text-foreground">{current?.sentCount ?? 0}</span>{" "}
                ta · Javob berdi:{" "}
                <span className="num font-medium text-foreground">
                  {current?.answeredCount ?? 0}
                </span>{" "}
                ta (<span className="num">{answeredPercent}%</span>)
              </p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="bar-fill h-full rounded-full bg-brand"
                  style={{ width: `${answeredPercent}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={exportResults}
              className="focus-ring rounded-lg border border-brand px-3.5 py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-tint"
            >
              Natijani yuklab olish (CSV)
            </button>
          </div>

          <ul className="flex flex-col gap-3">
            {results.map((result) => (
              <li key={result.teacherId}>
                <TeacherCard
                  result={result}
                  open={openId === result.teacherId}
                  onToggle={() =>
                    setOpenId(openId === result.teacherId ? null : result.teacherId)
                  }
                  adminNotes={notes.filter((n) => n.teacherId === result.teacherId)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {building && <SurveyBuilder onClose={() => setBuilding(false)} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-brand text-brand-dark"
          : "border-transparent text-foreground-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function TeacherCard({
  result,
  open,
  onToggle,
  adminNotes,
}: {
  result: TeacherSurveyResult;
  open: boolean;
  onToggle: () => void;
  adminNotes: { id: string; summary: string; comment?: string; rating?: number; date: string; authorName: string }[];
}) {
  const teacher = staffById(result.teacherId);
  if (!teacher) return null;

  const homeroom = homeroomClassOf(teacher.id);
  const attention = result.average < ATTENTION_THRESHOLD;
  const maxBar = Math.max(...Object.values(result.distribution), 1);

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-surface shadow-sm transition-colors ${
        attention ? "border-l-4 border-l-danger border-border" : "border-border"
      } ${open ? "ring-1 ring-brand/40" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="focus-ring-inset flex w-full flex-wrap items-center gap-4 p-4 text-left transition-colors hover:bg-surface-muted/50"
      >
        <span className="flex min-w-[200px] flex-1 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-dark">
            {teacher.initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {teacher.fullName}
            </span>
            <span className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone="neutral">{teacher.subjects[0]}</Badge>
              {homeroom && <Badge tone="brand">{homeroom} sinf rahbari</Badge>}
              {attention && <Badge tone="danger">Eʼtibor talab qiladi</Badge>}
            </span>
          </span>
        </span>

        {/* Baholar taqsimoti */}
        <span className="hidden min-w-[220px] flex-1 flex-col gap-1 sm:flex">
          {[5, 4, 3].map((score) => (
            <span key={score} className="flex items-center gap-2">
              <span className="num w-3 shrink-0 text-right text-[11px] text-foreground-muted">
                {score}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <span
                  className={`bar-fill block h-full rounded-full ${
                    score === 5 ? "bg-brand" : score === 4 ? "bg-brand/50" : "bg-foreground-muted/40"
                  }`}
                  style={{ width: `${((result.distribution[score] ?? 0) / maxBar) * 100}%` }}
                />
              </span>
              <span className="num w-6 shrink-0 text-right text-[11px] text-foreground-muted">
                {result.distribution[score] ?? 0}
              </span>
            </span>
          ))}
        </span>

        <span className="shrink-0 text-right">
          <span
            className={`num block text-2xl font-bold ${attention ? "text-danger" : "text-brand"}`}
          >
            {result.average.toFixed(1)}
          </span>
          <span className="num block text-xs text-foreground-muted">
            {result.responseCount} ta javob
          </span>
        </span>
      </button>

      {open && (
        <div className="animate-expand grid grid-cols-1 gap-3 border-t border-border bg-surface-muted/30 p-4 lg:grid-cols-3">
          <Panel title="Mezonlar boʻyicha tahlil">
            <ul className="flex flex-col gap-2.5">
              {result.criteria.map((criterion) => (
                <li key={criterion.label}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-foreground">{criterion.label}</span>
                    <span
                      className={`num text-sm font-semibold ${
                        criterion.score < ATTENTION_THRESHOLD ? "text-danger" : "text-foreground"
                      }`}
                    >
                      {criterion.score.toFixed(1)}
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className={`bar-fill block h-full rounded-full ${
                        criterion.score < ATTENTION_THRESHOLD ? "bg-danger" : "bg-success"
                      }`}
                      style={{ width: `${(criterion.score / 5) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Ota-onalar fikri">
            <ul className="flex flex-col gap-2">
              {result.comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <p className="text-sm italic text-foreground">“{comment.text}”</p>
                  <p className="mt-1 text-xs font-medium text-brand-dark">
                    {comment.className} sinf ota-onasi
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-foreground-muted">
              Fikrlar anonim — faqat sinf koʻrsatiladi.
            </p>
          </Panel>

          <Panel title="Administrator qaydlari">
            {adminNotes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-foreground-muted">
                Bu ustoz boʻyicha qayd yoʻq. Murojaatlar boʻlimida suhbat qaydnomasini
                toʻldirsangiz — shu yerda chiqadi.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {adminNotes.map((note) => (
                  <li key={note.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <p className="text-sm text-foreground">{note.comment || note.summary}</p>
                    <p className="mt-1 flex items-center justify-between gap-2 text-xs text-foreground-muted">
                      <span>{note.authorName}</span>
                      <span className="num">
                        {note.rating ? `${note.rating}/5 · ` : ""}
                        {note.date}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <h3 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}
