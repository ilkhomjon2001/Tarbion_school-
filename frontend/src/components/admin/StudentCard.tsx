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

import { StudentDossier } from "@/components/admin/StudentDossier";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  ArchiveIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  UnlinkIcon,
  XIcon,
} from "@/components/ui/icons";
import {
  apiXato,
  archiveStudent,
  createGuardian,
  fetchGuardians,
  fetchStudentCard,
  linkGuardian,
  lookupGuardianByPhone,
  makePrimaryGuardian,
  moveStudent,
  restoreStudent,
  unlinkGuardian,
  updateGuardian,
  updateStudent,
  type ClassOut,
  type GuardianPhoneMatchOut,
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

const primaryBtn =
  "focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

/**
 * Qator ichidagi kichik amal tugmasi.
 *
 * Ilgari bular tagi chiziladigan matn edi — tugmaga oʻxshamasdi va
 * telefonda barmoq tegadigan maydoni yoʻq edi. Endi ramkali, 36px
 * balandlikda va yonida belgisi bor.
 */
const rowBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition-colors hover:border-brand hover:text-brand-dark disabled:opacity-40";

const rowBtnDanger =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-40";

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

  const [dossier, setDossier] = useState(false);
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

          {/* Bu kartochka TAHRIRLASH uchun. Davomat sabablari, tarbiya,
              suhbatlar va toʻlov yigʻma kartochkada — u faqat oʻqiladi,
              shuning uchun alohida. */}
          {card !== null && (
            <button
              type="button"
              onClick={() => setDossier(true)}
              className="focus-ring rounded-lg border border-border px-3 py-2 text-sm font-medium text-brand-dark hover:bg-surface-muted"
            >
              Yigʻma kartochkani ochish
            </button>
          )}

          {loading ? (
            <ListSkeleton count={3} />
          ) : card === null ? (
            !error && <ErrorState />
          ) : (
            <>
              <StudentInfoSection
                card={card}
                canManage={canManage && !card.is_archived}
                onSaved={(yangi) => {
                  setCard(yangi);
                  onChanged();
                }}
              />

              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Vasiylar
                </h3>
                <GuardianSection
                  studentId={card.id}
                  studentName={card.full_name}
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
                      className="focus-ring mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger/40 px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-tint"
                    >
                      <ArchiveIcon className="h-4 w-4" />
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

      {dossier && <StudentDossier studentId={studentId} onClose={() => setDossier(false)} />}
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
  studentName,
  canManage,
  onChanged,
}: {
  studentId: string;
  studentName: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<GuardianRowOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [parol, setParol] = useState<{ login: string; password: string } | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
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
              {(g.address || g.profession) && (
                <p className="mt-0.5 text-xs text-foreground-muted">
                  {[g.profession, g.address].filter(Boolean).join(" · ")}
                </p>
              )}

              {canManage && editing === g.id ? (
                <GuardianEditForm
                  studentId={studentId}
                  guardian={g}
                  onCancel={() => setEditing(null)}
                  onSaved={() => {
                    setEditing(null);
                    void yukla();
                    onChanged();
                  }}
                />
              ) : canManage && unlinking === g.id ? (
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
                      className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-danger px-3 text-sm font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
                    >
                      <UnlinkIcon className="h-4 w-4" />
                      Uzish
                    </button>
                    <button type="button" onClick={() => setUnlinking(null)} className={ghostBtn}>
                      Bekor
                    </button>
                  </span>
                </div>
              ) : (
                canManage && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditing(g.id)}
                      className={rowBtn}
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      Tahrirlash
                    </button>
                    {!g.is_primary && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void amal(() => makePrimaryGuardian(studentId, g.id))}
                        className={rowBtn}
                      >
                        <StarIcon className="h-3.5 w-3.5" />
                        Asosiy qilish
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setUnlinking(g.id)}
                      className={rowBtnDanger}
                    >
                      <UnlinkIcon className="h-3.5 w-3.5" />
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
          <GuardianAddForm
            studentId={studentId}
            studentName={studentName}
            isFirst={rows.length === 0}
            busy={busy}
            onCancel={() => setAdding(false)}
            onCreate={(input) =>
              amal(async () => {
                const javob = await createGuardian(studentId, input);
                setParol({
                  login: javob.guardian.login,
                  password: javob.initial_password,
                });
                setAdding(false);
              })
            }
            onLink={(userId, relation, isPrimary) =>
              amal(async () => {
                await linkGuardian(studentId, userId, relation, isPrimary);
                setAdding(false);
              })
            }
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`${ghostBtn} gap-1.5`}
          >
            <PlusIcon className="h-4 w-4" />
            Vasiy qoʻshish
          </button>
        ))}
    </div>
  );
}

