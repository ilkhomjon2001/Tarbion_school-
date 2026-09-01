"use client";

import { useCallback, useEffect, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { fetchStudents, type StudentListRowOut } from "@/lib/school/api";
import { useMyTeaching } from "@/lib/teacher/me";
import {
  archiveNote,
  createNote,
  fetchNotes,
  KIND_LABELS,
  TONE_LABELS,
  type WellbeingNoteOut,
} from "@/lib/wellbeing/api";

/**
 * Tarbiyaviy izoh — BAZADAN.
 *
 * Ustoz faqat oʻz sinflaridagi oʻquvchiga yozadi va bu SERVERDA
 * tekshiriladi. Psixologik yozuv bu ekranda umuman yoʻq: uni faqat
 * rahbariyat kiritadi va fan ustoziga u roʻyxatda ham kelmaydi.
 */

const TONE_STYLES: Record<string, string> = {
  positive: "bg-success-tint text-success",
  neutral: "bg-surface-muted text-foreground-muted",
  attention: "bg-warning-tint text-warning",
};

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

export default function WellbeingPage() {
  const teaching = useMyTeaching();

  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<StudentListRowOut[]>([]);
  const [studentId, setStudentId] = useState("");
  const [notes, setNotes] = useState<WellbeingNoteOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [tone, setTone] = useState("positive");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!classId && teaching.classes.length > 0) setClassId(teaching.classes[0].id);
  }, [teaching.classes, classId]);

  useEffect(() => {
    if (!classId) return;
    let alive = true;
    fetchStudents({ classId })
      .then((rows) => {
        if (!alive) return;
        setStudents(rows);
        setStudentId(rows[0]?.id ?? "");
      })
      .catch(() => alive && setError("Oʻquvchilarni olib boʻlmadi."));
    return () => {
      alive = false;
    };
  }, [classId]);

  const yukla = useCallback(async () => {
    if (!studentId) {
      setNotes([]);
      return;
    }
    setNotes(null);
    try {
      setNotes(await fetchNotes(studentId));
      setError(null);
    } catch {
      setError("Yozuvlarni olib boʻlmadi.");
      setNotes([]);
    }
  }, [studentId]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 5 || !studentId) return;
    setBusy(true);
    setError(null);
    try {
      await createNote({ studentId, kind: "behavior", tone, text: text.trim() });
      setText("");
      await yukla();
    } catch {
      setError("Yozuvni saqlab boʻlmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function olibTashla(id: string) {
    setBusy(true);
    try {
      await archiveNote(id);
      await yukla();
    } catch {
      setError("Olib tashlab boʻlmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell
      title="Tarbiyaviy izoh"
      subtitle="Yozuv vasiyga, sinf rahbariga va rahbariyatga koʻrinadi"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className={inputClass}
            >
              {teaching.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Oʻquvchi</span>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={inputClass}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form
          onSubmit={saqla}
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex flex-wrap gap-2">
            {Object.entries(TONE_LABELS).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTone(id)}
                aria-pressed={tone === id}
                className={`focus-ring rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  tone === id
                    ? "border-brand bg-brand/10 text-brand-dark"
                    : "border-border text-foreground-muted hover:bg-surface-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            rows={3}
            placeholder="Masalan: sinf tadbirida faol qatnashdi, kichiklarga yordam berdi…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={text.trim().length < 5 || busy}
              className="focus-ring inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              Yozuvni saqlash
            </button>
          </div>
        </form>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Oldingi yozuvlar</h2>
          {notes === null ? (
            <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
          ) : notes.length === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
              Bu oʻquvchi boʻyicha yozuv yoʻq.
            </p>
          ) : (
            notes.map((n) => (
              <article
                key={n.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_STYLES[n.tone] ?? TONE_STYLES.neutral}`}
                  >
                    {TONE_LABELS[n.tone] ?? n.tone}
                  </span>
                  <span className="num text-xs text-foreground-muted">
                    {new Date(n.created_at).toLocaleDateString("uz-UZ")}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{n.text}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-foreground-muted">
                    {KIND_LABELS[n.kind] ?? n.kind} · {n.author_name}
                    {n.subject_name && ` · ${n.subject_name}`}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void olibTashla(n.id)}
                    className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger disabled:opacity-40"
                  >
                    Olib tashlash
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </TeacherShell>
  );
}
