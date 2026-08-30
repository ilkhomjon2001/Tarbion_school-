"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { AppealThread } from "@/components/shared/AppealThread";
import { useAdmin, useAdminDispatch } from "@/lib/admin/store";
import {
  CONVERSATION_KIND_LABELS,
  type ConversationKind,
} from "@/lib/admin/types";
import {
  APPEAL_STATUS_LABELS,
  APPEALS,
  isOpen,
  type Appeal,
  type AppealStatus,
} from "@/lib/school/appeals";
import { allTeachers, DIRECTOR, staffById } from "@/lib/school/staff";

const STATUS_TONE: Record<AppealStatus, "info" | "warning" | "success" | "neutral"> = {
  new: "info",
  in_review: "warning",
  answered: "success",
  closed: "neutral",
};

type Filter = "all" | "open" | "closed";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Barchasi",
  open: "Ochiq",
  closed: "Yopilgan",
};

/**
 * Ota-ona bilan yozishma va suhbat qaydnomasi.
 *
 * Yozishmaning oʻzi `lib/school/appeals.ts` dan — ota-ona va ustoz
 * kabinetlari ham aynan shu murojaatlarni koʻradi. Qaydnoma esa admin
 * do'konida saqlanadi va faqat rahbariyatga koʻrinadi.
 */
export function ConversationsBoard() {
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState(APPEALS[0]?.id ?? "");

  const shown = APPEALS.filter((a) => {
    if (filter === "open") return isOpen(a);
    if (filter === "closed") return !isOpen(a);
    return true;
  });

  const active = APPEALS.find((a) => a.id === activeId) ?? shown[0] ?? null;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Murojaatlar va suhbatlar</h1>
        <p className="text-sm text-foreground-muted">
          Ota-onalar bilan yozishma — javob berish va suhbat qaydnomasini yuritish
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* 1-ustun: roʻyxat */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`focus-ring rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === key
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                }`}
              >
                {FILTER_LABELS[key]}
              </button>
            ))}
          </div>

          <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
            {shown.map((appeal) => (
              <li key={appeal.id}>
                <ConversationItem
                  appeal={appeal}
                  selected={appeal.id === active?.id}
                  onSelect={() => setActiveId(appeal.id)}
                />
              </li>
            ))}
            {shown.length === 0 && (
              <li className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-foreground-muted">
                Bu kesimda murojaat yoʻq.
              </li>
            )}
          </ul>
        </div>

        {/* 2-ustun: yozishma */}
        {active ? (
          <div className="min-w-0">
            <AppealThread
              key={active.id}
              appeal={active}
              viewer="staff"
              viewerStaffId={DIRECTOR.id}
              defaultOpen
            />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center text-sm text-foreground-muted">
            Chapdan murojaat tanlang.
          </p>
        )}

        {/* 3-ustun: qaydnoma */}
        {active && <NotePanel appeal={active} />}
      </div>
    </div>
  );
}

function ConversationItem({
  appeal,
  selected,
  onSelect,
}: {
  appeal: Appeal;
  selected: boolean;
  onSelect: () => void;
}) {
  const last = appeal.messages[appeal.messages.length - 1];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`focus-ring block w-full rounded-xl border bg-surface p-3 text-left transition-colors ${
        selected ? "border-brand ring-1 ring-brand" : "card-interactive border-border"
      }`}
    >
      <span className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11px] font-semibold text-brand-dark">
          {appeal.parentName
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0])
            .join("")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {appeal.parentName}
          </span>
          <span className="block truncate text-xs text-foreground-muted">
            {appeal.studentFullName} · {appeal.className}
          </span>
          {last && (
            <span className="mt-1 block truncate text-xs text-foreground-muted">
              {last.text}
            </span>
          )}
        </span>
        <span className="shrink-0">
          <Badge tone={STATUS_TONE[appeal.status]}>{APPEAL_STATUS_LABELS[appeal.status]}</Badge>
        </span>
      </span>
    </button>
  );
}

