"use client";

/**
 * Dars jadvali — sinf kesimida grid, toʻqnashuv nazorati bilan (T-011).
 *
 * TZ: ADM-08, ADM-09.
 *
 * Toʻqnashuvni frontend HISOBLAMAYDI. Serverga yuboriladi va u `409`
 * bilan aniq sabab qaytaradi ("Ustoz Aliyev — dushanba, 1-para band:
 * 8-A, Matematika"). Sabab: frontend faqat oʻzi koʻrgan sinf jadvalini
 * biladi, boshqa sinfdagi bandlikni koʻrmaydi — oʻzi tekshirsa yolgʻon
 * "boʻsh" deb koʻrsatardi.
 *
 * Grid mobil ekranda gorizontal scroll bilan oʻqiladi (T-011 mezoni).
 */

import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CalendarIcon, PlusIcon, XIcon } from "@/components/ui/icons";
import {
  fetchCurrentYear,
  fetchTerms,
  generateTermLessons,
  type GenerationOut,
  type TermOut,
} from "@/lib/academic/api";
import { useAccess } from "@/lib/access-api";
import {
  WEEKDAYS_UZ,
  addScheduleEntry,
  apiXato,
  archiveScheduleEntry,
  fetchSchedule,
  useSchoolDirectory,
  type ScheduleEntryOut,
} from "@/lib/school/api";

/** Nechta para koʻrsatiladi. Qoʻngʻiroqlar jadvalidan mustaqil — bu tuzish setkasi. */
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryButtonClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostButtonClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50";

