"use client";

/**
 * Oʻquvchi kartochkasi (ADM-05, ADM-06).
 *
 * Shaxsiy maʼlumot SHU YERDA va faqat shu yerda: tugʻilgan sana,
 * vasiylar va ularning telefoni. Roʻyxatda ular yoʻq (X-6) — roʻyxat
 * koʻproq odamga ochiq va eksport qilinadi.
 *
 * Oʻchirish tugmasi ATAYLAB yoʻq. Arxivlash bor va sabab majburiy:
 * ketgan oʻquvchining baholari va toʻlovlari hisobotda qolishi kerak
 * (CLAUDE.md 1-qoida), «nega ketdi» hisoboti esa sababdan chiqadi.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { XIcon } from "@/components/ui/icons";
import {
  apiXato,
  archiveStudent,
  createGuardian,
  fetchGuardians,
  fetchStudentCard,
  makePrimaryGuardian,
  moveStudent,
  restoreStudent,
  unlinkGuardian,
  type ClassOut,
  type GuardianRowOut,
  type StudentCardOut,
} from "@/lib/school/api";

const RELATION_LABELS: Record<string, string> = {
  father: "Otasi",
  mother: "Onasi",
  guardian: "Vasiy",
};

/** Vasiylikni uzish sabablari — bu kirish huquqini yopadi, izsiz qolmaydi. */
const UNLINK_REASONS = [
  "Ota-ona ajrashdi",
  "Vasiylik boshqa odamga oʻtdi",
  "Xato biriktirilgan edi",
  "Ota-onaning oʻz iltimosi",
];

/** Ketish sabablari — «nega ketdi» hisoboti shundan chiqadi. */
const ARCHIVE_REASONS = [
  "Boshqa maktabga oʻtdi",
  "Boshqa shaharga koʻchdi",
  "Ota-ona arizasi asosida",
  "Maktabni tugatdi",
];

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50";