/** Adminning shaxsiy qaydi — ustoz haqidagi fikr shu yerdan reytingga tushadi. */
function NotePanel({ appeal }: { appeal: Appeal }) {
  const dispatch = useAdminDispatch();
  const { notes } = useAdmin();
  const [kind, setKind] = useState<ConversationKind>("telefon");
  const [date, setDate] = useState("2026-09-20");
  const [summary, setSummary] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);

  const previous = notes.filter((n) => n.appealId === appeal.id);

  return (
    <aside className="h-fit rounded-xl border border-border bg-surface p-4 shadow-sm xl:sticky xl:top-20">
      <h2 className="mb-3 text-base font-semibold text-foreground">Suhbat qaydnomasi</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!summary.trim()) return;
          dispatch({
            type: "SAVE_NOTE",
            note: {
              appealId: appeal.id,
              kind,
              date,
              summary,
              teacherId: teacherId || undefined,
              rating: teacherId ? rating : undefined,
              comment: teacherId ? comment : undefined,
            },
          });
          setSummary("");
          setComment("");
          setTeacherId("");
          setRating(0);
          setSaved(true);
        }}
        className="flex flex-col gap-3"
      >
        <Field label="Suhbat turi">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ConversationKind)}
            className={inputClass}
          >
            {(Object.keys(CONVERSATION_KIND_LABELS) as ConversationKind[]).map((k) => (
              <option key={k} value={k}>
                {CONVERSATION_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sana">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Muhokama qilindi">
          <textarea
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              setSaved(false);
            }}
            rows={3}
            placeholder="Asosiy mazmun…"
            className={`${inputClass} h-auto resize-none py-2`}
          />
        </Field>

        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-semibold text-foreground">
            Ustoz haqida fikr
          </legend>
          <p className="mb-2 text-[11px] text-foreground-muted">
            Toʻldirilsa — soʻrovnoma natijalariga qoʻshiladi.
          </p>

          <Field label="Oʻqituvchini tanlang">
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={inputClass}
            >
              <option value="">Tanlanmagan</option>
              {allTeachers().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName} ({t.subjects[0]})
                </option>
              ))}
            </select>
          </Field>

          {teacherId && (
            <>
              <p className="mb-1.5 mt-3 text-xs font-medium text-foreground">Baho (1–5)</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-pressed={rating === n}
                    className={`focus-ring num h-9 w-9 rounded-full text-sm font-semibold transition-colors ${
                      rating === n
                        ? "bg-brand text-brand-foreground"
                        : "border border-border text-foreground-muted hover:bg-surface-muted"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <Field label="Izoh">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className={`${inputClass} h-auto resize-none py-2`}
                  />
                </Field>
              </div>
            </>
          )}
        </fieldset>

        <button
          type="submit"
          disabled={!summary.trim()}
          className="focus-ring w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          Qaydnomani saqlash
        </button>

        {saved && (
          <p className="animate-enter rounded-lg bg-success-tint px-3 py-2 text-xs text-success">
            Qaydnoma saqlandi va audit jurnaliga tushdi.
          </p>
        )}
      </form>

      {previous.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Avvalgi qaydlar
          </h3>
          <ul className="flex flex-col gap-2">
            {previous.map((note) => (
              <li key={note.id} className="rounded-lg bg-surface-muted px-3 py-2">
                <p className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-brand-dark">
                    {CONVERSATION_KIND_LABELS[note.kind]}
                  </span>
                  <span className="num text-foreground-muted">{note.date}</span>
                </p>
                <p className="mt-0.5 text-xs text-foreground">{note.summary}</p>
                {note.teacherId && (
                  <p className="mt-1 text-[11px] text-foreground-muted">
                    {staffById(note.teacherId)?.shortName} · baho{" "}
                    <span className="num font-medium">{note.rating}/5</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-3 text-[11px] text-foreground-muted">
        <span aria-hidden>🔒</span>
        Qaydnoma faqat rahbariyat va administratorga koʻrinadi.
      </p>
    </aside>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
