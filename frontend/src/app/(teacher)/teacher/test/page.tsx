"use client";

/**
 * Testlar — ustoz ekrani (TST-01…TST-05).
 *
 * Maʼlumot serverdan (`/api/v1/tests`). Uch bosqich:
 *   Qoralama — savol qoʻshiladi va tahrirlanadi
 *   Faol     — oʻquvchilar ishlaydi, savol OʻZGARMAYDI
 *   Yakunlangan — yangi urinish qabul qilinmaydi
 *
 * Savolni faqat qoralamada qoʻshib boʻladi: bir xil testni ikki
 * oʻquvchi ikki xil koʻrmasligi kerak. Buni server ham tekshiradi —
 * bu yerdagi tugmani yashirish faqat qulaylik (CLAUDE.md 7-qoida).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { QuestionImport } from "@/components/teacher/QuestionImport";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CheckIcon, FlaskIcon, PlusIcon, XIcon } from "@/components/ui/icons";
import { useMyTeaching } from "@/lib/teacher/me";
import {
  QUESTION_KIND_LABELS,
  TEST_STATUS_LABELS,
  TEST_STATUS_TONES,
  addQuestion,
  apiXato,
  archiveQuestion,
  archiveTest,
  createTest,
  fetchQuestions,
  fetchResults,
  fetchTests,
  formatMoment,
  localInputToIso,
  setTestStatus,
  toLocalInput,
  type AttemptOut,
  type QuestionOut,
  type TestOut,
} from "@/lib/teacher/tests-api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50";

export default function TestsPage() {
  const teaching = useMyTeaching();
  const [items, setItems] = useState<TestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchTests());
    } catch (err) {
      setError(apiXato(err, "Testlarni olib boʻlmadi."));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const faol = items?.filter((t) => t.status === "published").length ?? 0;

  return (
    <TeacherShell
      title="Testlar"
      subtitle={
        items === null ? undefined : faol > 0 ? `${faol} ta faol test` : "Faol test yoʻq"
      }
      actions={
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className={primaryBtn}
        >
          <PlusIcon className="h-4 w-4" />
          Yangi test
        </button>
      }
    >
      {creating && (
        <NewTestForm
          slots={teaching.slots}
          onCancel={() => setCreating(false)}
          onCreated={(t) => {
            setCreating(false);
            setOpenId(t.id);
            void load();
          }}
        />
      )}

      {error && <ErrorState description={error} />}

      {items === null ? (
        <ListSkeleton count={3} />
      ) : items.length === 0 && !error ? (
        <EmptyState
          icon={<FlaskIcon className="h-5 w-5" />}
          title="Hali test tuzilmagan"
          description="«Yangi test» tugmasi orqali birinchi testni qoʻshing. Savollarni qoralama holatida kiritasiz, keyin eʼlon qilasiz."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <TestCard
              key={t.id}
              test={t}
              open={openId === t.id}
              onToggle={() => setOpenId(openId === t.id ? null : t.id)}
              onChanged={load}
            />
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}

// ─────────────────────────── Test kartochkasi ───────────────────────────

function TestCard({
  test,
  open,
  onToggle,
  onChanged,
}: {
  test: TestOut;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function status(next: string) {
    setBusy(true);
    setError(null);
    try {
      await setTestStatus(test.id, next);
      onChanged();
    } catch (err) {
      setError(apiXato(err, "Holatni oʻzgartirib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await archiveTest(test.id);
      onChanged();
    } catch (err) {
      setError(apiXato(err, "Arxivlab boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{test.class_name}</Badge>
            <span className="text-xs text-foreground-muted">{test.subject_name}</span>
            <Badge tone={TEST_STATUS_TONES[test.status] ?? "neutral"}>
              {TEST_STATUS_LABELS[test.status] ?? test.status}
            </Badge>
          </div>
          <p className="mt-1.5 font-medium text-foreground">{test.title}</p>
          <p className="num mt-0.5 text-sm text-foreground-muted">
            {formatMoment(test.opens_at)} — {formatMoment(test.closes_at)} ·{" "}
            {test.duration_minutes} daqiqa · {test.attempts_allowed} urinish
          </p>
        </div>

        <button type="button" onClick={onToggle} className={ghostBtn}>
          {open ? "Yopish" : "Savollar"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground-muted">
        <span>
          Savollar: <span className="num text-foreground">{test.question_count}</span>
        </span>
        <span>
          Maksimal ball: <span className="num text-foreground">{test.max_score}</span>
        </span>
        <span>
          Topshirdi:{" "}
          <span className="num text-foreground">
            {test.submitted_count}/{test.total_students}
          </span>
        </span>
        {test.average_percent !== null && (
          <span>
            Oʻrtacha: <span className="num text-foreground">{test.average_percent}%</span>
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {test.status === "draft" && (
          <button
            type="button"
            disabled={busy || test.question_count === 0}
            onClick={() => status("published")}
            title={test.question_count === 0 ? "Avval savol qoʻshing" : undefined}
            className={primaryBtn}
          >
            Eʼlon qilish
          </button>
        )}
        {test.status === "published" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => status("closed")}
              className={ghostBtn}
            >
              Yakunlash
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => status("draft")}
              title="Savollarni tahrirlash uchun qoralamaga qaytariladi"
              className={ghostBtn}
            >
              Qoralamaga qaytarish
            </button>
          </>
        )}
        {test.status === "closed" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => status("published")}
            className={ghostBtn}
          >
            Qayta ochish
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="focus-ring inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-tint disabled:opacity-50"
        >
          Arxivlash
        </button>
      </div>

      {open && <TestDetail test={test} onChanged={onChanged} />}
    </li>
  );
}

// ─────────────────────── Savollar va natijalar ───────────────────────

function TestDetail({ test, onChanged }: { test: TestOut; onChanged: () => void }) {
  const [tab, setTab] = useState<"questions" | "results">("questions");

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div role="tablist" aria-label="Test boʻlimlari" className="mb-3 flex gap-1.5">
        {(["questions", "results"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`focus-ring rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
              tab === id
                ? "border-brand bg-brand-tint text-brand-dark"
                : "border-border text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {id === "questions" ? "Savollar" : "Natijalar"}
          </button>
        ))}
      </div>

      {tab === "questions" ? (
        <QuestionsPanel test={test} onChanged={onChanged} />
      ) : (
        <ResultsPanel testId={test.id} />
      )}
    </div>
  );
}

function QuestionsPanel({ test, onChanged }: { test: TestOut; onChanged: () => void }) {
  const [rows, setRows] = useState<QuestionOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const tahrirlanadi = test.status === "draft";

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchQuestions(test.id));
    } catch (err) {
      setError(apiXato(err, "Savollarni olib boʻlmadi."));
      setRows([]);
    }
  }, [test.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    try {
      await archiveQuestion(id);
      await load();
      onChanged();
    } catch (err) {
      setError(apiXato(err, "Savolni chiqarib boʻlmadi."));
    }
  }

  if (rows === null) return <ListSkeleton count={2} />;

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}

      {!tahrirlanadi && (
        <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
          Eʼlon qilingan testning savollari oʻzgartirilmaydi. Tahrirlash uchun avval
          qoralamaga qaytaring — aks holda bir xil testni ikki oʻquvchi ikki xil koʻrardi.
        </p>
      )}

      {/* TST-06: ommaviy import — bittalab kiritishdan tez. */}
      <QuestionImport
        testId={test.id}
        disabled={!tahrirlanadi}
        onImported={() => {
          void load();
          onChanged();
        }}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-foreground-muted">
          Savol qoʻshilmagan.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((q, i) => (
            <li key={q.id} className="rounded-lg border border-border bg-surface-muted/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium text-foreground">
                  <span className="num text-foreground-muted">{i + 1}.</span> {q.text}
                </p>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="num text-xs text-foreground-muted">{q.points} ball</span>
                  <Badge tone="neutral">{QUESTION_KIND_LABELS[q.kind] ?? q.kind}</Badge>
                  {tahrirlanadi && (
                    <button
                      type="button"
                      onClick={() => remove(q.id)}
                      className="focus-ring rounded px-1.5 py-0.5 text-xs font-medium text-danger hover:underline"
                    >
                      Chiqarish
                    </button>
                  )}
                </span>
              </div>

              <ul className="mt-2 flex flex-col gap-1">
                {q.options.map((o) => (
                  <li
                    key={o.id}
                    className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm ${
                      o.is_correct
                        ? "bg-success-tint text-success"
                        : "text-foreground-muted"
                    }`}
                  >
                    {o.is_correct ? (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XIcon className="h-3.5 w-3.5 shrink-0 opacity-30" />
                    )}
                    {o.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {tahrirlanadi &&
        (adding ? (
          <NewQuestionForm
            testId={test.id}
            onCancel={() => setAdding(false)}
            onAdded={async () => {
              setAdding(false);
              await load();
              onChanged();
            }}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={ghostBtn}>
            <PlusIcon className="h-4 w-4" />
            Savol qoʻshish
          </button>
        ))}
    </div>
  );
}

function ResultsPanel({ testId }: { testId: string }) {
  const [rows, setRows] = useState<AttemptOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchResults(testId)
      .then((r) => alive && setRows(r))
      .catch((err) => alive && setError(apiXato(err, "Natijalarni olib boʻlmadi.")));
    return () => {
      alive = false;
    };
  }, [testId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (rows === null) return <ListSkeleton count={2} />;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-foreground-muted">
        Hali hech kim topshirmagan.
      </p>
    );
  }

  return (
    <div className="scroll-x">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
            <th className="px-2 py-2">Oʻquvchi</th>
            <th className="px-2 py-2">Urinish</th>
            <th className="px-2 py-2">Ball</th>
            <th className="px-2 py-2">Foiz</th>
            <th className="px-2 py-2">Topshirdi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-border last:border-0">
              <td className="px-2 py-2 font-medium text-foreground">{a.full_name}</td>
              <td className="num px-2 py-2 text-foreground-muted">{a.attempt_no}</td>
              <td className="num px-2 py-2 text-foreground-muted">
                {a.score ?? "—"}/{a.max_score}
              </td>
              <td className="num px-2 py-2">
                {a.percent === null ? (
                  <span className="text-foreground-muted">—</span>
                ) : (
                  <span
                    className={
                      a.percent >= 60 ? "font-semibold text-success" : "font-semibold text-danger"
                    }
                  >
                    {a.percent}%
                  </span>
                )}
              </td>
              <td className="num px-2 py-2 text-foreground-muted">
                {a.submitted_at ? formatMoment(a.submitted_at) : "Ishlamoqda"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────── Formalar ───────────────────────────

function NewTestForm({
  slots,
  onCancel,
  onCreated,
}: {
  slots: { classId: string; className: string; subjectId: string; subjectName: string }[];
  onCancel: () => void;
  onCreated: (t: TestOut) => void;
}) {
  const [pick, setPick] = useState(0);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [attempts, setAttempts] = useState(1);
  const [shuffle, setShuffle] = useState(true);
  const [opens, setOpens] = useState(() => toLocalInput(new Date()));
  const [closes, setCloses] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return toLocalInput(d);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slot = slots[pick];
  const valid = slot !== undefined && title.trim().length > 1 && closes > opens;

  const labels = useMemo(
    () => slots.map((s) => `${s.className} · ${s.subjectName}`),
    [slots],
  );

  if (slots.length === 0) {
    return (
      <div className="mb-5 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-foreground-muted">
          Dars jadvalingiz boʻsh — test tuzish uchun avval administrator sizga sinf va fan
          biriktirishi kerak.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      onCreated(
        await createTest({
          class_id: slot.classId,
          subject_id: slot.subjectId,
          title: title.trim(),
          duration_minutes: duration,
          attempts_allowed: attempts,
          shuffle,
          opens_at: localInputToIso(opens),
          closes_at: localInputToIso(closes),
        }),
      );
    } catch (err) {
      setError(apiXato(err, "Testni yaratib boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold">Yangi test</h2>
      <p className="mb-3 text-xs text-foreground-muted">
        Test qoralama holatida yaratiladi — savollarni kiritib, keyin eʼlon qilasiz.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf va fan</span>
          <select
            value={pick}
            onChange={(e) => setPick(Number(e.target.value))}
            className={inputClass}
          >
            {labels.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sarlavha</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 200))}
            placeholder="Masalan: Kvadrat tenglamalar — nazorat testi"
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Ochiladi</span>
          <input
            type="datetime-local"
            value={opens}
            onChange={(e) => setOpens(e.target.value)}
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Yopiladi</span>
          <input
            type="datetime-local"
            value={closes}
            min={opens}
            onChange={(e) => setCloses(e.target.value)}
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Davomiyligi (daqiqa)
          </span>
          <input
            type="number"
            min={1}
            max={300}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={`${inputClass} num`}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Urinishlar soni
          </span>
          <input
            type="number"
            min={1}
            max={10}
            value={attempts}
            onChange={(e) => setAttempts(Number(e.target.value))}
            className={`${inputClass} num`}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={shuffle}
          onChange={(e) => setShuffle(e.target.checked)}
          className="h-4 w-4 rounded border-border text-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        />
        <span className="text-foreground-muted">
          Savollar tasodifiy tartibda chiqsin
        </span>
      </label>

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={!valid || saving} className={primaryBtn}>
          {saving ? "Yaratilmoqda…" : "Testni yaratish"}
        </button>
        <button type="button" onClick={onCancel} className={ghostBtn}>
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

function NewQuestionForm({
  testId,
  onCancel,
  onAdded,
}: {
  testId: string;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("single");
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState([
    { text: "", is_correct: true },
    { text: "", is_correct: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setOption(i: number, patch: Partial<{ text: string; is_correct: boolean }>) {
    setOptions((rows) =>
      rows.map((r, idx) => {
        if (idx !== i) {
          // «Bitta javob» turida boshqa belgilar tushadi.
          return kind === "single" && patch.is_correct ? { ...r, is_correct: false } : r;
        }
        return { ...r, ...patch };
      }),
    );
  }

  const togri = options.filter((o) => o.is_correct).length;
  const valid =
    text.trim().length > 1 &&
    options.length >= 2 &&
    options.every((o) => o.text.trim().length > 0) &&
    togri >= 1 &&
    togri < options.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await addQuestion(testId, {
        text: text.trim(),
        kind,
        points,
        options: options.map((o) => ({ text: o.text.trim(), is_correct: o.is_correct })),
      });
      onAdded();
    } catch (err) {
      setError(apiXato(err, "Savolni qoʻshib boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-brand/30 bg-surface p-3">
      <h3 className="mb-2 text-sm font-semibold">Yangi savol</h3>

      {error && (
        <p className="mb-2 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">{error}</p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        rows={2}
        placeholder="Savol matni"
        className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground-muted">Tur</span>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              // Turga oʻtganda ortiqcha belgilarni tushiramiz.
              if (e.target.value === "single") {
                setOptions((rows) =>
                  rows.map((r, i) => ({ ...r, is_correct: i === rows.findIndex((x) => x.is_correct) })),
                );
              }
            }}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand"
          >
            {Object.entries(QUESTION_KIND_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground-muted">Ball</span>
          <input
            type="number"
            min={1}
            max={20}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="num h-9 w-16 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand"
          />
        </label>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {options.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={o.is_correct}
              aria-label={`${i + 1}-variant toʻgʻri`}
              onClick={() => setOption(i, { is_correct: !o.is_correct })}
              className={`focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                o.is_correct
                  ? "border-success bg-success-tint text-success"
                  : "border-border text-foreground-muted"
              }`}
            >
              <CheckIcon className="h-4 w-4" />
            </button>
            <input
              value={o.text}
              onChange={(e) => setOption(i, { text: e.target.value.slice(0, 500) })}
              placeholder={`${i + 1}-variant`}
              className={inputClass}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions((r) => r.filter((_, idx) => idx !== i))}
                aria-label={`${i + 1}-variantni olib tashlash`}
                className="focus-ring shrink-0 rounded p-1 text-foreground-muted hover:text-danger"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {options.length < 8 && (
        <button
          type="button"
          onClick={() => setOptions((r) => [...r, { text: "", is_correct: false }])}
          className="focus-ring mt-2 text-xs font-medium text-brand-dark hover:underline"
        >
          + Variant qoʻshish
        </button>
      )}

      <p className="mt-2 text-xs text-foreground-muted">
        Kamida bitta toʻgʻri javob belgilansin, lekin hammasi emas — aks holda savolning
        maʼnosi qolmaydi.
      </p>

      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={!valid || saving} className={primaryBtn}>
          {saving ? "Qoʻshilmoqda…" : "Savolni qoʻshish"}
        </button>
        <button type="button" onClick={onCancel} className={ghostBtn}>
          Bekor qilish
        </button>
      </div>
    </form>
  );
}
