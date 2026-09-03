"use client";

/**
 * Uy vazifalari roʻyxati (UYV-01, UYV-06).
 *
 * Maʼlumot serverdan (`/api/v1/journal/homework`). Tekshirilmagan ishi
 * bor vazifalar tepada — ustoz avval nimani tekshirishini izlab
 * yurmasin.
 *
 * Sinf va fan roʻyxati ustozning OʻZ dars jadvalidan: server ham shu
 * kesimni tekshiradi (boshqa fandan vazifa berishga `403`).
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ClipboardIcon, PlusIcon } from "@/components/ui/icons";
import { useMyTeaching } from "@/lib/teacher/me";
import {
  apiXato,
  createHomework,
  fetchHomework,
  fetchHomeworkLessons,
  formatDue,
  lessonLabel,
  localInputToIso,
  type HomeworkLessonOut,
  type HomeworkOut,
} from "@/lib/teacher/journal-api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

export default function HomeworkListPage() {
  const teaching = useMyTeaching();
  const [items, setItems] = useState<HomeworkOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchHomework();
      // Tekshirilmagani koʻp boʻlgani tepada.
      setItems(
        [...rows].sort(
          (a, b) =>
            b.submitted_count -
            b.graded_count -
            (a.submitted_count - a.graded_count),
        ),
      );
    } catch (err) {
      setError(apiXato(err, "Vazifalarni olib boʻlmadi."));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingTotal =
    items?.reduce((sum, h) => sum + (h.submitted_count - h.graded_count), 0) ?? 0;

  return (
    <TeacherShell
      title="Uy vazifasi"
      subtitle={
        items === null
          ? undefined
          : pendingTotal > 0
            ? `${pendingTotal} ta ish tekshirilmagan`
            : "Barcha ishlar tekshirilgan"
      }
      actions={
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Yangi vazifa berish
        </button>
      }
    >
      {showForm && (
        <NewHomeworkForm
          slots={teaching.slots}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {error && <ErrorState description={error} />}

      {items === null ? (
        <ListSkeleton count={3} />
      ) : items.length === 0 && !error ? (
        <EmptyState
          icon={<ClipboardIcon className="h-5 w-5" />}
          title="Hali vazifa berilmagan"
          description="«Yangi vazifa berish» tugmasi orqali birinchi vazifani qoʻshing."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((hw) => {
            const pending = hw.submitted_count - hw.graded_count;
            const ulush =
              hw.total_count > 0 ? (hw.graded_count / hw.total_count) * 100 : 0;
            return (
              <li key={hw.id}>
                <Link
                  href={`/teacher/vazifa/${hw.id}`}
                  className="focus-ring block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-surface-muted/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{hw.class_name}</Badge>
                        <span className="text-xs text-foreground-muted">
                          {hw.subject_name}
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium">{hw.title}</p>
                      {hw.topic && hw.topic !== hw.title && (
                        <p className="mt-0.5 text-sm text-foreground-muted">
                          Mavzu: {hw.topic}
                        </p>
                      )}
                      {hw.description && (
                        <p className="mt-0.5 line-clamp-1 text-sm text-foreground-muted">
                          {hw.description}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0">
                      <Badge tone={pending > 0 ? "warning" : "success"}>
                        {pending > 0 ? `${pending} ta tekshirilmagan` : "Tekshirilgan"}
                      </Badge>
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground-muted">
                    <span>
                      Muddat: <span className="text-foreground">{formatDue(hw.due_at)}</span>
                    </span>
                    <span>
                      Topshirdi:{" "}
                      <span className="num text-foreground">
                        {hw.submitted_count}/{hw.total_count}
                      </span>
                    </span>
                    <span>
                      Baholandi:{" "}
                      <span className="num text-foreground">
                        {hw.graded_count}/{hw.total_count}
                      </span>
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-valuenow={hw.graded_count}
                    aria-valuemin={0}
                    aria-valuemax={hw.total_count}
                    aria-label={`${hw.title} — baholangan ishlar`}
                    className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                  >
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${ulush}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </TeacherShell>
  );
}

/**
 * UYV-01: vazifa OʻTILGAN DARSGA beriladi.
 *
 * Loyiha egasining soʻrovi (2026-09-03): ilgari ustoz sarlavhani oʻzi
 * oʻylab topardi («5-mashq»), va vazifa qaysi mavzuga tegishli ekani
 * hech qayerda qolmasdi — oʻquvchi ham, ota-ona ham, rahbar ham buni
 * bogʻlay olmasdi. Endi ustoz oʻtilgan darsni tanlaydi, sarlavha esa
 * jurnalga yozilgan mavzudan olinadi va kerak boʻlsa aniqlashtiriladi.
 *
 * Darslar roʻyxati SERVERDAN va faqat vaqti kelib boʻlganlari — hali
 * oʻtilmagan mavzuga vazifa berilmaydi (tekshiruv serverda ham bor).
 */