/**
 * Vasiy qoʻshish — telefon RAQAMDAN boshlanadi.
 *
 * Sabab: raqam odamning kaliti. Maktabda ikkinchi farzandi bor
 * ota-onaga yangi hisob ochilmasligi kerak — aks holda u ikkita login
 * bilan ikkita kabinetga kirib, har birida bitta farzandini koʻradi.
 *
 * Ilgari bu faqat yuborilgandan keyin `409` bilan bilinardi va mavjud
 * hisobga bogʻlash yoʻli interfeysda umuman yoʻq edi. Endi raqam
 * kiritilishi bilan tekshiriladi va savol beriladi.
 */
function GuardianAddForm({
  studentId,
  studentName,
  isFirst,
  busy,
  onCancel,
  onCreate,
  onLink,
}: {
  studentId: string;
  studentName: string;
  isFirst: boolean;
  busy: boolean;
  onCancel: () => void;
  onCreate: (input: {
    last_name: string;
    first_name: string;
    phone: string | null;
    relation: string;
    is_primary: boolean;
  }) => void;
  onLink: (userId: string, relation: string, isPrimary: boolean) => void;
}) {
  const [form, setForm] = useState({
    last_name: "",
    first_name: "",
    phone: "",
    relation: "father",
  });
  const [topildi, setTopildi] = useState<GuardianPhoneMatchOut | null>(null);
  const [qidirmoqda, setQidirmoqda] = useState(false);

  const raqam = form.phone.replace(/\D/g, "");

  // Raqam toʻliqroq boʻlgach qidiramiz. 9 ta raqam — «901234567»;
  // shu chegaradan pastda har harfda soʻrov yuborishning maʼnosi yoʻq.
  useEffect(() => {
    if (raqam.length < 9) {
      setTopildi(null);
      return;
    }
    let bekor = false;
    setQidirmoqda(true);
    const t = setTimeout(async () => {
      try {
        const m = await lookupGuardianByPhone(studentId, raqam);
        if (!bekor) setTopildi(m);
      } catch {
        // Qidiruv yiqilsa shakl ishlayveradi: server baribir `409`
        // bilan toʻxtatadi, faqat ogohlantirish oldinroq kelmaydi.
        if (!bekor) setTopildi(null);
      } finally {
        if (!bekor) setQidirmoqda(false);
      }
    }, 400);
    return () => {
      bekor = true;
      clearTimeout(t);
    };
  }, [raqam, studentId]);

  const bogʻlash = topildi !== null && !topildi.already_linked;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (topildi !== null && topildi.already_linked) return;
        if (bogʻlash && topildi) {
          onLink(topildi.user_id, form.relation, isFirst);
          return;
        }
        onCreate({
          last_name: form.last_name.trim(),
          first_name: form.first_name.trim(),
          phone: form.phone.trim() || null,
          relation: form.relation,
          // Birinchi vasiy avtomatik asosiy: xabarnoma manzilsiz qolmasin.
          is_primary: isFirst,
        });
      }}
      className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">
          Telefon raqami
        </span>
        <input
          autoFocus
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+998 90 123 45 67"
          inputMode="tel"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-foreground-muted">
          {qidirmoqda
            ? "Tekshirilmoqda…"
            : "Avval raqamni kiriting — maktabda boshqa farzandi bor-yoʻqligi shundan aniqlanadi."}
        </span>
      </label>

      {topildi !== null && topildi.already_linked && (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
          Bu raqam <strong>{topildi.full_name}</strong> ga tegishli va u allaqachon shu
          oʻquvchining vasiysi. Boshqa raqam kiriting.
        </p>
      )}

      {bogʻlash && topildi && (
        <div className="rounded-lg border border-brand/40 bg-brand/5 p-3">
          <p className="text-sm text-foreground">
            Bu raqam <strong>{topildi.full_name}</strong> hisobiga bogʻlangan.
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {topildi.children_count === 1
              ? `Farzandi: ${topildi.children[0]}`
              : `${topildi.children_count} farzandi: ${topildi.children.join(", ")}`}
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            Yangi hisob ochilmasin — shu vasiyga <strong>{studentName}</strong> ham
            biriktirilsinmi?
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Bitta login bilan ikkala farzandini bir kabinetda koʻradi.
          </p>
        </div>
      )}

      {/* Ism maydonlari FAQAT yangi hisob ochilganda kerak: mavjud
          vasiyning ismi allaqachon bazada va uni bu yerdan
          oʻzgartirmaymiz. */}
      {!bogʻlash && (
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
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">
          Qarindoshligi
        </span>
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
      </label>

      <span className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={ghostBtn}>
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={busy || (topildi !== null && topildi.already_linked)}
          className={primaryBtn}
        >
          {bogʻlash ? (
            <>
              <LinkIcon className="h-4 w-4" />
              Ha, shu vasiyga biriktirish
            </>
          ) : (
            <>
              <PlusIcon className="h-4 w-4" />
              Hisob ochib bogʻlash
            </>
          )}
        </button>
      </span>
    </form>
  );
}

