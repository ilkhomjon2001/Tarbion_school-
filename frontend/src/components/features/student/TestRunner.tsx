"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { TestAttemptResult, TestItem } from "@/lib/types";

function scoreAnswers(
  test: TestItem,
  answers: Record<string, string[]>,
): TestAttemptResult {
  let correctCount = 0;
  for (const question of test.questions) {
    const selected = new Set(answers[question.id] ?? []);
    const correct = new Set(question.correctOptionIds);
    const isCorrect =
      selected.size === correct.size &&
      [...selected].every((id) => correct.has(id));
    if (isCorrect) correctCount += 1;
  }
  const score = Math.round((correctCount / test.questions.length) * 100);
  return {
    score,
    totalQuestions: test.questions.length,
    correctCount,
    passed: score >= test.passScore,
  };
}

export function TestRunner({ test }: { test: TestItem }) {
  const attemptsLeft = test.attemptsAllowed - test.attemptsUsed;
  const [phase, setPhase] = useState<"intro" | "running" | "result">("intro");
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<TestAttemptResult | null>(null);

  function toggleOption(questionId: string, optionId: string, type: "single" | "multiple") {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (type === "single") {
        return { ...prev, [questionId]: [optionId] };
      }
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
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
    const answeredCount = Object.keys(answers).filter(
      (id) => (answers[id]?.length ?? 0) > 0,
    ).length;

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
            <p className="mb-3 text-sm font-medium text-foreground">
              {index + 1}. {question.text}
            </p>
            <div className="flex flex-col gap-2">
              {question.options.map((option) => {
                const selected = (answers[question.id] ?? []).includes(
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
                        toggleOption(question.id, option.id, question.type)
                      }
                      className="accent-[color:var(--color-brand)]"
                    />
                    {option.text}
                  </label>
                );
              })}
            </div>
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
        className={`text-3xl font-bold ${result.passed ? "text-success" : "text-danger"}`}
      >
        {result.score}%
      </p>
      <p className="text-sm text-foreground-muted">
        {result.correctCount} / {result.totalQuestions} toʻgʻri javob
      </p>
      <Badge tone={result.passed ? "success" : "danger"}>
        {result.passed ? "Oʻtdingiz" : "Oʻta olmadingiz"}
      </Badge>
    </Card>
  );
}
