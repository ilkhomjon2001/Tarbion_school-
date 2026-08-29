"use client";

import { useEffect, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { DEMO_LESSONS } from "@/lib/teacher/data";
import { classColor } from "@/lib/teacher/schedule";
import { loadCollection, saveCollection } from "@/lib/teacher/store";
import {
  DEMO_TESTS,
  TEST_STATUS_LABELS,
  type QuestionType,
  type TestItem,
  type TestQuestion,
  type TestStatus,
} from "@/lib/teacher/school-data";

/**
 * Testlar (TST-01, TST-02, TST-03, TST-05).
 *
 * Ustoz oʻz faniga test tuzadi: savollar banki, vaqt chegarasi, urinishlar
 * soni. Avtomatik tekshiriladi (TST-04) — ustoz qoʻlda baholamaydi.
 *
 * Ustoz faqat OʻZI oʻqitadigan fan va sinflarni koʻradi.
 */

const MY_SUBJECTS = Array.from(new Set(DEMO_LESSONS.map((l) => l.subject)));
const MY_CLASSES = Array.from(new Set(DEMO_LESSONS.map((l) => l.className)));

const STATUS_TONE: Record<TestStatus, string> = {
  draft: "bg-surface-muted text-foreground-muted",
  published: "bg-success-tint text-success",
  closed: "bg-info-tint text-info",
};

export default function TestsPage() {
  const [tests, setTests] = useState<TestItem[]>(DEMO_TESTS);

  // Xotiradan tiklash — sahifa yangilansa testlar yoʻqolmasin.
  useEffect(() => {
    setTests(loadCollection("tests", DEMO_TESTS));
  }, []);

  function persist(next: TestItem[]) {
    setTests(next);
    saveCollection("tests", next);
  }
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const active = tests.filter((t) => t.status === "published").length;
  const pending = tests.filter((t) => t.status === "draft").length;

  function addTest(t: TestItem) {
    persist([t, ...tests]);
    setCreating(false);
    setOpenId(t.id);
  }

  function addQuestion(testId: string, q: TestQuestion) {
    persist(tests.map((t) => (t.id === testId ? { ...t, questions: [...t.questions, q] } : t)));
  }

  function publish(testId: string) {
    persist(tests.map((t) => (t.id === testId ? { ...t, status: "published" as const } : t)));
  }

  return (
    <TeacherShell
      title="Testlar"
      subtitle={`${active} ta faol · ${pending} ta qoralama`}
      actions={
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yangi test
        </button>
      }
    >
      {creating && <NewTestForm onCreate={addTest} onCancel={() => setCreating(false)} />}

      <ul className="space-y-3">
        {tests.map((test) => {
          const isOpen = openId === test.id;
          const totalPoints = test.questions.reduce((s, q) => s + q.points, 0);

          return (
            <li key={test.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classColor(test.className).block}`}
                      >
                        {test.className}
                      </span>
                      <span className="text-xs text-foreground-muted">{test.subject}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[test.status]}`}
                      >
                        {TEST_STATUS_LABELS[test.status]}
                      </span>
                    </div>
                    <p className="mt-1.5 font-medium">{test.title}</p>
                    <p className="mt-0.5 text-sm text-foreground-muted">
                      {test.questions.length} ta savol · {totalPoints} ball ·{" "}
                      {test.durationMinutes} daqiqa · {test.attempts} urinish
                      {test.shuffle && " · aralashtiriladi"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {test.status === "draft" && test.questions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => publish(test.id)}
                        className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        Eʼlon qilish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : test.id)}
                      aria-expanded={isOpen}
                      className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {isOpen ? "Yopish" : "Savollar"}
                    </button>
                  </div>
                </div>

                {/* TST-05: natijalar */}
                {test.status !== "draft" && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-sm">
                    <span className="text-foreground-muted">
                      Topshirdi:{" "}
                      <span className="font-medium text-foreground">
                        {test.submitted}/{test.totalStudents}
                      </span>
                    </span>
                    {test.averagePercent !== null && (
                      <span className="text-foreground-muted">
                        Oʻrtacha natija:{" "}
                        <span
                          className={`font-medium ${test.averagePercent >= 60 ? "text-success" : "text-danger"}`}
                        >
                          {test.averagePercent}%
                        </span>
                      </span>
                    )}
                    <span className="text-foreground-muted">
                      Muddat: {test.opensAt} – {test.closesAt}
                    </span>
                  </div>
                )}
              </div>

              {isOpen && (
                <QuestionEditor
                  test={test}
                  onAdd={(q) => addQuestion(test.id, q)}
                  readOnly={test.status === "closed"}
                />
              )}
            </li>
          );
        })}
      </ul>
    </TeacherShell>
  );
}

/* ---------- Savollar (TST-01, TST-02) ---------- */

