"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { AppealThread } from "@/components/shared/AppealThread";
import { PlusIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import { useAdmin, useAdminDispatch } from "@/lib/admin/store";
import {
  CONVERSATION_KIND_LABELS,
  type AdminStudent,
  type ConversationKind,
} from "@/lib/admin/types";
import {
  APPEAL_STATUS_LABELS,
  isOpen,
  type Appeal,
  type AppealStatus,
} from "@/lib/school/appeals";
import { ADMINISTRATOR, allTeachers, staffById } from "@/lib/school/staff";

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
 * ESLATMA (2026-08-30): administrator sahifasi endi `LiveAppeals` ni
 * ishlatadi — murojaatlar bazadan oʻqiladi. Bu komponent OʻCHIRILMADI,
 * chunki unda hal qilinmagan bitta oqim bor: `NewAppealDialog` —
 * administrator ota-ona NOMIDAN murojaat ochishi (telefon qoʻngʻirogʻini
 * qayd qilish). Backendda bu yoʻl ataylab yopiq: murojaatni faqat
 * ota-onaning oʻzi ocha oladi. Qaysi biri toʻgʻri ekani loyiha egasidan
 * soʻraladi — javob kelgach bu fayl yo oʻchiriladi, yo oqim backendga
 * koʻchiriladi.
 */

/**
 * Ota-ona bilan yozishma va suhbat qaydnomasi.
 *
 * Yozishmaning oʻzi `lib/school/appeals.ts` dan — ota-ona va ustoz
 * kabinetlari ham aynan shu murojaatlarni koʻradi. Qaydnoma esa admin
 * do'konida saqlanadi va faqat rahbariyatga koʻrinadi.
 */
export function ConversationsBoard() {
  const { appeals } = useAdmin();
  const dispatch = useAdminDispatch();
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState(appeals[0]?.id ?? "");
  const [composing, setComposing] = useState(false);

  const shown = appeals.filter((a) => {
    if (filter === "open") return isOpen(a);
    if (filter === "closed") return !isOpen(a);
    return true;
  });

  const active = appeals.find((a) => a.id === activeId) ?? shown[0] ?? null;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Murojaatlar va suhbatlar</h1>
          <p className="text-sm text-foreground-muted">
            Ota-onalar bilan yozishma — javob berish, oʻzimiz yozish va suhbat
            qaydnomasini yuritish
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Ota-onaga yozish
        </button>
      </div>

      {composing && (
        <NewAppealDialog
          onClose={() => setComposing(false)}
          onCreated={() => {
            // Yangi yozishma roʻyxat boshiga tushadi — tanlovni boʻshatsak,
            // pastdagi "active" oʻzi eng yangisiga tushadi.
            setActiveId("");
            setFilter("all");
            setComposing(false);
          }}
        />
      )}

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
              viewerStaffId={ADMINISTRATOR.id}
              defaultOpen
              onSend={(text) =>
                dispatch({ type: "SEND_APPEAL_MESSAGE", appealId: active.id, text })
              }
              onClose={() => dispatch({ type: "CLOSE_APPEAL", appealId: active.id })}
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

/** Tayyor mavzular — admin koʻp yozadigan holatlar. */
const APPEAL_TEMPLATES: { title: string; text: string }[] = [
  {
    title: "Toʻlov muddati haqida eslatma",
    text: "Assalomu alaykum. Joriy oy uchun shartnoma toʻlovi muddati yaqinlashdi. Qulay vaqtda maktab hisobiga oʻtkazishingizni soʻraymiz. Savol boʻlsa — shu yerda yozing.",
  },
  {
    title: "Davomat boʻyicha suhbat",
    text: "Assalomu alaykum. Farzandingizning soʻnggi kunlardagi davomati boʻyicha gaplashib olsak. Qachon qoʻngʻiroq qilishimiz qulay?",
  },
  {
    title: "Hujjatlarni toʻldirish",
    text: "Assalomu alaykum. Shaxsiy ishga bir nechta hujjat yetishmayapti. Iloji boʻlsa shu hafta ichida maktabga olib kelsangiz.",
  },
  {
    title: "Ustozlar boʻyicha fikringiz",
    text: "Assalomu alaykum. Maktab sifatini yaxshilash uchun ustozlar faoliyati boʻyicha fikringizni bilmoqchi edik. Bir necha daqiqa vaqt ajrata olasizmi?",
  },
];

/**
 * Yangi yozishma — maktab birinchi boʻlib yozadi.
 *
 * Ota-ona alohida roʻyxatda emas: oʻquvchi tanlanadi, vasiy va sinf
 * oʻquvchi kartochkasidan olinadi. Shunda notoʻgʻri odamga yozib
 * yuborish ehtimoli yoʻqoladi.
 */
function NewAppealDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { students } = useAdmin();
  const dispatch = useAdminDispatch();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminStudent | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return students
      .filter(
        (s) =>
          s.status === "active" &&
          (s.fullName.toLowerCase().includes(q) ||
            s.guardianName.toLowerCase().includes(q) ||
            s.className.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [students, query]);

  const valid = Boolean(selected && title.trim() && text.trim());

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-foreground/25 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Yangi yozishma"
        className="animate-enter my-8 w-full max-w-lg rounded-xl border border-border bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Ota-onaga yozish</h2>
            <p className="text-xs text-foreground-muted">
              Yozishma audit jurnaliga tushadi; backend ulanganda ota-ona
              kabinetiga va botga ham boradi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-tint px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-brand-dark">
                  {selected.guardianName}
                </span>
                <span className="block truncate text-xs text-foreground-muted">
                  {selected.fullName} · {selected.className} · {selected.guardianPhone}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="focus-ring shrink-0 rounded px-2 py-1 text-xs font-medium text-brand-dark hover:underline"
              >
                Oʻzgartirish
              </button>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Oʻquvchi yoki ota-ona
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ism yoki sinf boʻyicha qidiring…"
                  className={`${dialogInputClass} pl-9`}
                />
              </div>
              {query.trim().length >= 2 && (
                <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
                  {matches.map((student) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(student);
                          setQuery("");
                        }}
                        className="focus-ring-inset flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-surface-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {student.fullName}
                          </span>
                          <span className="block truncate text-xs text-foreground-muted">
                            {student.className} · vasiy: {student.guardianName}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && (
                    <li className="px-3 py-4 text-center text-sm text-foreground-muted">
                      Topilmadi.
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground">Tayyor mavzular</p>
            <div className="flex flex-wrap gap-1.5">
              {APPEAL_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.title}
                  type="button"
                  onClick={() => {
                    setTitle(tpl.title);
                    setText(tpl.text);
                  }}
                  className="focus-ring rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground-muted transition-colors hover:border-brand hover:text-brand-dark"
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Mavzu</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Toʻlov muddati haqida eslatma"
              className={dialogInputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Xabar</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Assalomu alaykum…"
              className={`${dialogInputClass} h-auto resize-none py-2`}
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-muted/50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              if (!selected) return;
              dispatch({
                type: "START_APPEAL",
                studentId: selected.id,
                title: title.trim(),
                text: text.trim(),
              });
              onCreated();
            }}
            className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            Yozishmani boshlash
          </button>
        </div>
      </div>
    </div>
  );
}

const dialogInputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

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