export function ScheduleBoard() {
  const { subjects, classes, staff, loading, error } = useSchoolDirectory();
  const { can } = useAccess();
  const canEdit = can("schedule.manage");

  const [classId, setClassId] = useState("");
  const [entries, setEntries] = useState<ScheduleEntryOut[]>([]);
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ weekday: number; period: number } | null>(null);

  // Birinchi sinf sukut boʻyicha tanlanadi — boʻsh ekran foydasiz.
  useEffect(() => {
    if (classId === "" && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  const reloadEntries = useMemo(
    () => async (id: string) => {
      if (!id) return;
      setBusy(true);
      try {
        setEntries(await fetchSchedule({ classId: id }));
        setXato(null);
      } catch (err) {
        setXato(apiXato(err, "Jadvalni olib boʻlmadi."));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    void reloadEntries(classId);
  }, [classId, reloadEntries]);

  /** `weekday:period` → dars. Gridda har katak uchun qidirmaslik uchun. */
  const byslot = useMemo(() => {
    const map = new Map<string, ScheduleEntryOut>();
    for (const e of entries) map.set(`${e.weekday}:${e.period}`, e);
    return map;
  }, [entries]);

  const teachers = useMemo(
    () =>
      staff.filter(
        (s) => s.roles.includes("teacher") || s.roles.includes("homeroom_teacher"),
      ),
    [staff],
  );

  if (loading) return <ListSkeleton count={4} />;
  if (error) return <ErrorState description={error} />;

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon className="h-5 w-5" />}
        title="Sinf yoʻq"
        description="Jadval sinfga tuziladi. Avval «Maʼlumot bazasi → Sinflar» boʻlimida sinf oching."
      />
    );
  }

  async function remove(entryId: string) {
    setBusy(true);
    try {
      await archiveScheduleEntry(entryId);
      await reloadEntries(classId);
    } catch (err) {
      setXato(apiXato(err, "Jadvaldan chiqarib boʻlmadi."));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[10rem]">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf</span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={inputClass}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-xs text-foreground-muted">
          Haftada{" "}
          <span className="num font-medium text-foreground">{entries.length}</span> dars
        </p>
      </div>

      {xato && (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{xato}</p>
      )}

      {slot && canEdit && (
        <EntryForm
          classId={classId}
          weekday={slot.weekday}
          period={slot.period}
          subjects={subjects}
          teachers={teachers}
          onCancel={() => setSlot(null)}
          onAdded={async () => {
            setSlot(null);
            await reloadEntries(classId);
          }}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="w-16 px-3 py-3">Para</th>
                {WEEKDAYS_UZ.map((d) => (
                  <th key={d.id} className="px-3 py-3">
                    {d.long}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => (
                <tr key={period} className="border-b border-border last:border-0">
                  <td className="num px-3 py-2 align-top font-medium text-foreground-muted">
                    {period}
                  </td>
                  {WEEKDAYS_UZ.map((day) => {
                    const entry = byslot.get(`${day.id}:${period}`);
                    return (
                      <td key={day.id} className="px-1.5 py-1.5 align-top">
                        {entry ? (
                          <div className="rounded-lg border border-brand/30 bg-brand-tint px-2 py-1.5">
                            <p className="text-xs font-semibold text-brand-dark">
                              {entry.subject_name}
                            </p>
                            <p className="text-xs text-foreground-muted">
                              {entry.teacher_name}
                            </p>
                            {entry.room && (
                              <p className="num text-xs text-foreground-muted">
                                {entry.room}-xona
                              </p>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => remove(entry.id)}
                                aria-label={`${day.long}, ${period}-para darsini jadvaldan chiqarish`}
                                className="focus-ring mt-1 inline-flex items-center gap-0.5 rounded text-xs font-medium text-danger hover:underline disabled:opacity-50"
                              >
                                <XIcon className="h-3 w-3" />
                                Chiqarish
                              </button>
                            )}
                          </div>
                        ) : canEdit ? (
                          <button
                            type="button"
                            onClick={() => setSlot({ weekday: day.id, period })}
                            aria-label={`${day.long}, ${period}-paraga dars qoʻshish`}
                            className="focus-ring flex h-full min-h-[3rem] w-full items-center justify-center rounded-lg border border-dashed border-border text-foreground-muted transition-colors hover:border-brand hover:text-brand-dark"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="block min-h-[3rem]" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
          Bitta ustoz yoki xona ayni vaqtda ikki joyda boʻla olmaydi — saqlashda
          tekshiriladi. Jadvaldan chiqarilgan dars oʻchmaydi, arxivlanadi.
        </p>
      </div>

      {canEdit && <GenerateLessonsCard />}
    </div>
  );
}

// ─────────────────────── Darslarni yaratish ───────────────────────

/** Bugungi mahalliy sana `YYYY-MM-DD` — chorakni sukut boʻyicha tanlash uchun. */
const LOCAL_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
});

/**
 * Jadval — haftalik shablon; ustoz kabineti esa konkret sanali
 * `lessons` yozuvlarini koʻradi (T-012). Shu karta ikkisini bogʻlaydi:
 * tanlangan chorak uchun darslarni generatsiya qiladi.
 *
 * Qayta bosish xavfsiz — server idempotent, mavjud dars oʻzgarmaydi.
 * Jadvalga yangi dars qoʻshilgach ham shu tugma yetarli: faqat
 * yetishmayotgani yaratiladi.
 */
function GenerateLessonsCard() {
  const [terms, setTerms] = useState<TermOut[] | null>(null);
  const [termId, setTermId] = useState("");
  const [busy, setBusy] = useState(false);
  const [natija, setNatija] = useState<GenerationOut | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCurrentYear()
      .then((yil) => (yil === null ? [] : fetchTerms(yil.id)))
      .then((t) => {
        if (!alive) return;
        setTerms(t);
        // Sukut — bugun ichida turgan chorak; boʻlmasa keyingisi, u ham
        // boʻlmasa oxirgisi (yil tugagach ham qayta generatsiya mumkin).
        const bugun = LOCAL_DATE_FMT.format(new Date());
        const joriy =
          t.find((c) => c.starts_on <= bugun && bugun <= c.ends_on) ??
          t.find((c) => c.starts_on > bugun) ??
          t[t.length - 1];
        if (joriy) setTermId(joriy.id);
      })
      .catch(() => alive && setTerms([]));
    return () => {
      alive = false;
    };
  }, []);

  async function yarat() {
    if (!termId) return;
    setBusy(true);
    setXato(null);
    setNatija(null);
    try {
      setNatija(await generateTermLessons(termId));
    } catch (err) {
      setXato(apiXato(err, "Darslarni yaratib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Darslarni yaratish</h2>
      <p className="mt-1 text-xs text-foreground-muted">
        Jadval — haftalik shablon. Ustoz kabineti (davomat, jurnal) esa konkret
        sanali darslarni koʻradi — ular shu yerda chorak uchun yaratiladi.
        Jadvalni oʻzgartirgach qayta bosish xavfsiz: mavjud darslar va ulardagi
        davomat oʻzgarmaydi, faqat yetishmayotgani qoʻshiladi.
      </p>

      {terms === null ? (
        <p className="mt-3 text-sm text-foreground-muted">Choraklar yuklanmoqda…</p>
      ) : terms.length === 0 ? (
        <p className="mt-3 rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
          Choraklar belgilanmagan. Avval «Kalendar» tabida oʻquv yili va
          choraklarni kiriting.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem]">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Chorak</span>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className={inputClass}
            >
              {terms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.starts_on} — {c.ends_on})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || termId === ""}
            onClick={() => void yarat()}
            className={primaryButtonClass}
          >
            {busy ? "Yaratilmoqda…" : "Darslarni yaratish"}
          </button>
        </div>
      )}

      {xato && (
        <p className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{xato}</p>
      )}

      {natija && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="rounded-lg bg-success-tint px-3 py-2 text-sm text-success">
            <span className="num font-semibold">{natija.created}</span> ta dars yaratildi
            {natija.skipped_existing > 0 && (
              <>
                {" · "}
                <span className="num">{natija.skipped_existing}</span> tasi allaqachon bor edi
              </>
            )}
            {natija.skipped_holidays > 0 && (
              <>
                {" · "}
                <span className="num">{natija.skipped_holidays}</span> ta taʼtil kuni
                oʻtkazib yuborildi
              </>
            )}
            {" "}
            (<span className="num">{natija.date_from} — {natija.date_to}</span>)
          </p>
          {natija.missing_bells.length > 0 && (
            <p className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
              {natija.missing_bells.join(", ")}-paralar uchun qoʻngʻiroq vaqti
              belgilanmagan — bu paradagi darslar yaratilmadi. «Kalendar» tabida
              qoʻngʻiroqlar jadvalini toʻldirib, qayta yarating.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Dars qoʻshish ───────────────────────────

function EntryForm({
  classId,
  weekday,
  period,
  subjects,
  teachers,
  onCancel,
  onAdded,
}: {
  classId: string;
  weekday: number;
  period: number;
  subjects: { id: string; name: string }[];
  teachers: { user_id: string; full_name: string; subject_ids: string[] }[];
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  /**
   * Shu fanni oʻqitadigan ustozlar birinchi navbatda.
   *
   * Qolganlari ham roʻyxatda qoladi: vaqtincha almashtirish (ADM-10)
   * odatiy hol, uni butunlay taqiqlash jadvalni tuzishga xalaqit
   * berardi.
   */
  const [mos, qolgan] = useMemo(() => {
    const a = teachers.filter((t) => t.subject_ids.includes(subjectId));
    const b = teachers.filter((t) => !t.subject_ids.includes(subjectId));
    return [a, b];
  }, [teachers, subjectId]);

  useEffect(() => {
    setTeacherId((joriy) => {
      if (joriy && teachers.some((t) => t.user_id === joriy)) return joriy;
      return mos[0]?.user_id ?? teachers[0]?.user_id ?? "";
    });
  }, [mos, teachers]);

  const kun = WEEKDAYS_UZ.find((d) => d.id === weekday)?.long ?? "";
  const valid = subjectId !== "" && teacherId !== "";

  async function submit() {
    setSaving(true);
    setXato(null);
    try {
      await addScheduleEntry({
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        weekday,
        period,
        room: room.trim() || null,
      });
      onAdded();
    } catch (err) {
      setXato(apiXato(err, "Darsni qoʻshib boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {kun}, <span className="num">{period}</span>-para — dars qoʻshish
      </h3>

      {xato && (
        <p className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{xato}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Fan</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={inputClass}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Ustoz</span>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className={inputClass}
          >
            {mos.length > 0 && (
              <optgroup label="Shu fan ustozlari">
                {mos.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.full_name}
                  </option>
                ))}
              </optgroup>
            )}
            {qolgan.length > 0 && (
              <optgroup label="Boshqa ustozlar">
                {qolgan.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.full_name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Xona</span>
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value.slice(0, 30))}
            placeholder="204"
            className={`${inputClass} num`}
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!valid || saving}
          onClick={submit}
          className={primaryButtonClass}
        >
          {saving ? "Qoʻshilmoqda…" : "Jadvalga qoʻshish"}
        </button>
        <button type="button" onClick={onCancel} className={ghostButtonClass}>
          Bekor qilish
        </button>
      </div>
    </section>
  );
}
