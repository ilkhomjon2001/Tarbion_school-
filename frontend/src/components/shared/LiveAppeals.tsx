"use client";

/**
 * Murojaatlar — bazadan. Ota-ona, administrator va rahbariyat uchun BITTA
 * komponent.
 *
 * Nega bitta: uchta kabinetda uchta nusxa boʻlsa, uchta joyda uchta xil
 * xatolik ishlash mantigʻi paydo boʻlardi. Kim nimani koʻrishini baribir
 * server hal qiladi (`appeals_service._scope()`) — frontend faqat
 * koʻrinishni oʻzgartiradi:
 *
 *   parent  → yozish formasi, «kimga» ustuni
 *   staff   → filtrlar, xulosa, sinflar kesimi, ichki qaydlar
 *
 * Yozishmaning oʻzi `AppealThread` da — u mock bilan ham ishlaydi, shu
 * sabab qayta yozilmadi.
 */

import { useCallback, useEffect, useState } from "react";
import { AppealThread } from "@/components/shared/AppealThread";
import { LiveSession, messageOf } from "@/components/shared/LiveSession";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_TARGET_LABELS,
  APPEAL_TARGETS,
  CONTACT_KIND_LABELS,
  CONTACT_KINDS,
  type AppealStatus,
  type AppealTarget,
  type ContactKind,
} from "@/lib/contracts";
import {
  addNote,
  createAppeal,
  fetchAppeal,
  fetchAppeals,
  fetchClassStats,
  fetchNotes,
  fetchOptions,
  fetchTeacherOptions,
  fetchSummary,
  formatMoment,
  searchStudents,
  sendMessage,
  setStatus,
  startConversation,
  type AppealNoteOut,
  type ComposeChild,
  type StudentMatch,
  type AppealSummaryOut,
  type ClassAppealStatOut,
} from "@/lib/appeals/api";
import type { Appeal } from "@/lib/school/appeals";

const STATUS_TONE: Record<AppealStatus, "info" | "warning" | "success" | "neutral"> = {
  new: "info",
  in_review: "warning",
  answered: "success",
  closed: "neutral",
};

export function LiveAppeals({
  viewer,
  title,
  hint,
}: {
  viewer: "parent" | "staff";
  title: string;
  hint?: string;
}) {
  return (
    <LiveSession title={title} hint={hint}>
      {(reloadKey) => <Board key={reloadKey} viewer={viewer} />}
    </LiveSession>
  );
}