function QuestionEditor({
  test,
  onAdd,
  readOnly,
}: {
  test: TestItem;
  onAdd: (q: TestQuestion) => void;
  readOnly: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="border-t border-border bg-surface-muted/30 p-4">
      {test.questions.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          Hali savol qoʻshilmagan. Test eʼlon qilinishi uchun kamida bitta savol kerak.
        </p>
      ) : (
        <ol className="space-y-3">
          {test.questions.map((q, i) => (
            <li key={q.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  {i + 1}. {q.text}
                </p>
                <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground-muted">
                  {q.points} ball · {q.type === "single" ? "bitta javob" : "bir nechta"}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {q.options.map((opt, j) => {
                  const isCorrect = q.correct.includes(j);
                  return (
                    <li
                      key={j}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        isCorrect ? "bg-success-tint text-success" : "text-foreground-muted"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                          isCorrect ? "border-success bg-success text-brand-foreground" : "border-border"
                        }`}
                      >
                        {isCorrect ? "✓" : ""}
                      </span>
                      {opt}
                      {isCorrect && <span className="sr-only">— toʻgʻri javob</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {!readOnly &&
        (adding ? (
          <NewQuestionForm
            onAdd={(q) => {
              onAdd(q);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Savol qoʻshish
          </button>
        ))}
    </div>
  );
}

function NewQuestionForm({
  onAdd,
  onCancel,
}: {
  onAdd: (q: TestQuestion) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("single");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState<number[]>([]);
  const [points, setPoints] = useState(1);

  const filled = options.filter((o) => o.trim()).length;
  const valid = text.trim().length > 3 && filled >= 2 && correct.length > 0;

  function toggleCorrect(i: number) {
    setCorrect((prev) =>
      type === "single" ? [i] : prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const kept = options.map((o, i) => ({ o, i })).filter((x) => x.o.trim());
    onAdd({
      id: `q-${Date.now()}`,
      text: text.trim(),
      type,
      options: kept.map((x) => x.o.trim()),
      correct: kept
        .map((x, newIndex) => (correct.includes(x.i) ? newIndex : -1))
        .filter((x) => x >= 0),
      points,
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg border border-border bg-surface p-3">
      <label htmlFor="q-text" className="mb-1.5 block text-sm font-medium">
        Savol matni
      </label>
      <textarea
        id="q-text"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Savolni yozing…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
      />

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q-type" className="mb-1.5 block text-sm font-medium">
            Savol turi
          </label>
          <select
            id="q-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as QuestionType);
              setCorrect([]);
            }}
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <option value="single">Bitta toʻgʻri javob</option>
            <option value="multiple">Bir nechta toʻgʻri javob</option>
          </select>
        </div>
        <div>
          <label htmlFor="q-points" className="mb-1.5 block text-sm font-medium">
            Ball
          </label>
          <input
            id="q-points"
            type="number"
            min={1}
            max={10}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value) || 1)}
            className="h-10 w-20 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-medium">
          Javob variantlari — toʻgʻrisini belgilang
        </legend>
        <ul className="space-y-2">
          {options.map((opt, i) => (
            <li key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(i)}
                aria-pressed={correct.includes(i)}
                aria-label={`${i + 1}-variantni toʻgʻri deb belgilash`}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  correct.includes(i)
                    ? "border-success bg-success text-brand-foreground"
                    : "border-border text-foreground-muted hover:border-success"
                }`}
              >
                {correct.includes(i) ? "✓" : String.fromCharCode(65 + i)}
              </button>
              <input
                value={opt}
                onChange={(e) =>
                  setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                }
                placeholder={`${String.fromCharCode(65 + i)} variant`}
                aria-label={`${i + 1}-variant matni`}
                className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          Savolni qoʻshish
        </button>
      </div>
    </form>
  );
}

/* ---------- Yangi test (TST-03) ---------- */

function NewTestForm({
  onCreate,
  onCancel,
}: {
  onCreate: (t: TestItem) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(MY_SUBJECTS[0]);
  const [className, setClassName] = useState(MY_CLASSES[0]);
  const [duration, setDuration] = useState(30);
  const [attempts, setAttempts] = useState(1);
  const [shuffle, setShuffle] = useState(true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) return;
    onCreate({
      id: `t-${Date.now()}`,
      title: title.trim(),
      subject,
      className,
      status: "draft",
      durationMinutes: duration,
      attempts,
      shuffle,
      opensAt: "—",
      closesAt: "—",
      questions: [],
      submitted: 0,
      totalStudents: 0,
      averagePercent: null,
    });
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Yangi test</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="t-title" className="mb-1.5 block text-sm font-medium">
            Test nomi
          </label>
          <input
            id="t-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Masalan: Kvadrat tenglamalar — nazorat testi"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>

        <div>
          <label htmlFor="t-subject" className="mb-1.5 block text-sm font-medium">Fan</label>
          <select
            id="t-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            {MY_SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="t-class" className="mb-1.5 block text-sm font-medium">Sinf</label>
          <select
            id="t-class"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            {MY_CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="t-dur" className="mb-1.5 block text-sm font-medium">
            Vaqt (daqiqa)
          </label>
          <input
            id="t-dur"
            type="number"
            min={5}
            max={120}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 30)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>

        <div>
          <label htmlFor="t-att" className="mb-1.5 block text-sm font-medium">
            Urinishlar soni
          </label>
          <input
            id="t-att"
            type="number"
            min={1}
            max={5}
            value={attempts}
            onChange={(e) => setAttempts(Number(e.target.value) || 1)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[var(--color-brand)]"
            />
            Savollarni har oʻquvchiga tasodifiy tartibda koʻrsatish
          </label>
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
        Test qoralama sifatida saqlanadi. Savollar qoʻshilgandan keyin
        «Eʼlon qilish» tugmasi orqali oʻquvchilarga ochiladi. Javoblar
        avtomatik tekshiriladi.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={title.trim().length < 3}
          className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          Testni yaratish
        </button>
      </div>
    </form>
  );
}