function NewHomeworkForm({
  slots,
  onClose,
  onCreated,
}: {
  slots: { classId: string; className: string; subjectId: string; subjectName: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pick, setPick] = useState(0);
  const [lessons, setLessons] = useState<HomeworkLessonOut[] | null>(null);
  const [lessonId, setLessonId] = useState("");
  const [title, setTitle] = useState("");
  // Ustoz sarlavhani oʻzi tahrirladimi. Tahrirlagan boʻlsa, dars
  // almashtirilganda yozgani oʻchib ketmasin.
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(() => defaultDue());
  const [maxScore, setMaxScore] = useState(5);
  const [allowLate, setAllowLate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slot = slots[pick];

  const labels = useMemo(
    () => slots.map((s) => `${s.className} · ${s.subjectName}`),
    [slots],
  );

  const classId = slot?.classId;
  const subjectId = slot?.subjectId;

  // Sinf/fan almashsa — oʻtilgan darslar qaytadan olinadi.
  useEffect(() => {
    if (classId === undefined || subjectId === undefined) return;
    let alive = true;
    setLessons(null);
    setLessonId("");
    setError(null);

    fetchHomeworkLessons(classId, subjectId)
      .then((rows) => {
        if (!alive) return;
        setLessons(rows);
        // Eng oxirgi oʻtilgan dars — odatda vazifa aynan shunga
        // beriladi. Ustoz kerak boʻlsa boshqasini tanlaydi.
        const birinchi = rows[0];
        if (birinchi) {
          setLessonId(birinchi.id);
          setTitle((oldingi) => (oldingi.trim() === "" ? (birinchi.topic ?? "") : oldingi));
        }
      })
      .catch((err) => {
        if (!alive) return;
        setLessons([]);
        setError(apiXato(err, "Oʻtilgan darslarni olib boʻlmadi."));
      });

    return () => {
      alive = false;
    };
  }, [classId, subjectId]);

  const lesson = lessons?.find((l) => l.id === lessonId) ?? null;
  const valid =
    slot !== undefined && lessonId !== "" && title.trim().length > 1 && due !== "";

  function chooseLesson(id: string) {
    setLessonId(id);
    const tanlangan = lessons?.find((l) => l.id === id);
    if (tanlangan?.topic && !titleTouched) setTitle(tanlangan.topic);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || slot === undefined) return;
    setSaving(true);
    setError(null);
    try {
      await createHomework({
        class_id: slot.classId,
        subject_id: slot.subjectId,
        lesson_id: lessonId,
        title: title.trim(),
        description: description.trim(),
        due_at: localInputToIso(due),
        max_score: maxScore,
        allow_late: allowLate,
      });
      onCreated();
    } catch (err) {
      setError(apiXato(err, "Vazifani berib boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  if (slots.length === 0) {
    return (
      <div className="mb-5 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-foreground-muted">
          Dars jadvalingiz boʻsh — vazifa berish uchun avval administrator sizga sinf va
          fan biriktirishi kerak.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">Yangi uy vazifasi</h2>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
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

        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Oʻtilgan dars</span>

          {lessons === null ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
              Darslar yuklanmoqda…
            </p>
          ) : lessons.length === 0 ? (
            // Real holat: oʻquv yili boshida hali dars oʻtilmagan. Soxta
            // variant koʻrsatgandan koʻra sababini aytish toʻgʻri —
            // ustoz nima qilishini biladi.
            <p className="rounded-lg border border-warning/40 bg-warning-tint px-3 py-2 text-sm text-foreground">
              Bu sinfda bu fandan hali dars oʻtilmagan. Vazifa oʻtilgan mavzuga
              beriladi — avval dars oʻtilsin, mavzu esa davomat sahifasida yoziladi.
            </p>
          ) : (
            <>
              <select
                value={lessonId}
                onChange={(e) => chooseLesson(e.target.value)}
                className={inputClass}
              >
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {lessonLabel(l)} — {l.topic ?? "mavzu yozilmagan"}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-foreground-muted">
                {lesson !== null && lesson.topic === null
                  ? "Bu darsning mavzusi jurnalga yozilmagan — davomat sahifasida yozib qoʻying, keyingi safar sarlavha oʻzi toʻladi."
                  : "Sarlavha shu darsning mavzusidan olindi."}
              </p>
            </>
          )}
        </div>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sarlavha</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value.slice(0, 200));
              setTitleTouched(true);
            }}
            placeholder="Mavzu asosidagi topshiriq — masalan: Kasrlarni qoʻshish, 5-mashq"
            className={inputClass}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Tavsif</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Muddat</span>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Maksimal ball
          </span>
          <input
            type="number"
            min={1}
            max={100}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            className={`${inputClass} num`}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allowLate}
          onChange={(e) => setAllowLate(e.target.checked)}
          className="h-4 w-4 rounded border-border text-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        />
        <span className="text-foreground-muted">
          Muddatdan keyin ham topshirishga ruxsat (kechikkan deb belgilanadi)
        </span>
      </label>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={!valid || saving}
          className="focus-ring inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "Berilmoqda…" : "Vazifani berish"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted"
        >
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

/** Ertaga soat 17:00 — `datetime-local` maydonining koʻrinishida. */
function defaultDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