function Board({ viewer }: { viewer: "parent" | "staff" }) {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [summary, setSummary] = useState<AppealSummaryOut | null>(null);
  const [stats, setStats] = useState<ClassAppealStatOut[]>([]);
  const [statusFilter, setStatusFilter] = useState<AppealStatus | "">("");
  const [targetFilter, setTargetFilter] = useState<AppealTarget | "">("");
  const [selected, setSelected] = useState<Appeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, sum] = await Promise.all([
        fetchAppeals({
          status: statusFilter || undefined,
          target: targetFilter || undefined,
        }),
        fetchSummary(),
      ]);
      setAppeals(list);
      setSummary(sum);

      // Sinflar kesimi faqat butun maktabni koʻradiganlarga ochiq —
      // ruxsat yoʻq boʻlsa 403 keladi va bu XATO EMAS, shunchaki blok
      // koʻrsatilmaydi.
      if (viewer === "staff") {
        try {
          setStats(await fetchClassStats());
        } catch {
          setStats([]);
        }
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, targetFilter, viewer]);

  useEffect(() => {
    void load();
  }, [load]);

  // Yozishma roʻyxatda kelmaydi (100 ta murojaatning hammasini yuborish
  // ortiqcha) — kartochka ochilganda alohida olinadi.
  async function open(appeal: Appeal) {
    if (selected?.id === appeal.id) {
      setSelected(null);
      return;
    }
    try {
      setSelected(await fetchAppeal(appeal.id));
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function reply(text: string) {
    if (!selected) return;
    try {
      await sendMessage(selected.id, text);
      setSelected(await fetchAppeal(selected.id));
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function close() {
    if (!selected) return;
    try {
      await setStatus(selected.id, "closed");
      setSelected(await fetchAppeal(selected.id));
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {summary && <SummaryRow summary={summary} />}

      {viewer === "parent" && (
        <div>
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="focus-ring h-10 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            {composing ? "Formani yopish" : "Yangi murojaat yozish"}
          </button>
          {composing && (
            <ComposeForm
              onDone={async () => {
                setComposing(false);
                await load();
              }}
            />
          )}
        </div>
      )}

      {viewer === "staff" && (
        <div>
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="focus-ring h-10 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            {composing ? "Formani yopish" : "Ota-onaga yozish"}
          </button>
          {composing && (
            <StartConversationForm
              onDone={async () => {
                setComposing(false);
                await load();
              }}
            />
          )}
        </div>
      )}

      {viewer === "staff" && (
        <Filters
          status={statusFilter}
          target={targetFilter}
          onStatus={setStatusFilter}
          onTarget={setTargetFilter}
        />
      )}

      {loading ? (
        <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
      ) : appeals.length === 0 ? (
        <EmptyState
          title="Murojaat yoʻq"
          description={
            viewer === "parent"
              ? "Savolingiz boʻlsa «Yangi murojaat yozish» tugmasini bosing."
              : "Tanlangan filtr boʻyicha murojaat topilmadi."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {appeals.map((appeal) => (
            <li key={appeal.id}>
              <Row
                appeal={appeal}
                viewer={viewer}
                expanded={selected?.id === appeal.id}
                onToggle={() => void open(appeal)}
              />
              {selected?.id === appeal.id && (
                <div className="mt-2 flex flex-col gap-3">
                  <AppealThread
                    appeal={selected}
                    viewer={viewer}
                    defaultOpen
                    showCounterparty={false}
                    onSend={(text) => void reply(text)}
                    onClose={() => void close()}
                  />
                  {viewer === "staff" && <NotesPanel appealId={selected.id} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {viewer === "staff" && stats.length > 0 && <ClassStats rows={stats} />}
    </div>
  );
}

function SummaryRow({ summary }: { summary: AppealSummaryOut }) {
  const cells = [
    { label: "Jami", value: summary.total, tone: "text-foreground" },
    { label: "Yangi", value: summary.new, tone: "text-brand" },
    { label: "Ochiq", value: summary.open, tone: "text-warning" },
    { label: "Muddati oʻtgan", value: summary.overdue, tone: "text-danger" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map((cell) => (
        <Card key={cell.label} className="p-3">
          <p className="text-xs text-foreground-muted">{cell.label}</p>
          <p className={`num text-h3 font-bold ${cell.tone}`}>{cell.value}</p>
        </Card>
      ))}
    </div>
  );
}

function Filters({
  status,
  target,
  onStatus,
  onTarget,
}: {
  status: AppealStatus | "";
  target: AppealTarget | "";
  onStatus: (value: AppealStatus | "") => void;
  onTarget: (value: AppealTarget | "") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={status}
        onChange={(e) => onStatus(e.target.value as AppealStatus | "")}
        aria-label="Holat boʻyicha filtr"
        className="focus-ring h-9 rounded-lg border border-border bg-surface px-3 text-sm"
      >
        <option value="">Barcha holat</option>
        {(Object.keys(APPEAL_STATUS_LABELS) as AppealStatus[]).map((s) => (
          <option key={s} value={s}>
            {APPEAL_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        value={target}
        onChange={(e) => onTarget(e.target.value as AppealTarget | "")}
        aria-label="Yoʻnalish boʻyicha filtr"
        className="focus-ring h-9 rounded-lg border border-border bg-surface px-3 text-sm"
      >
        <option value="">Barcha yoʻnalish</option>
        {APPEAL_TARGETS.map((t) => (
          <option key={t} value={t}>
            {APPEAL_TARGET_LABELS[t]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Row({
  appeal,
  viewer,
  expanded,
  onToggle,
}: {
  appeal: Appeal;
  viewer: "parent" | "staff";
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta =
    viewer === "parent"
      ? `${APPEAL_TARGET_LABELS[appeal.target]}${appeal.subject ? ` · ${appeal.subject}` : ""}${
          appeal.assigneeName ? ` · ${appeal.assigneeName}` : ""
        }`
      : `${appeal.parentName} · ${appeal.studentFullName} (${appeal.className})`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`focus-ring flex w-full items-start justify-between gap-3 rounded-xl border bg-surface p-3 text-left transition-colors hover:bg-surface-muted/50 ${
        expanded ? "border-brand/40" : "border-border"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{appeal.title}</p>
        <p className="truncate text-xs text-foreground-muted">{meta}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={STATUS_TONE[appeal.status]}>{APPEAL_STATUS_LABELS[appeal.status]}</Badge>
        {/* Yozishmani maktab boshlagan boʻlsa buni yashirmaymiz — ota-ona
            oʻzi yozmagan xatni koʻrib chalgʻimasin. */}
        {appeal.openedByName && (
          <span className="text-[11px] font-medium text-brand">Maktab boshladi</span>
        )}
        <span className="text-[11px] text-foreground-muted">{appeal.createdAt}</span>
      </div>
    </button>
  );
}

/**
 * Ichki qaydlar — administrator va rahbariyat uchun.
 *
 * Ruxsat yoʻq boʻlsa endpoint 403 qaytaradi va blok umuman
 * koʻrsatilmaydi. Frontendda yashirish himoya emas: tekshiruv serverda.
 */
function NotesPanel({ appealId }: { appealId: string }) {
  const [notes, setNotes] = useState<AppealNoteOut[] | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [kind, setKind] = useState<ContactKind>("phone");
  const [summary, setSummary] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setNotes(await fetchNotes(appealId));
    } catch {
      // 403 — bu foydalanuvchi qaydlarni koʻrmaydi. Xato koʻrsatilmaydi,
      // blok butunlay chizilmaydi.
      setNotes(null);
    }
  }, [appealId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ustozlar roʻyxati faqat qaydlar koʻringanda kerak.
  useEffect(() => {
    if (notes === null) return;
    void (async () => {
      try {
        setTeachers(await fetchTeacherOptions());
      } catch {
        setTeachers([]);
      }
    })();
  }, [notes]);

  if (notes === null) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!summary.trim()) return;
    setBusy(true);
    setError("");
    try {
      await addNote(appealId, {
        kind,
        summary: summary.trim(),
        aboutTeacherId: teacherId || null,
        teacherRating: teacherId && rating > 0 ? rating : null,
        teacherComment: teacherId ? comment.trim() || null : null,
      });
      setSummary("");
      setComment("");
      setTeacherId("");
      setRating(0);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-dashed p-3">
      <p className="text-sm font-semibold text-foreground">Ichki qaydlar</p>
      <p className="mb-3 text-xs text-foreground-muted">
        Faqat maktab xodimlari koʻradi — ota-onaga koʻrsatilmaydi.
      </p>

      {notes.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
              <p className="text-[11px] font-medium text-foreground-muted">
                {CONTACT_KIND_LABELS[note.kind as ContactKind]} · {note.author_name} ·{" "}
                {formatMoment(note.created_at)}
              </p>
              <p className="text-foreground">{note.summary}</p>
              {note.about_teacher_name && (
                <p className="mt-1 text-xs text-foreground-muted">
                  Ustoz: {note.about_teacher_name}
                  {note.teacher_rating ? ` · ${note.teacher_rating}/5` : ""}
                  {note.teacher_comment ? ` — ${note.teacher_comment}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={save} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ContactKind)}
            aria-label="Suhbat turi"
            className="focus-ring h-9 rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {CONTACT_KINDS.map((k) => (
              <option key={k} value={k}>
                {CONTACT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Suhbat qisqacha mazmuni"
            aria-label="Qayd matni"
            className="focus-ring h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
          />
        </div>

        {teachers.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={teacherId}
              onChange={(e) => {
                setTeacherId(e.target.value);
                if (!e.target.value) setRating(0);
              }}
              aria-label="Suhbat qaysi ustoz haqida"
              className="focus-ring h-9 rounded-lg border border-border bg-surface px-3 text-sm"
            >
              <option value="">Ustoz haqida emas</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {teacherId && (
              <>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  aria-label="Ustoz bahosi"
                  className="focus-ring h-9 rounded-lg border border-border bg-surface px-3 text-sm"
                >
                  <option value={0}>Baholanmadi</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} / 5
                    </option>
                  ))}
                </select>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ustoz boʻyicha izoh"
                  aria-label="Ustoz boʻyicha izoh"
                  className="focus-ring h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
                />
              </>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !summary.trim()}
          className="focus-ring h-9 self-start rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saqlanmoqda…" : "Qaydni saqlash"}
        </button>
      </form>
    </Card>
  );
}

function ClassStats({ rows }: { rows: ClassAppealStatOut[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-foreground">Sinflar kesimi</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-foreground-muted">
              <th className="py-2 pr-3 font-medium">Sinf</th>
              <th className="py-2 pr-3 text-right font-medium">Jami</th>
              <th className="py-2 pr-3 text-right font-medium">Ochiq</th>
              <th className="py-2 pr-3 text-right font-medium">Rahbariyatga</th>
              <th className="py-2 pr-3 text-right font-medium">Ustozga</th>
              <th className="py-2 text-right font-medium">Muddati oʻtgan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.class_name} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3 font-medium text-foreground">{row.class_name}</td>
                <td className="num py-2 pr-3 text-right">{row.total}</td>
                <td className="num py-2 pr-3 text-right">{row.open}</td>
                <td className="num py-2 pr-3 text-right">{row.to_management}</td>
                <td className="num py-2 pr-3 text-right">{row.to_teachers}</td>
                <td
                  className={`num py-2 text-right ${row.overdue > 0 ? "font-semibold text-danger" : ""}`}
                >
                  {row.overdue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * MUR-01 formasi. Farzandlar va ustozlar roʻyxati SERVERDAN keladi —
 * frontend butun kadrlar tarkibini olib oʻzi filtrlamaydi (X-6).
 */
function ComposeForm({ onDone }: { onDone: () => void }) {
  const [children, setChildren] = useState<ComposeChild[] | null>(null);
  const [studentId, setStudentId] = useState("");
  const [target, setTarget] = useState<AppealTarget>("homeroom");
  const [teacherKey, setTeacherKey] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchOptions();
        setChildren(data);
        if (data.length > 0) setStudentId(data[0].studentId);
      } catch (err) {
        setError(messageOf(err));
      }
    })();
  }, []);

  if (error) {
    return <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>;
  }
  if (!children) return <p className="mt-3 text-sm text-foreground-muted">Yuklanmoqda…</p>;
  if (children.length === 0) {
    return (
      <p className="mt-3 rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
        Hisobingizga farzand biriktirilmagan. Administratorga murojaat qiling.
      </p>
    );
  }

  const child = children.find((c) => c.studentId === studentId) ?? children[0];
  const needsTeacher = target === "subject_teacher";
  const chosen = child.teachers.find((t) => `${t.id}|${t.subjectId}` === teacherKey);
  const canSubmit =
    Boolean(title.trim() && body.trim()) && (!needsTeacher || Boolean(chosen));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await createAppeal({
        studentId: child.studentId,
        target,
        title: title.trim(),
        body: body.trim(),
        subjectId: needsTeacher ? chosen?.subjectId : null,
        assigneeId: needsTeacher ? chosen?.id : null,
      });
      setTitle("");
      setBody("");
      onDone();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      {children.length > 1 && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Farzand</span>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.fullName} — {c.className}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">
          Kimga murojaat qilasiz?
        </legend>
        <div className="flex flex-wrap gap-2">
          {APPEAL_TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTarget(t);
                setTeacherKey("");
              }}
              aria-pressed={target === t}
              className={`focus-ring rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
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

      {target === "homeroom" && (
        <p className="rounded-lg bg-brand-tint px-3 py-2 text-xs text-brand-dark">
          {child.homeroomTeacherName
            ? `Murojaat ${child.homeroomTeacherName}ga yuboriladi.`
            : "Bu sinfga sinf rahbari biriktirilmagan — rahbariyatga yozing."}
        </p>
      )}

      {needsTeacher && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Qaysi fan?</span>
          <select
            value={teacherKey}
            onChange={(e) => setTeacherKey(e.target.value)}
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          >
            <option value="">Fanni tanlang…</option>
            {child.teachers.map((t) => (
              <option key={`${t.id}|${t.subjectId}`} value={`${t.id}|${t.subjectId}`}>
                {t.subjectName} — {t.fullName}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-foreground">Mavzu</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Qisqacha sarlavha"
          className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-foreground">Xabar</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Savolingiz yoki taklifingizni yozing"
          className="focus-ring w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="focus-ring h-10 rounded-lg bg-brand text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Yuborilmoqda…" : "Murojaatni yuborish"}
      </button>
    </form>
  );
}

/**
 * ADM-16: maktab ota-ona bilan yozishmani boshlaydi.
 *
 * Ota-ona alohida roʻyxatdan tanlanmaydi — OʻQUVCHI qidiriladi, vasiy
 * hisobi shu yerdan chiqadi. Sabab: bir familiyali bir necha oila boʻladi
 * va roʻyxatdan tanlashda notoʻgʻri odamga yozib yuborish oson.
 *
 * Server ham shu qoidani tekshiradi: tanlangan hisob shu oʻquvchining
 * vasiysi boʻlmasa soʻrov rad etiladi.
 */
function StartConversationForm({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<StudentMatch[]>([]);
  const [chosen, setChosen] = useState<StudentMatch | null>(null);
  const [guardianId, setGuardianId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Har harfda soʻrov yubormaymiz — yozish tugagach qidiriladi.
  useEffect(() => {
    const text = query.trim();
    if (chosen || text.length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchStudents(text);
          if (!cancelled) setMatches(rows);
        } catch (err) {
          if (!cancelled) setError(messageOf(err));
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, chosen]);

  function pick(match: StudentMatch) {
    setChosen(match);
    setGuardianId(match.guardians[0]?.id ?? "");
    setMatches([]);
  }

  const canSubmit = Boolean(chosen && guardianId && title.trim() && body.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen || !canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await startConversation({
        studentId: chosen.studentId,
        guardianId,
        title: title.trim(),
        body: body.trim(),
      });
      setChosen(null);
      setQuery("");
      setTitle("");
      setBody("");
      onDone();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <p className="text-xs text-foreground-muted">
        Yozishma ota-ona kabinetida koʻrinadi va audit jurnaliga tushadi.
      </p>

      {chosen ? (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-brand-tint px-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-brand-dark">
              {chosen.fullName}
            </span>
            <span className="block truncate text-xs text-foreground-muted">
              {chosen.className ?? "sinfsiz"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setChosen(null);
              setGuardianId("");
            }}
            className="focus-ring shrink-0 rounded text-xs font-medium text-foreground-muted hover:text-danger"
          >
            Boshqasini tanlash
          </button>
        </div>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Oʻquvchi</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Familiya yoki ism — kamida 2 harf"
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          />
        </label>
      )}

      {matches.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-border p-1">
          {matches.map((match) => (
            <li key={match.studentId}>
              <button
                type="button"
                onClick={() => pick(match)}
                className="focus-ring flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="truncate text-foreground">{match.fullName}</span>
                <span className="shrink-0 text-xs text-foreground-muted">
                  {match.className ?? "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && chosen.guardians.length === 0 && (
        <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
          Bu oʻquvchiga ota-ona hisobi biriktirilmagan — avval hisob oching.
        </p>
      )}

      {chosen && chosen.guardians.length > 1 && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Kimga</span>
          <select
            value={guardianId}
            onChange={(e) => setGuardianId(e.target.value)}
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {chosen.guardians.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
                {g.isPrimary ? " — asosiy" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-foreground">Mavzu</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Qisqacha sarlavha"
          className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-foreground">Xabar</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Ota-onaga yoziladigan matn"
          className="focus-ring w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="focus-ring h-10 rounded-lg bg-brand text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Yuborilmoqda…" : "Yozishmani boshlash"}
      </button>
    </form>
  );
}
