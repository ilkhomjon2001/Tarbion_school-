"use client";

/**
 * Test yechish — BAZADAN (TST-04).
 *
 * Eski `TestRunner` dan farqi: savollar URINISH BOSHLANGANDA serverdan
 * keladi (toʻgʻri javobsiz — `QuestionForStudentOut`) va natijani ham
 * server hisoblaydi. Frontend hech narsani tekshirmaydi — aks holda
 * toʻgʻri javoblar brauzerga sizib chiqardi.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { messageOf } from "@/components/shared/LiveSession";
import type { AttemptOut, AttemptStartOut } from "@/lib/api/types.gen";
import {
  startTest,
  submitTestAttempt,
  type StudentTestRow,
} from "@/lib/student/api";

type Answers = Record<string, string[]>;

export function LiveTestRunner({
  test,
  studentId,
}: {
  test: StudentTestRow;
  studentId: string;
}) {
  const [attempt, setAttempt] = useState<AttemptStartOut | null>(null);
  const [result, setResult] = useState<AttemptOut | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const attemptsLeft = test.attemptsAllowed - test.attemptsUsed;

  function toggleOption(questionId: string, optionId: string, kind: string) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (kind === "single") return { ...prev, [questionId]: [optionId] };
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
  }

  async function begin() {
    setBusy(true);
    setError("");
    try {
      setAttempt(await startTest(test.id, studentId));
      setAnswers({});
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (!attempt || busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(
        await submitTestAttempt(
          attempt.attempt_id,
          attempt.questions.map((q) => ({
            question_id: q.id,
            selected: answers[q.id] ?? [],
          })),
        ),
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const percent = result.percent != null ? Math.round(result.percent) : 0;
    return (
      <Card className="flex flex-col items-center gap-2 text-center">
        <p className="num text-3xl font-bold text-brand-dark">{percent}%</p>
        <p className="text-sm text-foreground-muted">
          {result.score ?? 0} / {result.max_score} ball
        </p>
        <Badge tone="neutral">
          {result.attempt_no}-urinish · {test.attemptsAllowed} tadan
        </Badge>
      </Card>
    );
  }

  if (!attempt) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 text-xs text-foreground-muted">
          <Badge tone="neutral">{test.durationMinutes} daqiqa</Badge>
          <Badge tone="neutral">{test.questionCount} savol</Badge>
          <Badge tone="neutral">
            Urinish: {test.attemptsUsed}/{test.attemptsAllowed}
          </Badge>
        </div>
        {test.description ? (
          <p className="text-sm text-foreground-muted">{test.description}</p>
        ) : null}
        {test.lastPercent !== null ? (
          <p className="text-sm text-foreground-muted">
            Oxirgi natija:{" "}
            <span className="num font-semibold text-brand-dark">{test.lastPercent}%</span>
          </p>
        ) : null}
        {error && (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {attemptsLeft > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void begin()}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Boshlanmoqda…" : `Testni boshlash (${attemptsLeft} urinish qoldi)`}
          </button>
        ) : (
          <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-foreground-muted">
            Urinishlar soni tugagan.
          </p>
        )}
      </Card>
    );
  }

  const answeredCount = attempt.questions.filter(
    (q) => (answers[q.id] ?? []).length > 0,
  ).length;

  return (
    <form onSubmit={(e) => void finish(e)} className="flex flex-col gap-4">
      {attempt.questions.map((question, index) => (
        <Card key={question.id}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {index + 1}. {question.text}
            </p>
            <Badge tone="neutral">{question.points} ball</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {question.options.map((option) => {
              const selected = (answers[question.id] ?? []).includes(option.id);
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
                    type={question.kind === "single" ? "radio" : "checkbox"}
                    name={question.id}
                    checked={selected}
                    onChange={() => toggleOption(question.id, option.id, question.kind)}
                    className="accent-[color:var(--color-brand)]"
                  />
                  {option.text}
                </label>
              );
            })}
          </div>
        </Card>
      ))}

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Yuborilmoqda…"
          : `Yakunlash (${answeredCount}/${attempt.questions.length} javob berildi)`}
      </button>
    </form>
  );
}
