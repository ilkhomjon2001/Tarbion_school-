"use client";

import { useMemo, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { AppealThread } from "@/components/shared/AppealThread";
import { useChild } from "@/lib/parent/useChild";
import {
  APPEAL_TARGET_LABELS,
  APPEALS,
  CURRENT_PARENT,
  type Appeal,
  type AppealTarget,
} from "@/lib/school/appeals";
import { DIRECTOR, homeroomTeacherOf, subjectTeachersOf } from "@/lib/school/staff";

/**
 * Murojaatlar (OTA-07, MUR-01…MUR-06).
 *
 * Loyiha egasining soʻroviga koʻra ota-ona MAVZUNI emas, KIMGA yozishini
 * tanlaydi: rahbariyat / sinf rahbari / fan oʻqituvchisi. Fan oʻqituvchisi
 * tanlansa — qaysi fan ekani ham soʻraladi.
 *
 * Har bir murojaat ochiq yozishma (chat) shaklida davom etadi —
 * `AppealThread` komponenti ustoz va rahbariyat kabinetida ham ishlatiladi.
 */
export default function ParentAppealsPage() {
  const [child, setChild] = useChild();
  const [appeals, setAppeals] = useState<Appeal[]>(APPEALS);
  const [showForm, setShowForm] = useState(false);

  const myAppeals = useMemo(
    () =>
      appeals.filter((a) => a.parentName === CURRENT_PARENT && a.className === child.className),
    [appeals, child.className],
  );

  function addAppeal(appeal: Appeal) {
    setAppeals((prev) => [appeal, ...prev]);
    setShowForm(false);
  }

  return (
    <ParentShell title="Murojaat" child={child} onChildChange={setChild}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          Kimga murojaat qilmoqchi ekaningizni tanlang — yozishma ochiq qoladi.
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="h-10 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {showForm ? "Yopish" : "Yangi murojaat"}
        </button>
      </div>

      {showForm && (
        <NewAppealForm
          className={child.className}
          studentFullName={child.fullName}
          onSubmit={addAppeal}
        />
      )}

      {myAppeals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Murojaatlar yoʻq</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Savolingiz boʻlsa, «Yangi murojaat» tugmasini bosing.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {myAppeals.map((appeal) => (
            <li key={appeal.id}>
              <AppealThread appeal={appeal} viewer="parent" />
            </li>
          ))}
        </ul>
      )}
    </ParentShell>
  );
}

const TARGETS: AppealTarget[] = ["rahbariyat", "sinf_rahbari", "fan_oqituvchisi"];

function NewAppealForm({
  className,
  studentFullName,
  onSubmit,
}: {
  className: string;
  studentFullName: string;
  onSubmit: (appeal: Appeal) => void;
}) {
  const [target, setTarget] = useState<AppealTarget>("sinf_rahbari");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const subjectTeachers = subjectTeachersOf(className);
  const homeroom = homeroomTeacherOf(className);

  // Kimga ketishi — tanlovga qarab aniqlanadi.
  const assignee =
    target === "rahbariyat"
      ? DIRECTOR
      : target === "sinf_rahbari"
        ? homeroom
        : (subjectTeachers.find((s) => s.subject === subject)?.teacher ?? null);

  const needsSubject = target === "fan_oqituvchisi";
  const canSubmit = Boolean(title.trim() && text.trim() && assignee && (!needsSubject || subject));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !assignee) return;
    onSubmit({
      id: `ap-new-${Date.now()}`,
      target,
      assigneeId: assignee.id,
      subject: needsSubject ? subject : undefined,
      className,
      studentFullName,
      parentName: CURRENT_PARENT,
      title: title.trim(),
      status: "new",
      createdAt: "Hozir",
      dueAt: "3 ish kuni ichida",
      messages: [
        {
          id: `ap-new-${Date.now()}-m1`,
          author: "parent",
          text: text.trim(),
          createdAt: "Hozir",
        },
      ],
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Kimga murojaat qilasiz?</legend>
        <div className="flex flex-wrap gap-2">
          {TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTarget(t);
                setSubject("");
              }}
              aria-pressed={target === t}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                target === t
                  ? "bg-brand text-brand-foreground"
                  : "border border-border text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {APPEAL_TARGET_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>

      {needsSubject && (
        <div>
          <label htmlFor="appeal-subject" className="mb-1 block text-sm font-medium text-foreground">
            Qaysi fan?
          </label>
          <select
            id="appeal-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <option value="">Fanni tanlang…</option>
            {subjectTeachers.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject} — {s.teacher.fullName}
              </option>
            ))}
          </select>
        </div>
      )}

      {assignee && (
        <p className="rounded-lg bg-brand-tint px-3 py-2 text-xs text-brand-dark">
          Murojaat <span className="font-medium">{assignee.fullName}</span>ga yuboriladi.
        </p>
      )}
      {!assignee && !needsSubject && (
        <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
          Bu sinf uchun masʼul xodim biriktirilmagan — rahbariyatga yozing.
        </p>
      )}

      <div>
        <label htmlFor="appeal-title" className="mb-1 block text-sm font-medium text-foreground">
          Mavzu
        </label>
        <input
          id="appeal-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Qisqacha sarlavha"
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        />
      </div>

      <div>
        <label htmlFor="appeal-text" className="mb-1 block text-sm font-medium text-foreground">
          Xabar
        </label>
        <textarea
          id="appeal-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Savolingiz yoki taklifingizni yozing"
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="h-10 rounded-lg bg-brand text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        Murojaatni yuborish
      </button>
    </form>
  );
}