/**
 * Oʻquvchi maʼlumoti — koʻrish va tahrirlash (ADM-05).
 *
 * Qabul paytida hamma maʼlumot toʻliq boʻlmaydi: tugʻilgan sana va
 * oldingi maktab hujjat kelganda toʻldiriladi. Shu sabab kartochka
 * faqat koʻrsatib qolmaydi — shu yerdan tahrirlanadi.
 *
 * Qoralama patterni: tahrirlash rejimida oʻzgarish DARHOL ketmaydi,
 * «Saqlash» bosilishi kerak. Sabab — bu hujjatdagi maʼlumot, tasodifiy
 * bosilgan tugma uni jimgina almashtirib qoʻymasin.
 */
function StudentInfoSection({
  card,
  canManage,
  onSaved,
}: {
  card: StudentCardOut;
  canManage: boolean;
  onSaved: (card: StudentCardOut) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => qoralama(card));

  function boshla() {
    setForm(qoralama(card));
    setError(null);
    setEditing(true);
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await updateStudent(card.id, {
          last_name: form.last_name.trim(),
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim() || null,
          birth_date: form.birth_date || null,
          previous_school: form.previous_school.trim() || null,
        }),
      );
      setEditing(false);
    } catch (err) {
      setError(apiXato(err, "Saqlab boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  const toldirilmagan =
    card.birth_date === null || (kerakOldingiMaktab(card) && !card.previous_school);

  if (!editing) {
    return (
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Maʼlumot
          </h3>
          {canManage && (
            <button type="button" onClick={boshla} className={rowBtn}>
              <PencilIcon className="h-3.5 w-3.5" />
              Tahrirlash
            </button>
          )}
        </div>

        <dl className="flex flex-col gap-1.5 text-sm">
          <Qator nom="Familiya, ism" qiymat={`${card.last_name} ${card.first_name}`} kuchli />
          <Qator nom="Otasining ismi" qiymat={card.middle_name} />
          <Qator nom="Tugʻilgan sana" qiymat={card.birth_date} raqam />
          <Qator
            nom="Oldingi oʻqigan joyi"
            qiymat={card.previous_school}
            izoh={
              card.previous_school === null ? oldingiMaktabIzohi(card.class_name) : undefined
            }
          />
        </dl>

        {/* Boʻsh maydon jimgina qolmasin: kartochka toʻliq emasligini
            administrator koʻrib tursin, aks holda hujjat kelganda ham
            hech kim toʻldirmaydi. */}
        {canManage && toldirilmagan && (
          <p className="mt-2 rounded-lg bg-warning-tint px-3 py-2 text-xs text-foreground">
            Kartochka toʻliq emas — «Tahrirlash» orqali toʻldiring.
          </p>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={saqla} className="rounded-lg border border-border p-3">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        Maʼlumotni tahrirlash
      </h3>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <Maydon
          nom="Familiya"
          qiymat={form.last_name}
          ozgardi={(v) => setForm({ ...form, last_name: v })}
        />
        <Maydon
          nom="Ism"
          qiymat={form.first_name}
          ozgardi={(v) => setForm({ ...form, first_name: v })}
        />
        <Maydon
          nom="Otasining ismi"
          qiymat={form.middle_name}
          ozgardi={(v) => setForm({ ...form, middle_name: v })}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Tugʻilgan sana</span>
          <input
            type="date"
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            className={inputClass}
          />
        </label>
        <Maydon
          nom="Oldingi oʻqigan joyi"
          qiymat={form.previous_school}
          ozgardi={(v) => setForm({ ...form, previous_school: v })}
          izoh={oldingiMaktabIzohi(card.class_name)}
          placeholder="Masalan: 12-maktab, Chilonzor"
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={saving || !form.last_name.trim() || !form.first_name.trim()}
          className={primaryBtn}
        >
          {saving ? "Saqlanmoqda…" : "Oʻzgarishlarni saqlash"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className={ghostBtn}
        >
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

function qoralama(card: StudentCardOut) {
  return {
    last_name: card.last_name,
    first_name: card.first_name,
    middle_name: card.middle_name ?? "",
    birth_date: card.birth_date ?? "",
    previous_school: card.previous_school ?? "",
  };
}

/**
 * 0 va 1-sinf uchun oldingi maktab talab qilinmaydi. Sinfsiz
 * oʻquvchida ham talab qilmaymiz: qaysi sinfga tushishi hali
 * maʼlum emas.
 */
function kerakOldingiMaktab(card: StudentCardOut): boolean {
  return sinfRaqami(card.class_name) > 1;
}

/** «1-A» → 1, «0-sinf» → 0, sinfsiz → −1. */
function sinfRaqami(className: string | null | undefined): number {
  const m = /^(\d+)/.exec((className ?? "").trim());
  return m ? Number(m[1]) : -1;
}

/**
 * Maydon ostidagi izoh sinfga qarab oʻzgaradi.
 *
 * 1-sinfda maydon TOʻLDIRILADI, lekin majburiy emas (loyiha egasining
 * soʻrovi, 2026-09-04): bola boshqa joyda bogʻcha yoki tayyorlov
 * guruhida boʻlgan boʻlishi mumkin va bu maʼlumot kerak. Ilgari izoh
 * «0–1-sinf uchun shart emas» derdi va administrator 1-sinfda maydonni
 * umuman toʻldirmasdi.
 */
function oldingiMaktabIzohi(className: string | null | undefined): string | undefined {
  const sinf = sinfRaqami(className);
  if (sinf === 0) return "0-sinf uchun shart emas — birinchi marta maktabga kelgan.";
  if (sinf === 1) return "Majburiy emas — bogʻcha yoki tayyorlov guruhi boʻlsa yozing.";
  return undefined;
}

function Qator({
  nom,
  qiymat,
  izoh,
  kuchli,
  raqam,
}: {
  nom: string;
  qiymat: string | null;
  izoh?: string;
  kuchli?: boolean;
  raqam?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-foreground-muted">{nom}</dt>
      <dd className="text-right">
        <span
          className={`${raqam ? "num " : ""}${
            qiymat ? (kuchli ? "font-medium text-foreground" : "text-foreground") : "text-foreground-muted"
          }`}
        >
          {qiymat || "—"}
        </span>
        {izoh && <span className="block text-xs text-foreground-muted">{izoh}</span>}
      </dd>
    </div>
  );
}

function Maydon({
  nom,
  qiymat,
  ozgardi,
  izoh,
  placeholder,
}: {
  nom: string;
  qiymat: string;
  ozgardi: (v: string) => void;
  izoh?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground">{nom}</span>
      <input
        value={qiymat}
        onChange={(e) => ozgardi(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      {izoh && <span className="mt-1 block text-xs text-foreground-muted">{izoh}</span>}
    </label>
  );
}

/**
 * Vasiy maʼlumotini tahrirlash (ADM-05).
 *
 * Nima uchun kerak: qabul paytida koʻpincha faqat ism va telefon
 * yoziladi. Yashash joyi, kasbi va otasining ismi keyin, hujjat
 * kelganda toʻldiriladi.
 *
 * Login, parol va rol BU YERDA YOʻQ — ular kirish huquqini belgilaydi
 * va boshqa yoʻldan oʻzgaradi. Familiya almashsa ham login oʻzgarmaydi:
 * u odamning tizimdagi manzili.
 */
function GuardianEditForm({
  studentId,
  guardian,
  onSaved,
  onCancel,
}: {
  studentId: string;
  guardian: GuardianRowOut;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    last_name: guardian.last_name,
    first_name: guardian.first_name,
    middle_name: guardian.middle_name ?? "",
    phone: guardian.phone ?? "",
    address: guardian.address ?? "",
    profession: guardian.profession ?? "",
    relation: guardian.relation,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateGuardian(studentId, guardian.user_id, {
        last_name: form.last_name.trim(),
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        profession: form.profession.trim() || null,
        relation: form.relation,
      });
      onSaved();
    } catch (err) {
      // Telefon band boʻlsa server kim ekanini aytadi — shuni koʻrsatamiz.
      setError(apiXato(err, "Saqlab boʻlmadi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saqla} className="mt-2 flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3">
      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-2.5 py-1.5 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Maydon
          nom="Familiya"
          qiymat={form.last_name}
          ozgardi={(v) => setForm({ ...form, last_name: v })}
        />
        <Maydon
          nom="Ism"
          qiymat={form.first_name}
          ozgardi={(v) => setForm({ ...form, first_name: v })}
        />
      </div>

      <Maydon
        nom="Otasining ismi"
        qiymat={form.middle_name}
        ozgardi={(v) => setForm({ ...form, middle_name: v })}
      />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">Qarindoshligi</span>
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
      </label>

      <Maydon
        nom="Telefon"
        qiymat={form.phone}
        ozgardi={(v) => setForm({ ...form, phone: v })}
        placeholder="90 123 45 67"
      />
      <Maydon
        nom="Yashash joyi"
        qiymat={form.address}
        ozgardi={(v) => setForm({ ...form, address: v })}
        placeholder="Toshkent, Chilonzor 5-mavze, 12-uy"
      />
      <Maydon
        nom="Kasbi"
        qiymat={form.profession}
        ozgardi={(v) => setForm({ ...form, profession: v })}
        placeholder="Shifokor"
      />

      <span className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !form.last_name.trim() || !form.first_name.trim()}
          className={primaryBtn}
        >
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className={ghostBtn}>
          Bekor
        </button>
      </span>
    </form>
  );
}
