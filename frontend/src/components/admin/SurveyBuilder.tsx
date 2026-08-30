"use client";

import { useState } from "react";
import { PlusIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { useActiveClasses, useAdmin, useAdminDispatch } from "@/lib/admin/store";
import { DEFAULT_SURVEY_QUESTIONS } from "@/lib/admin/types";


const PERIODS = [
  "2026 · 1-chorak",
  "2026 · 2-chorak",
  "2027 · 3-chorak",
  "2027 · 4-chorak",
  "2026–2027 · yil yakuni",
];

/**
 * Yangi soʻrovnoma yaratish paneli.
 *
 * Yuboriladigan ota-onalar soni tanlangan sinflardagi faol oʻquvchilar
 * sonidan hisoblanadi — qoʻlda kiritilmaydi, aks holda hisobot notoʻgʻri
 * chiqadi.
 */
export function SurveyBuilder({ onClose }: { onClose: () => void }) {
  const { students } = useAdmin();
  const classes = useActiveClasses();
  const dispatch = useAdminDispatch();

  const [title, setTitle] = useState("Oʻqituvchilar faoliyati — yangi soʻrovnoma");
  const [period, setPeriod] = useState(PERIODS[0]);
  const [audience, setAudience] = useState<"all" | "classes">("all");
  const [classNames, setClassNames] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([...DEFAULT_SURVEY_QUESTIONS]);
  const [newQuestion, setNewQuestion] = useState("");

  const activeStudents = students.filter((s) => s.status === "active");
  const sentCount =
    audience === "all"
      ? activeStudents.length
      : activeStudents.filter((s) => classNames.includes(s.className)).length;

  const problems: string[] = [];
  if (!title.trim()) problems.push("Soʻrovnoma nomini kiriting.");
  if (questions.length === 0) problems.push("Kamida bitta savol boʻlishi kerak.");
  if (audience === "classes" && classNames.length === 0) {
    problems.push("Kamida bitta sinf tanlang.");
  }
  if (sentCount === 0) problems.push("Tanlangan kesimda ota-ona topilmadi.");

  function toggleClass(name: string) {
    setClassNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="flex-1 bg-foreground/20"
      />
      <aside className="animate-expand flex w-full max-w-lg flex-col overflow-y-auto border-l border-border bg-surface shadow-lg sm:w-[520px]">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Yangi soʻrovnoma</h2>
            <p className="text-sm text-foreground-muted">
              Ota-onalarga yuboriladi, natija ustozlar kesimida chiqadi
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (problems.length > 0) return;
            dispatch({
              type: "CREATE_SURVEY",
              survey: {
                title: title.trim(),
                period,
                audience,
                classNames: audience === "classes" ? classNames : [],
                questions: questions.map((text, i) => ({ id: `q-${i + 1}`, text })),
                status: "active",
                sentCount,
              },
            });
            onClose();
          }}
          className="flex flex-1 flex-col gap-4 p-4"
        >
          <Field label="Soʻrovnoma nomi">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Davr">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={inputClass}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Kimga yuboriladi">
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {(
                [
                  ["all", "Barcha ota-onalar"],
                  ["classes", "Tanlangan sinflar"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAudience(value)}
                  aria-pressed={audience === value}
                  className={`focus-ring flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    audience === value
                      ? "bg-brand text-brand-foreground"
                      : "text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {audience === "classes" && (
            <div className="flex flex-wrap gap-1.5">
              {classes.map(({ name }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleClass(name)}
                  aria-pressed={classNames.includes(name)}
                  className={`focus-ring rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    classNames.includes(name)
                      ? "bg-brand text-brand-foreground"
                      : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">
              Savollar (har biri 1–5 ball bilan baholanadi)
            </p>
            <ul className="flex flex-col gap-1.5">
              {questions.map((question, i) => (
                <li
                  key={`${question}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <span className="num shrink-0 text-xs text-foreground-muted">{i + 1}.</span>
                  <input
                    value={question}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((q, index) => (index === i ? e.target.value : q)),
                      )
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    aria-label={`${i + 1}-savol`}
                  />
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => prev.filter((_, index) => index !== i))}
                    aria-label={`${i + 1}-savolni oʻchirish`}
                    className="focus-ring shrink-0 rounded p-1 text-foreground-muted transition-colors hover:text-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex gap-2">
              <input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (newQuestion.trim()) {
                      setQuestions((prev) => [...prev, newQuestion.trim()]);
                      setNewQuestion("");
                    }
                  }
                }}
                placeholder="Yangi savol matni…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newQuestion.trim()) return;
                  setQuestions((prev) => [...prev, newQuestion.trim()]);
                  setNewQuestion("");
                }}
                className="focus-ring flex h-10 shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                <PlusIcon className="h-4 w-4" />
                Qoʻshish
              </button>
            </div>
          </div>

          <p className="rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-dark">
            Yuboriladi: <span className="num font-semibold">{sentCount}</span> nafar ota-onaga ·{" "}
            <span className="num font-semibold">{questions.length}</span> ta savol
          </p>

          {problems.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">
              {problems.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          )}

          <div className="mt-auto flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={problems.length > 0}
              className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              Yaratish va yuborish
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
