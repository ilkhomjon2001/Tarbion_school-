"use client";

import { useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { DEMO_TEACHER } from "@/lib/teacher/data";
import { isHomeroomOf, myClasses, mySubjectsIn } from "@/lib/teacher/roles";
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

/** DEMO: sinf → oʻquvchilar. Backendda `students` jadvalidan keladi. */
const CLASS_STUDENTS: Record<string, { id: string; fullName: string }[]> = {
  "11-A": [
    { id: "c-1", fullName: "Abdullayev Alisher" },
    { id: "st-11a-2", fullName: "Yoqubova Kamola" },
    { id: "st-11a-3", fullName: "Zokirov Otabek" },
  ],
  "6-B": [
    { id: "c-2", fullName: "Abdullayeva Zarina" },
    { id: "st-6b-2", fullName: "Toshpulatov Diyorbek" },
  ],
  "9-B": [
    { id: "st-9b-1", fullName: "Nazarova Madina" },
    { id: "st-9b-2", fullName: "Rustamov Sherzod" },
  ],
  "10-A": [{ id: "st-10a-1", fullName: "Islomova Feruza" }],
  "7-A": [{ id: "st-7a-1", fullName: "Sultonov Aziz" }],
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
  const classes = useMemo(() => myClasses(), []);
  const [notes, setNotes] = useState<WellbeingNote[]>(
    WELLBEING_NOTES.filter((n) => n.kind === "behavior"),
  );
  const [className, setClassName] = useState(classes[0] ?? "");
  const [studentId, setStudentId] = useState(CLASS_STUDENTS[classes[0] ?? ""]?.[0]?.id ?? "");
  const [tone, setTone] = useState<WellbeingTone>("neutral");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  const students = CLASS_STUDENTS[className] ?? [];
  const subjects = mySubjectsIn(className);
  const asHomeroom = isHomeroomOf(className);
  const studentNotes = notes.filter((n) => n.childId === studentId);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || !studentId) return;
    setNotes((prev) => [
      {
        id: `wb-new-${Date.now()}`,
        childId: studentId,
        kind: "behavior",
        authorId: DEMO_TEACHER.id,
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
                  setStudentId(CLASS_STUDENTS[e.target.value]?.[0]?.id ?? "");
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
