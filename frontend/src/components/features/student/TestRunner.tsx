"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { TestAttemptResult, TestItem, TestQuestion } from "@/lib/types";

type AnswerValue = string[] | Record<string, string> | string;
type Answers = Record<string, AnswerValue>;

function isAnswered(question: TestQuestion, value: AnswerValue | undefined): boolean {
  if (question.type === "matching") {
    const record = (value as Record<string, string>) ?? {};
    return question.options.every((opt) => Boolean(record[opt.id]));
  }
  if (question.type === "open") {
    return typeof value === "string" && value.trim().length > 0;
  }
  return Array.isArray(value) && value.length > 0;
}

function scoreAnswers(test: TestItem, answers: Answers): TestAttemptResult {
  let correctCount = 0;
  let autoGradableCount = 0;
  let pendingReviewCount = 0;

  for (const question of test.questions) {
    if (question.type === "open") {
      pendingReviewCount += 1;
      continue;
    }
    autoGradableCount += 1;

    if (question.type === "matching") {
      const selected = (answers[question.id] as Record<string, string>) ?? {};
      const correct = question.correctMatches ?? {};
      const keys = Object.keys(correct);
      const isCorrect = keys.length > 0 && keys.every((key) => selected[key] === correct[key]);
      if (isCorrect) correctCount += 1;
    } else {
      const selected = new Set((answers[question.id] as string[]) ?? []);
      const correct = new Set(question.correctOptionIds);
      const isCorrect =
        selected.size === correct.size && [...selected].every((id) => correct.has(id));
      if (isCorrect) correctCount += 1;
    }
  }

  const score = autoGradableCount > 0 ? Math.round((correctCount / autoGradableCount) * 100) : 0;
  return {
    score,
    totalQuestions: test.questions.length,
    correctCount,
    passed: score >= test.passScore,
    pendingReviewCount,
  };
}

export function TestRunner({ test }: { test: TestItem }) {
  const attemptsLeft = test.attemptsAllowed - test.attemptsUsed;
  const [phase, setPhase] = useState<"intro" | "running" | "result">("intro");
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<TestAttemptResult | null>(null);

  function toggleOption(questionId: string, optionId: string, type: "single" | "multiple") {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) ?? [];
      if (type === "single") {
        return { ...prev, [questionId]: [optionId] };
      }
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
  }

  function setMatch(questionId: string, optionId: string, targetId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...((prev[questionId] as Record<string, string>) ?? {}), [optionId]: targetId },
    }));
  }

  function setOpenAnswer(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  }

  if (phase === "intro") {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 text-xs text-foreground-muted">
          <Badge tone="neutral">{test.durationMinutes} daqiqa</Badge>
          <Badge tone="neutral">{test.questions.length} savol</Badge>
          <Badge tone="neutral">Oʻtish balli: {test.passScore}%</Badge>
        </div>
        {test.lastScore !== undefined ? (
          <p className="text-sm text-foreground-muted">
            Oxirgi natija:{" "}
            <span
              className={
                test.lastScore >= test.passScore
                  ? "font-semibold text-success"
                  : "font-semibold text-danger"
              }
            >
              {test.lastScore}%
            </span>
          </p>
        ) : null}
        {attemptsLeft > 0 ? (
          <button
            type="button"
            onClick={() => setPhase("running")}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Testni boshlash ({attemptsLeft} urinish qoldi)
          </button>
        ) : (
          <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-foreground-muted">
            Urinishlar soni tugagan.
          </p>
        )}
      </Card>
    );
  }

  if (phase === "running") {
    const answeredCount = test.questions.filter((q) => isAnswered(q, answers[q.id])).length;

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setResult(scoreAnswers(test, answers));
          setPhase("result");
        }}
        className="flex flex-col gap-4"
      >
        {test.questions.map((question, index) => (
          <Card key={question.id}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {question.text}
              </p>
              {question.type === "open" ? (
                <Badge tone="neutral">Ustoz tekshiradi</Badge>
              ) : null}
            </div>

            {(question.type === "single" || question.type === "multiple") && (
              <div className="flex flex-col gap-2">
                {question.options.map((option) => {
                  const selected = ((answers[question.id] as string[]) ?? []).includes(
                    option.id,
                  );
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selected
                          ? "border-brand bg-brand-tint text-brand-dark"
                          : "border-border text-foreground hover:bg-surface-muted"
                      }`}
                    >
                      <input
                        type={question.type === "single" ? "radio" : "checkbox"}
                        name={question.id}
                        checked={selected}
                        onChange={() =>
                          toggleOption(question.id, option.id, question.type as "single" | "multiple")
                        }
                        className="accent-[color:var(--color-brand)]"
                      />
                      {option.text}
                    </label>
                  );
                })}
              </div>
            )}

            {question.type === "matching" && (
              <div className="flex flex-col gap-2">
                {question.options.map((option) => (
                  <div key={option.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {option.text}
                    </span>
                    <select
                      value={((answers[question.id] as Record<string, string>) ?? {})[option.id] ?? ""}
                      onChange={(event) => setMatch(question.id, option.id, event.target.value)}
                      aria-label={`"${option.text}" uchun moslashtirish`}
                      className="h-9 shrink-0 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                    >
                      <option value="" disabled>
                        Tanlang
                      </option>
                      {question.matchTargets?.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.text}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {question.type === "open" && (
              <textarea
                value={(answers[question.id] as string) ?? ""}
                onChange={(event) => setOpenAnswer(question.id, event.target.value)}
                rows={3}
                placeholder="Javobingizni yozing..."
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
              />
            )}
          </Card>
        ))}

        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Yakunlash ({answeredCount}/{test.questions.length} javob berildi)
        </button>
      </form>
    );
  }

  if (!result) return null;

  return (
    <Card className="flex flex-col items-center gap-2 text-center">
      <p
        className={`text-3xl font-bold num ${result.passed ? "text-success" : "text-danger"}`}
      >
        {result.score}%
      </p>
      <p className="text-sm text-foreground-muted">
        {result.correctCount} / {result.totalQuestions - result.pendingReviewCount} toʻgʻri javob
      </p>
      <Badge tone={result.passed ? "success" : "danger"}>
        {result.passed ? "Oʻtdingiz" : "Oʻta olmadingiz"}
      </Badge>
      {result.pendingReviewCount > 0 ? (
        <p className="text-sm text-foreground-muted">
          {result.pendingReviewCount} ta ochiq savol ustoz tomonidan tekshiriladi, yakuniy ball
          keyinroq yangilanishi mumkin.
        </p>
      ) : null}
    </Card>
  );
}