export function StudentCard({
  studentId,
  classes,
  canManage,
  onClose,
  onChanged,
}: {
  studentId: string;
  classes: ClassOut[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [card, setCard] = useState<StudentCardOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState(ARCHIVE_REASONS[0]);

  const yukla = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCard(await fetchStudentCard(studentId));
    } catch (err) {
      // Ruxsat yoʻq boʻlsa server `403` beradi, `404` emas — obyekt
      // mavjudligini oshkor qilmaslik uchun (X-3).
      setError(apiXato(err, "Kartochkani ochib boʻlmadi."));
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  // Escape bilan yopish — panel modal kabi ishlaydi.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function amal(f: () => Promise<StudentCardOut>) {
    setBusy(true);
    setError(null);
    try {
      setCard(await f());
      onChanged();
    } catch (err) {
      setError(apiXato(err, "Amalni bajarib boʻlmadi."));
    } finally {
      setBusy(false);
      setArchiving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Oʻquvchi kartochkasi"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {card?.full_name ?? "Yuklanmoqda…"}
            </h2>
            {card && (
              <p className="mt-0.5 text-sm text-foreground-muted">
                {card.class_name ?? "sinfsiz"}
                {card.is_archived && (
                  <span className="ml-2">
                    <Badge tone="neutral">Arxivlangan</Badge>
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="focus-ring shrink-0 rounded-lg p-1.5 text-foreground-muted hover:bg-surface-muted"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

          {loading ? (
            <ListSkeleton count={3} />
          ) : card === null ? (
            !error && <ErrorState />
          ) : (
            <>
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Maʼlumot
                </h3>
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-foreground-muted">Familiya, ism</dt>
                    <dd className="text-right font-medium text-foreground">
                      {card.last_name} {card.first_name}
                    </dd>
                  </div>
                  {card.middle_name && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-foreground-muted">Otasining ismi</dt>
                      <dd className="text-right text-foreground">{card.middle_name}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-foreground-muted">Tugʻilgan sana</dt>
                    <dd className="num text-right text-foreground">
                      {card.birth_date ?? "—"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Vasiylar
                </h3>
                <GuardianSection
                  studentId={card.id}
                  canManage={canManage && !card.is_archived}
                  onChanged={onChanged}
                />
              </section>

              {canManage && !card.is_archived && (
                <section className="border-t border-border pt-4">
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    Amallar
                  </h3>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-foreground">
                      Sinfni oʻzgartirish
                    </span>
                    <select
                      value={card.class_id ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        void amal(() => moveStudent(card.id, e.target.value || null))
                      }
                      className={inputClass}
                    >
                      <option value="">Sinfsiz</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {archiving ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-danger/30 p-3">
                      <p className="text-xs text-foreground-muted">
                        Oʻquvchi <strong>oʻchirilmaydi</strong> — arxivlanadi. Baholari va
                        toʻlovlari hisobotda qoladi. Sabab majburiy: «nega ketdi» hisoboti
                        shundan chiqadi.
                      </p>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className={inputClass}
                      >
                        {ARCHIVE_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void amal(() => archiveStudent(card.id, reason))}
                          className="focus-ring inline-flex h-9 items-center rounded-lg bg-danger px-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Arxivlash
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchiving(false)}
                          className={ghostBtn}
                        >
                          Bekor
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setArchiving(true)}
                      className="focus-ring mt-3 inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-tint"
                    >
                      Arxivga oʻtkazish
                    </button>
                  )}
                </section>
              )}

              {canManage && card.is_archived && (
                <section className="border-t border-border pt-4">
                  <p className="mb-2 text-xs text-foreground-muted">
                    Xato bilan arxivlangan boʻlsa qaytarish mumkin.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void amal(() => restoreStudent(card.id))}
                    className={ghostBtn}
                  >
                    Arxivdan qaytarish
                  </button>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}


/**
 * Vasiylar — oʻquvchini ota-ona kabineti bilan bogʻlaydigan yagona joy.
 *
 * Bu boʻlim `guardians` jadvalini oʻzgartiradi, ya'ni **kim nimani
 * koʻrishini** oʻzgartiradi (X-1). Shu sabab bu yerda ikkita narsa
 * ataylab qilingan:
 *
 *   · Uzish tugmasi «oʻchirish» demaydi va sabab soʻraydi — bogʻlanish
 *     arxivlanadi, tarixi qoladi.
 *   · Yangi hisob ochilganda boshlangʻich parol BIR MARTA koʻrsatiladi
 *     va yopilgach qayta chiqmaydi: bazada faqat xeshi bor.
 */
function GuardianSection({
  studentId,
  canManage,
  onChanged,
}: {
  studentId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<GuardianRowOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    last_name: "",
    first_name: "",
    phone: "",
    relation: "father",
  });
  const [parol, setParol] = useState<{ login: string; password: string } | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [reason, setReason] = useState(UNLINK_REASONS[0]);

  const yukla = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchGuardians(studentId));
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Vasiylarni olib boʻlmadi."));
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function amal(f: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await f();
      await yukla();
      onChanged();
    } catch (err) {
      // Telefon takrorlansa server kim ekanini aytadi — shuni koʻrsatamiz.
      setError(apiXato(err, "Amalni bajarib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ListSkeleton count={2} />;

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      {parol && (
        <div className="rounded-lg border border-brand/40 bg-brand/5 p-3">
          <p className="text-sm font-medium text-foreground">Hisob ochildi</p>
          <p className="mt-1 text-xs text-foreground-muted">
            Parol faqat hozir koʻrinadi — bazada saqlanmaydi. Egasiga yetkazing, u
            birinchi kirishda almashtiradi.
          </p>
          <p className="num mt-2 text-sm text-foreground">
            Login: <strong>{parol.login}</strong> · Parol: <strong>{parol.password}</strong>
          </p>
          <button type="button" onClick={() => setParol(null)} className={`${ghostBtn} mt-2`}>
            Yozib oldim
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
          Vasiy biriktirilmagan — ota-ona kabinetiga kira olmaydi.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((g) => (
            <li key={g.id} className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {g.full_name}
                  {g.is_primary && (
                    <span className="ml-2">
                      <Badge tone="success">Asosiy</Badge>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="info">{RELATION_LABELS[g.relation] ?? g.relation}</Badge>
                  {g.phone && (
                    <a
                      href={`tel:${g.phone}`}
                      className="num text-xs text-brand-dark hover:underline"
                    >
                      {g.phone}
                    </a>
                  )}
                </span>
              </div>
              <p className="num mt-0.5 text-xs text-foreground-muted">
                {g.login}
                {g.children_count > 1 && ` · ${g.children_count} farzand`}
              </p>

              {canManage && unlinking === g.id ? (
                <div className="mt-2 flex flex-col gap-2 rounded-lg border border-danger/30 p-2">
                  <p className="text-xs text-foreground-muted">
                    Bogʻlanish uzilsa bu odam farzandi maʼlumotini{" "}
                    <strong>shu zahoti</strong> koʻra olmaydi. Yozuv oʻchirilmaydi —
                    sabab bilan arxivlanadi.
                  </p>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={inputClass}
                  >
                    {UNLINK_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void amal(() => unlinkGuardian(studentId, g.id, reason)).then(() =>
                          setUnlinking(null),
                        );
                      }}
                      className="focus-ring inline-flex h-8 items-center rounded-lg bg-danger px-3 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Uzish
                    </button>
                    <button type="button" onClick={() => setUnlinking(null)} className={ghostBtn}>
                      Bekor
                    </button>
                  </span>
                </div>
              ) : (
                canManage && (
                  <span className="mt-1 flex gap-2">
                    {!g.is_primary && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void amal(() => makePrimaryGuardian(studentId, g.id))}
                        className="focus-ring rounded px-1.5 py-0.5 text-xs font-medium text-brand-dark hover:underline disabled:opacity-40"
                      >
                        Asosiy qilish
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setUnlinking(g.id)}
                      className="focus-ring rounded px-1.5 py-0.5 text-xs font-medium text-foreground-muted hover:text-danger disabled:opacity-40"
                    >
                      Bogʻlanishni uzish
                    </button>
                  </span>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void amal(async () => {
                const javob = await createGuardian(studentId, {
                  last_name: form.last_name.trim(),
                  first_name: form.first_name.trim(),
                  phone: form.phone.trim() || null,
                  relation: form.relation,
                  // Birinchi vasiy avtomatik asosiy: xabarnoma
                  // manzilsiz qolmasin.
                  is_primary: rows.length === 0,
                });
                setParol({
                  login: javob.guardian.login,
                  password: javob.initial_password,
                });
                setForm({ last_name: "", first_name: "", phone: "", relation: "father" });
                setAdding(false);
              });
            }}
            className="flex flex-col gap-2 rounded-lg border border-border p-3"
          >
            <p className="text-xs text-foreground-muted">
              Yangi hisob ochiladi. Agar bu odamning maktabda boshqa farzandi boʻlsa,
              telefon boʻyicha aniqlanadi va mavjud hisobga bogʻlash taklif qilinadi.
            </p>
            <span className="flex gap-2">
              <input
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Familiya"
                className={inputClass}
              />
              <input
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Ism"
                className={inputClass}
              />
            </span>
            <span className="flex gap-2">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+998 90 123 45 67"
                inputMode="tel"
                className={inputClass}
              />
              <select
                value={form.relation}
                onChange={(e) => setForm({ ...form, relation: e.target.value })}
                className={inputClass}
              >
                {Object.entries(RELATION_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </span>
            <span className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className={ghostBtn}>
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={busy}
                className="focus-ring inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground disabled:opacity-50"
              >
                Hisob ochib bogʻlash
              </button>
            </span>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={ghostBtn}>
            Vasiy qoʻshish
          </button>
        ))}
    </div>
  );
}
