"use client";

/**
 * Oʻquv yili — chorak sanalari, taʼtillar, qoʻngʻiroqlar jadvali (T-007).
 *
 * Maʼlumot serverdan keladi (`/api/v1/academic`), mock'dan emas.
 *
 * Choraklar va paralar YAXLIT saqlanadi: bittasini oʻzgartirsangiz ham
 * butun roʻyxat yuboriladi. Sabab serverda — sanalar qoplanishini faqat
 * toʻplam ustidan tekshirib boʻladi. Shu bois tahrirlash "qoralama"
 * holatida turadi va «Oʻzgarishlarni saqlash» bosilganda ketadi.
 *
 * Yozish `schedule.manage` huquqini talab qiladi. Tugmani yashirish —
 * qulaylik, himoya emas: serverda ham tekshiriladi (CLAUDE.md 7-qoida).
 */

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ConfirmArchiveButton } from "@/components/admin/ConfirmArchiveButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CalendarIcon, ClockIcon, PlusIcon, SunriseIcon } from "@/components/ui/icons";
import {
  addHoliday,
  archiveHoliday,
  saveBells,
  saveTerms,
  shortTime,
  useAcademicCalendar,
  type BellInput,
  type TermInput,
} from "@/lib/academic/api";
import { useAccess } from "@/lib/access-api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryButtonClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostButtonClass =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50";

/** Ikki sana orasidagi toʻliq haftalar soni. */
function weeksBetween(from: string, to: string): number {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return Math.max(0, Math.round(days / 7));
}

/** Bugungi sana — Asia/Tashkent. `en-CA` ISO shaklida beradi. */
const TODAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localToday(): string {
  return TODAY_FMT.format(new Date());
}

