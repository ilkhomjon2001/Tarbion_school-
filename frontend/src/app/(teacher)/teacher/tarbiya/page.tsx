"use client";

import { useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { useMyTeaching, useTeacherMe } from "@/lib/teacher/me";
import { fetchStudents } from "@/lib/school/api";
import { HOMEROOM, staffById } from "@/lib/school/staff";
import {
  authorRoleLabel,
  TONE_LABELS,
  WELLBEING_NOTES,
  type WellbeingNote,
  type WellbeingTone,
} from "@/lib/school/wellbeing";

const TONES: WellbeingTone[] = ["positive", "neutral", "attention"];

const TONE_CLASSES: Record<WellbeingTone, string> = {
  positive: "border-l-success bg-success-tint/40",
  neutral: "border-l-info bg-info-tint/40",
  attention: "border-l-warning bg-warning-tint/40",
};

/**
 * Tarbiyaviy izoh kiritish.
 *
 * TZ'da bu boʻlim yoʻq — loyiha egasining soʻrovi (docs/DECISIONS.md).
 * Izohni SINF RAHBARI va FAN OʻQITUVCHISI kiritadi; psixologik xulosani
 * faqat maktab psixologi yozadi, shuning uchun bu sahifada u yoʻq.
 *
 * DEMO: yozuv faqat sahifa holatida saqlanadi.
 */
export default function TeacherWellbeingPage() {
  const me = useTeacherMe();
  const teaching = useMyTeaching();
  const classes = useMemo(() => teaching.classes.map((c) => c.name), [teaching.classes]);
  const [notes, setNotes] = useState<WellbeingNote[]>(
    WELLBEING_NOTES.filter((n) => n.kind === "behavior"),
  );
  const [className, setClassName] = useState(classes[0] ?? "");
  const [studentId, setStudentId] = useState("");
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>([]);
  const [tone, setTone] = useState<WellbeingTone>("neutral");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  const subjects = useMemo(
    () =>
      teaching.slots.filter((s) => s.className === className).map((s) => s.subjectName),
    [teaching.slots, className],
  );
  const asHomeroom = me.isHomeroom;

  // Sinf oʻquvchilari serverdan. Kesim SOʻROV darajasida: ustoz oʻz
  // sinfidan boshqasini soʻrasa server boʻsh roʻyxat qaytaradi (X-1).
  const classId = teaching.classes.find((c) => c.name === className)?.id;
  useEffect(() => {
    if (!classId) {
      setStudents([]);
      return;
    }
    let alive = true;
    fetchStudents({ classId })
      .then((rows) => {
        if (!alive) return;
        const list = rows.map((r) => ({ id: r.id, fullName: r.full_name }));
        setStudents(list);
        setStudentId((joriy) =>
          list.some((s) => s.id === joriy) ? joriy : (list[0]?.id ?? ""),
        );
      })
      .catch(() => alive && setStudents([]));
    return () => {
      alive = false;
    };
  }, [classId]);
  const studentNotes = notes.filter((n) => n.childId === studentId);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || !studentId) return;
    setNotes((prev) => [
      {
        id: `wb-new-${Date.now()}`,
        childId: studentId,
        kind: "behavior",
        authorId: me.user?.id ?? "",
        subject: subject || undefined,
        tone,
        text: text.trim(),
        createdAt: "Hozir",
      },
      ...prev,
    ]);
    setText("");
  }

  return (
    <TeacherShell
      title="Tarbiyaviy izoh"
      subtitle="Izoh ota-onaning kabinetida koʻrinadi — aniq va hurmat bilan yozing"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wb-class" className="mb-1 block text-sm font-medium">Sinf</label>
              <select
                id="wb-class"
                value={className}
                onChange={(e) => {
                  setClassName(e.target.value);
                  setStudentId("");
                  setSubject("");
                }}
                className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wb-student" className="mb-1 block text-sm font-medium">Oʻquvchi</label>
              <select
                id="wb-student"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {students.length === 0 && <option value="">Roʻyxat boʻsh</option>}
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="wb-subject" className="mb-1 block text-sm font-medium">
              Qaysi sifatda yozyapsiz?
            </label>
            <select
              id="wb-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {asHomeroom && <option value="">Sinf rahbari sifatida</option>}
              {subjects.map((s) => (
                <option key={s} value={s}>{s} oʻqituvchisi sifatida</option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Umumiy baho</legend>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  aria-pressed={tone === t}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    tone === t
                      ? "bg-brand text-brand-foreground"
                      : "border border-border text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {TONE_LABELS[t]}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="wb-text" className="mb-1 block text-sm font-medium">Izoh</label>
            <textarea
              id="wb-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Nima kuzatdingiz, qanday choralar koʻrildi?"
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            />
          </div>

          <button
            type="submit"
            disabled={!text.trim() || !studentId}
            className="h-10 rounded-lg bg-brand text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            Izohni saqlash
          </button>
        </form>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Oldingi izohlar {students.find((s) => s.id === studentId)?.fullName}
          </h2>
          {studentNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center text-sm text-foreground-muted">
              Bu oʻquvchi uchun hali izoh yoʻq.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {studentNotes.map((note) => {
                const author = staffById(note.authorId);
                return (
                  <li
                    key={note.id}
                    className={`rounded-xl border border-border border-l-4 p-3 ${TONE_CLASSES[note.tone]}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">
                        {author?.shortName ?? "Ustoz"} ·{" "}
                        {authorRoleLabel(note, HOMEROOM[className] ?? null)}
                      </p>
                      <p className="text-[11px] text-foreground-muted">{note.createdAt}</p>
                    </div>
                    <p className="text-sm text-foreground">{note.text}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </TeacherShell>
  );
}