/** Serverdan kelgan xato matni — foydalanuvchiga koʻrsatiladi. */
function xatoMatni(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

export function AcademicCalendarTab() {
  const { year, terms, holidays, bells, loading, error, reload } = useAcademicCalendar();
  const { can } = useAccess();
  const canEdit = can("schedule.manage");

  if (loading) return <ListSkeleton count={4} />;
  if (error) return <ErrorState description={error} />;

  if (year === null) {
    return (
      <EmptyState
        icon={<CalendarIcon className="h-5 w-5" />}
        title="Joriy oʻquv yili belgilanmagan"
        description="Chorak sanalari, taʼtillar va dars vaqtlari oʻquv yiliga bogʻlanadi. Avval oʻquv yilini ochib, uni joriy deb belgilang."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Joriy oʻquv yili: <span className="num">{year.name}</span>
            </h2>
            <p className="num mt-0.5 text-xs text-foreground-muted">
              {year.starts_on} — {year.ends_on}
            </p>
          </div>
          <Badge tone="success">Joriy</Badge>
        </div>
        {!canEdit && (
          <p className="mt-2 text-xs text-foreground-muted">
            Sizda tahrirlash huquqi yoʻq. Oʻzgartirish uchun super administratordan
            «Dars jadvalini boshqarish» huquqini soʻrang.
          </p>
        )}
      </section>

      <TermsTable
        yearId={year.id}
        yearStart={year.starts_on}
        yearEnd={year.ends_on}
        terms={terms}
        canEdit={canEdit}
        onSaved={reload}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HolidaysCard
          yearId={year.id}
          holidays={holidays}
          canEdit={canEdit}
          onChanged={reload}
        />
        <BellsCard yearId={year.id} bells={bells} canEdit={canEdit} onSaved={reload} />
      </div>
    </div>
  );
}

// ─────────────────────────── Choraklar ───────────────────────────

type TermDraft = TermInput;

function TermsTable({
  yearId,
  yearStart,
  yearEnd,
  terms,
  canEdit,
  onSaved,
}: {
  yearId: string;
  yearStart: string;
  yearEnd: string;
  terms: { id: string; index: number; name: string; starts_on: string; ends_on: string }[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<TermDraft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const today = localToday();

  // Serverdan yangi maʼlumot kelganda qoralama tiklanadi.
  useEffect(() => {
    setDraft(
      terms.map((t) => ({
        index: t.index,
        name: t.name,
        starts_on: t.starts_on,
        ends_on: t.ends_on,
      })),
    );
    setDirty(false);
    setXato(null);
  }, [terms]);

  function patch(index: number, field: "starts_on" | "ends_on", value: string) {
    setDraft((rows) =>
      rows.map((r) => (r.index === index ? { ...r, [field]: value } : r)),
    );
    setDirty(true);
  }

  function addTerm() {
    const keyingi = draft.length === 0 ? 1 : Math.max(...draft.map((r) => r.index)) + 1;
    if (keyingi > 4) return;
    setDraft((rows) => [
      ...rows,
      {
        index: keyingi,
        name: `${keyingi}-chorak`,
        starts_on: yearStart,
        ends_on: yearEnd,
      },
    ]);
    setDirty(true);
  }

  /** Roʻyxatdan chiqarish — serverda arxivlanadi, oʻchmaydi (1-qoida). */
  function removeTerm(index: number) {
    setDraft((rows) => rows.filter((r) => r.index !== index));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setXato(null);
    try {
      await saveTerms(yearId, draft);
      onSaved();
    } catch (err) {
      setXato(xatoMatni(err, "Choraklarni saqlab boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  const notogri = draft.some((r) => r.starts_on >= r.ends_on);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Chorak sanalari</h2>
        {canEdit && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={addTerm}
              disabled={draft.length >= 4}
              className={ghostButtonClass}
            >
              <PlusIcon className="mr-1 h-4 w-4" />
              Chorak qoʻshish
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving || notogri || draft.length === 0}
              className={primaryButtonClass}
            >
              {saving ? "Saqlanmoqda…" : "Oʻzgarishlarni saqlash"}
            </button>
          </div>
        )}
      </div>

      {xato && (
        <p className="border-b border-danger-tint bg-danger-tint px-4 py-2 text-xs text-danger">
          {xato}
        </p>
      )}

      {draft.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<CalendarIcon className="h-5 w-5" />}
            title="Choraklar kiritilmagan"
            description="Jurnal, baho va hisobotlar chorak sanalariga tayanadi."
          />
        </div>
      ) : (
        <div className="scroll-x">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">Chorak</th>
                <th className="px-3 py-3">Boshlanishi</th>
                <th className="px-3 py-3">Tugashi</th>
                <th className="px-3 py-3">Haftalar</th>
                <th className="px-3 py-3">Holati</th>
                {canEdit && <th className="px-3 py-3" />}
              </tr>
            </thead>
            <tbody>
              {draft.map((row) => {
                const joriy = today >= row.starts_on && today <= row.ends_on;
                const teskari = row.starts_on >= row.ends_on;
                return (
                  <tr
                    key={row.index}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-2.5">
                      {canEdit ? (
                        <input
                          type="date"
                          aria-label={`${row.name} boshlanishi`}
                          min={yearStart}
                          max={yearEnd}
                          value={row.starts_on}
                          onChange={(e) => patch(row.index, "starts_on", e.target.value)}
                          className={`${inputClass} ${teskari ? "border-danger" : ""}`}
                        />
                      ) : (
                        <span className="num text-foreground-muted">{row.starts_on}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEdit ? (
                        <input
                          type="date"
                          aria-label={`${row.name} tugashi`}
                          min={yearStart}
                          max={yearEnd}
                          value={row.ends_on}
                          onChange={(e) => patch(row.index, "ends_on", e.target.value)}
                          className={`${inputClass} ${teskari ? "border-danger" : ""}`}
                        />
                      ) : (
                        <span className="num text-foreground-muted">{row.ends_on}</span>
                      )}
                    </td>
                    <td className="num px-3 py-2.5 text-foreground-muted">
                      {weeksBetween(row.starts_on, row.ends_on)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={joriy ? "success" : "neutral"}>
                        {joriy ? "Joriy" : today > row.ends_on ? "Tugagan" : "Rejada"}
                      </Badge>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeTerm(row.index)}
                          className="focus-ring rounded px-2 py-1 text-xs font-medium text-danger transition-colors hover:underline"
                        >
                          Roʻyxatdan chiqarish
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
        Chorak sanalari jurnal, baho va hisobotlarga taʼsir qiladi — oʻzgarish audit
        jurnaliga tushadi. Roʻyxatdan chiqarilgan chorak oʻchmaydi, arxivlanadi.
      </p>
    </div>
  );
}

// ─────────────────────────── Taʼtillar ───────────────────────────

function HolidaysCard({
  yearId,
  holidays,
  canEdit,
  onChanged,
}: {
  yearId: string;
  holidays: { id: string; day: string; title: string }[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [day, setDay] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setXato(null);
    try {
      await addHoliday(yearId, day, title.trim());
      setDay("");
      setTitle("");
      onChanged();
    } catch (err) {
      setXato(xatoMatni(err, "Taʼtil kunini qoʻshib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setXato(null);
    try {
      await archiveHoliday(id);
      onChanged();
    } catch (err) {
      setXato(xatoMatni(err, "Taʼtil kunini chiqarib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  const valid = day !== "" && title.trim().length >= 2;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Taʼtil va bayramlar</h2>
      <p className="mb-3 text-xs text-foreground-muted">
        Bu kunlarga dars yaratilmaydi va davomat soʻralmaydi.
      </p>

      {xato && <p className="mb-2 text-xs text-danger">{xato}</p>}

      {holidays.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-foreground-muted">
          Taʼtil kuni kiritilmagan.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {holidays.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5 text-sm"
            >
              <span className="flex items-center gap-2">
                <SunriseIcon className="h-4 w-4 shrink-0 text-foreground-muted" />
                <span className="num text-foreground-muted">{h.day}</span>
                <span className="font-medium text-foreground">{h.title}</span>
              </span>
              {canEdit && (
                <ConfirmArchiveButton
                  disabled={busy}
                  onConfirm={() => void remove(h.id)}
                  label="Chiqarish"
                  question="Taʼtil kuni chiqarilsinmi?"
                  className="focus-ring shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-danger transition-colors hover:underline disabled:opacity-50"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[9rem] flex-1">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sana</span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="min-w-[9rem] flex-[2]">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Nomi</span>
            <input
              type="text"
              value={title}
              placeholder="Masalan: Navroʻz"
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={add}
            className={primaryButtonClass}
          >
            <PlusIcon className="h-4 w-4" />
            Qoʻshish
          </button>
        </div>
      )}
    </section>
  );
}

// ─────────────────────── Qoʻngʻiroqlar jadvali ───────────────────────

function BellsCard({
  yearId,
  bells,
  canEdit,
  onSaved,
}: {
  yearId: string;
  bells: { id: string; period: number; starts_at: string; ends_at: string }[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<BellInput[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    setDraft(
      bells.map((b) => ({
        period: b.period,
        starts_at: shortTime(b.starts_at),
        ends_at: shortTime(b.ends_at),
      })),
    );
    setDirty(false);
    setXato(null);
  }, [bells]);

  function patch(period: number, field: "starts_at" | "ends_at", value: string) {
    setDraft((rows) =>
      rows.map((r) => (r.period === period ? { ...r, [field]: value } : r)),
    );
    setDirty(true);
  }

  function addPeriod() {
    const keyingi = draft.length === 0 ? 1 : Math.max(...draft.map((r) => r.period)) + 1;
    if (keyingi > 8) return;
    const oxirgi = draft.at(-1);
    setDraft((rows) => [
      ...rows,
      { period: keyingi, starts_at: oxirgi?.ends_at ?? "08:30", ends_at: "" },
    ]);
    setDirty(true);
  }

  function removePeriod(period: number) {
    setDraft((rows) => rows.filter((r) => r.period !== period));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setXato(null);
    try {
      await saveBells(yearId, draft);
      onSaved();
    } catch (err) {
      setXato(xatoMatni(err, "Dars vaqtlarini saqlab boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  const notogri = draft.some(
    (r) => r.starts_at === "" || r.ends_at === "" || r.starts_at >= r.ends_at,
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Dars vaqtlari</h2>
        {canEdit && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={addPeriod}
              disabled={draft.length >= 8}
              className={ghostButtonClass}
            >
              <PlusIcon className="mr-1 h-4 w-4" />
              Para
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving || notogri || draft.length === 0}
              className={primaryButtonClass}
            >
              {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        )}
      </div>
      <p className="mb-3 text-xs text-foreground-muted">
        Vaqt Toshkent boʻyicha. Davomat oynasi dars tugashidan hisoblanadi.
      </p>

      {xato && <p className="mb-2 text-xs text-danger">{xato}</p>}

      {draft.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-foreground-muted">
          Qoʻngʻiroqlar jadvali kiritilmagan.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {draft.map((row) => (
            <li
              key={row.period}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5"
            >
              <span className="num flex w-16 shrink-0 items-center gap-1 text-foreground-muted">
                <ClockIcon className="h-3.5 w-3.5" />
                {row.period}-dars
              </span>
              {canEdit ? (
                <>
                  <input
                    type="time"
                    aria-label={`${row.period}-dars boshlanishi`}
                    value={row.starts_at}
                    onChange={(e) => patch(row.period, "starts_at", e.target.value)}
                    className={`${inputClass} w-28`}
                  />
                  <input
                    type="time"
                    aria-label={`${row.period}-dars tugashi`}
                    value={row.ends_at}
                    onChange={(e) => patch(row.period, "ends_at", e.target.value)}
                    className={`${inputClass} w-28`}
                  />
                  <button
                    type="button"
                    onClick={() => removePeriod(row.period)}
                    className="focus-ring ml-auto rounded px-1.5 py-0.5 text-xs font-medium text-danger transition-colors hover:underline"
                  >
                    Chiqarish
                  </button>
                </>
              ) : (
                <span className="num ml-auto font-medium text-foreground">
                  {row.starts_at} – {row.ends_at}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
