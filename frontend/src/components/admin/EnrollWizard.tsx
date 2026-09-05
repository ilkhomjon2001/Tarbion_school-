"use client";

/**
 * Qabul (ADM-02) — toʻrt bosqichli sehrgar, BAZAGA yozadi.
 *
 * Demo «arizalar navbati» olib tashlandi: arizalar (CRM) moduli hali
 * serverda yoʻq, shuning uchun qabul faqat boʻsh formadan boshlanadi.
 * Har bir qadam haqiqiy API bilan tugaydi: `createStudent` →
 * `createGuardian` → `setContract` (+ `addDiscount`).
 *
 * Bazaga yozilmaydigan maydonlar formada YOʻQ (jins, oldingi maktab,
 * manzil, toʻlov kuni) — saqlanmaydigan narsani soʻrash aldamchilik
 * boʻlardi. Backend sxemasi kengaygach qaytariladi.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckIcon, ClipboardIcon, PlusIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { fetchCurrentYear } from "@/lib/academic/api";
import {
  apiXato,
  createGuardian,
  createStudent,
  fetchClasses,
  type ClassOut,
} from "@/lib/school/api";
import { addDiscount, setContract, DEFAULT_MONTHLY_FEE } from "@/lib/payments/api";

const STEPS = ["Oʻquvchi", "Ota-ona", "Sinf va shartnoma", "Tasdiqlash"];

const MONTHS_IN_YEAR = 9;

/** Qarindoshlik — bazada kod, ekranda oʻzbekcha (StudentCard bilan bir xil). */
const RELATIONS: { id: string; label: string }[] = [
  { id: "father", label: "Ota" },
  { id: "mother", label: "Ona" },
  // «Ota yoki ona, qaysi biri koʻrsatilmagan» — maktab koʻpincha buni
  // alohida yozib oʻtirmaydi va majburlashning maʼnosi yoʻq.
  { id: "parent", label: "Ota-ona" },
  { id: "guardian", label: "Qonuniy vakil" },
];

function relationLabel(id: string): string {
  return RELATIONS.find((r) => r.id === id)?.label ?? id;
}

/**
 * «Familiya Ism [Otasining ismi …]» → API kutadigan uch boʻlak.
 * Hujjatlarda yozuv shu tartibda boʻladi; ortiqcha soʻzlar otasining
 * ismiga qoʻshiladi.
 */
function splitFullName(full: string): {
  last_name: string;
  first_name: string;
  middle_name: string | null;
} {
  const parts = full.trim().split(/\s+/);
  return {
    last_name: parts[0] ?? "",
    first_name: parts[1] ?? "",
    middle_name: parts.length > 2 ? parts.slice(2).join(" ") : null,
  };
}

/** Sehrgar ichidagi qoralama — faqat shu komponentda yashaydi. */
interface EnrollDraft {
  studentFullName: string;
  birthDate: string;
  guardianFullName: string;
  guardianPhone: string;
  guardianRelation: string;
  className: string;
  enrollDate: string;
  monthlyFee: number;
  discountPercent: number;
  discountReason: string;
  note: string;
}

function emptyDraft(defaultClass: string): EnrollDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    studentFullName: "",
    birthDate: "",
    guardianFullName: "",
    guardianPhone: "+998 ",
    guardianRelation: "father",
    className: defaultClass,
    enrollDate: today,
    monthlyFee: DEFAULT_MONTHLY_FEE,
    discountPercent: 0,
    discountReason: "",
    note: "",
  };
}

export function EnrollWizard({ startBlank = false }: { startBlank?: boolean }) {
  const router = useRouter();

  // Sinflar BAZADAN — sinf tanlanmasa oʻquvchi «sinfsiz» yaratiladi.
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [loadError, setLoadError] = useState("");
  const [academicYear, setAcademicYear] = useState("—");
  useEffect(() => {
    void (async () => {
      try {
        setClasses(await fetchClasses());
      } catch (err) {
        setLoadError(apiXato(err, "Sinflar roʻyxatini olib boʻlmadi."));
      }
      const year = await fetchCurrentYear().catch(() => null);
      if (year) setAcademicYear(year.name);
    })();
  }, []);

  const [draft, setDraft] = useState<EnrollDraft | null>(() =>
    startBlank ? emptyDraft("") : null,
  );
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<EnrollResult | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /**
   * Yakuniy qadam — BAZAGA yozadi: oʻquvchi → ota-ona hisobi → shartnoma
   * (→ chegirma). Ota-ona paroli javobda BIR MARTA keladi va yakuniy
   * ekranda koʻrsatiladi.
   *
   * Telefon boshqa hisobda boʻlsa server 409 qaytaradi va xabar kimligini
   * aytadi — bunday holda ikkinchi farzand oʻquvchi kartochkasidagi
   * «Mavjud hisobga bogʻlash» orqali qoʻshiladi.
   */
  async function accept(d: EnrollDraft) {
    setSaving(true);
    setSaveError("");
    try {
      const classId = classes.find((c) => c.name === d.className)?.id ?? null;
      const student = await createStudent({
        ...splitFullName(d.studentFullName),
        birth_date: d.birthDate || null,
        class_id: classId,
      });
      const guardian = await createGuardian(student.id, {
        ...splitFullName(d.guardianFullName),
        phone: d.guardianPhone.trim() || null,
        relation: d.guardianRelation,
        is_primary: true,
      });

      // Shartnoma BAZAGA yoziladi (TOL-01): qabul oyining 1-sanasidan.
      const startsOn = `${d.enrollDate.slice(0, 7)}-01`;
      await setContract(
        student.id,
        d.monthlyFee,
        startsOn,
        d.note.trim() || "Qabul sehrgaridan",
      );
      if (d.discountPercent > 0) {
        await addDiscount(student.id, {
          kind: "percent",
          value: d.discountPercent,
          reason: d.discountReason.trim() || "Qabulda kelishilgan chegirma",
          starts_on: startsOn,
        });
      }
      setDone({
        studentName: student.full_name,
        guardianLogin: guardian.guardian.login,
        guardianPassword: guardian.initial_password,
      });
      setDraft(null);
    } catch (err) {
      setSaveError(apiXato(err, "Saqlab boʻlmadi. Qayta urinib koʻring."));
    } finally {
      setSaving(false);
    }
  }

  function startBlankDraft() {
    setDraft(emptyDraft(classes[0]?.name ?? ""));
    setStep(0);
    setDone(null);
    setTouched(false);
  }

  function update(patch: Partial<EnrollDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  if (done) {
    return (
      <EnrolledScreen
        result={done}
        onMore={() => setDone(null)}
        onList={() => router.push("/admin/oquvchilar")}
      />
    );
  }

  if (!draft) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-h2 font-bold text-foreground">Qabul</h1>
            <p className="text-sm text-foreground-muted">
              Yangi oʻquvchini bazaga kiritish va ota-ona hisobini ochish
            </p>
          </div>
          <button
            type="button"
            onClick={startBlankDraft}
            className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            <PlusIcon className="h-4 w-4" />
            Yangi qabul
          </button>
        </div>

        <EmptyState
          icon={<ClipboardIcon className="h-5 w-5" />}
          title="Arizalar (CRM) boʻlimi tayyorlanmoqda"
          description="Onlayn kelib tushadigan arizalar navbati keyingi bosqichda serverga ulanadi. Hozircha qabul «Yangi qabul» tugmasi orqali qoʻlda kiritiladi."
        />
      </div>
    );
  }

  const monthly = Math.round((draft.monthlyFee * (100 - draft.discountPercent)) / 100);
  const yearly = monthly * MONTHS_IN_YEAR;
  const problems = validate(draft, step);
  const canContinue = problems.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setDraft(null)}
          aria-label="Orqaga"
          className="focus-ring rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-surface-muted"
        >
          ←
        </button>
        <h1 className="text-h2 font-bold text-foreground">Yangi oʻquvchini qabul qilish</h1>
      </div>

      <Stepper step={step} onGo={(target) => target < step && setStep(target)} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="p-4">
            {step === 0 && <StudentStep draft={draft} update={update} />}
            {step === 1 && <GuardianStep draft={draft} update={update} />}
            {step === 2 && (
              <ContractStep
                draft={draft}
                update={update}
                classes={classes}
                academicYear={academicYear}
              />
            )}
            {step === 3 && (
              <ConfirmStep
                draft={{ ...draft, monthlyFee: monthly }}
                classes={classes}
              />
            )}

            {loadError && (
              <p role="alert" className="mt-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                {loadError}
              </p>
            )}
            {saveError && (
              <p role="alert" className="mt-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                {saveError}
              </p>
            )}

            {touched && problems.length > 0 && (
              <ul className="animate-enter mt-4 space-y-1 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">
                {problems.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            )}
          </div>

          {step >= 2 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-tint px-4 py-3">
              <span className="text-sm font-medium text-brand-dark">Dastlabki hisob-kitob</span>
              <span className="text-right text-xs text-foreground-muted">
                <span className="block">
                  OYLIK TOʻLOV:{" "}
                  <span className="num font-semibold text-foreground">{formatSom(monthly)}</span>
                </span>
                <span className="block">
                  YILLIK ({MONTHS_IN_YEAR} OY):{" "}
                  <span className="num font-semibold text-foreground">{formatSom(yearly)}</span>
                </span>
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-muted/50 px-4 py-3">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="focus-ring rounded text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Bekor qilish
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="focus-ring rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-40"
              >
                Orqaga
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    setTouched(true);
                    if (canContinue) {
                      setStep((s) => s + 1);
                      setTouched(false);
                    }
                  }}
                  className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
                >
                  Keyingisi →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void accept(draft)}
                  className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saqlanmoqda…" : "Qabul qilish va sinfga qoʻshish"}
                </button>
              )}
            </div>
          </div>
        </div>

        <RecapPanel draft={draft} step={step} onEdit={setStep} />
      </div>
    </div>
  );
}

/** Bosqich boʻyicha majburiy maydonlar. */
function validate(draft: EnrollDraft, step: number): string[] {
  const problems: string[] = [];

  if (step === 0) {
    if (draft.studentFullName.trim().split(/\s+/).length < 2) {
      problems.push("Oʻquvchining ism va familiyasini toʻliq kiriting.");
    }
    if (!draft.birthDate) problems.push("Tugʻilgan sanani tanlang.");
  }

  if (step === 1) {
    if (draft.guardianFullName.trim().split(/\s+/).length < 2) {
      problems.push("Ota-ona F.I.Sh ni toʻliq kiriting.");
    }
    if (draft.guardianPhone.replace(/\D/g, "").length < 12) {
      problems.push("Telefon raqami toʻliq emas. Namuna: +998 90 123 45 67");
    }
  }

  if (step === 2) {
    if (!draft.className) problems.push("Sinfni tanlang.");
    if (draft.monthlyFee <= 0) problems.push("Shartnoma summasi noldan katta boʻlishi kerak.");
    if (draft.discountPercent > 0 && !draft.discountReason.trim()) {
      problems.push("Chegirma berilsa, asosini yozish majburiy.");
    }
  }

  return problems;
}

// ─────────────────────────── Bosqichlar ───────────────────────────

function StudentStep({
  draft,
  update,
}: {
  draft: EnrollDraft;
  update: (patch: Partial<EnrollDraft>) => void;
}) {
  return (
    <>
      <h2 className="mb-1 text-base font-semibold text-foreground">Oʻquvchi maʼlumotlari</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Hujjatdagidek toʻliq yozing — maʼlumotnomalar shu maʼlumotdan chiqadi.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="F.I.Sh (toʻliq)">
            <input
              value={draft.studentFullName}
              onChange={(e) => update({ studentFullName: e.target.value })}
              placeholder="Masalan: Karimov Sardor Bekzod oʻgʻli"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Tugʻilgan sana">
          <input
            type="date"
            value={draft.birthDate}
            onChange={(e) => update({ birthDate: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
}

function GuardianStep({
  draft,
  update,
}: {
  draft: EnrollDraft;
  update: (patch: Partial<EnrollDraft>) => void;
}) {
  return (
    <>
      <h2 className="mb-1 text-base font-semibold text-foreground">Ota-ona</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Bu shaxs kabinetga kirish huquqini oladi va toʻlov boʻyicha xabarlarni qabul qiladi.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="F.I.Sh (toʻliq)">
            <input
              value={draft.guardianFullName}
              onChange={(e) => update({ guardianFullName: e.target.value })}
              placeholder="Masalan: Karimov Bekzod Alisherovich"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Telefon raqami">
          <input
            type="tel"
            inputMode="tel"
            value={draft.guardianPhone}
            onChange={(e) => update({ guardianPhone: e.target.value })}
            placeholder="+998 90 123 45 67"
            className={inputClass}
          />
        </Field>
        <Field label="Qarindoshligi">
          <select
            value={draft.guardianRelation}
            onChange={(e) => update({ guardianRelation: e.target.value })}
            className={inputClass}
          >
            {RELATIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </>
  );
}

function ContractStep({
  draft,
  update,
  classes,
  academicYear,
}: {
  draft: EnrollDraft;
  update: (patch: Partial<EnrollDraft>) => void;
  classes: ClassOut[];
  academicYear: string;
}) {
  const chosen = classes.find((c) => c.name === draft.className);

  return (
    <>
      <h2 className="mb-4 text-base font-semibold text-foreground">
        Taʼlim maʼlumotlari va toʻlov shartlari
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Oʻquv yili">
          <input value={academicYear} readOnly className={`${inputClass} bg-surface-muted`} />
        </Field>
        <Field label="Sinf">
          <select
            value={draft.className}
            onChange={(e) => update({ className: e.target.value })}
            className={inputClass}
          >
            <option value="">Sinfni tanlang…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} · {c.student_count} oʻquvchi
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-foreground-muted">
            Sinf rahbari: {chosen?.homeroom_teacher ?? "—"}
          </span>
        </Field>
        <Field label="Qabul sanasi">
          <input
            type="date"
            value={draft.enrollDate}
            onChange={(e) => update({ enrollDate: e.target.value })}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-foreground-muted">
            Shartnoma shu oyning 1-sanasidan kuchga kiradi.
          </span>
        </Field>
        <Field label="Oylik shartnoma summasi">
          <input
            type="number"
            value={draft.monthlyFee}
            onChange={(e) => update({ monthlyFee: Number(e.target.value) })}
            className={`${inputClass} num`}
          />
          <span className="mt-1 block text-xs text-foreground-muted">
            Soʻmda, tiyin yoʻq
          </span>
        </Field>
        <Field label="Chegirma">
          <select
            value={draft.discountPercent}
            onChange={(e) => update({ discountPercent: Number(e.target.value) })}
            className={inputClass}
          >
            {[0, 10, 25, 50].map((p) => (
              <option key={p} value={p}>
                {p === 0 ? "Yoʻq" : `${p}%`}
              </option>
            ))}
          </select>
        </Field>

        {draft.discountPercent > 0 && (
          <div className="sm:col-span-2">
            <Field label="Chegirma asosi (majburiy)">
              <input
                value={draft.discountReason}
                onChange={(e) => update({ discountReason: e.target.value })}
                placeholder="Masalan: koʻp bolali oila, direktor buyrugʻi №12"
                className={inputClass}
              />
            </Field>
          </div>
        )}

        <div className="sm:col-span-2">
          <Field label="Shartnoma izohi (ixtiyoriy)">
            <textarea
              value={draft.note}
              onChange={(e) => update({ note: e.target.value })}
              rows={3}
              placeholder="Shartnoma yoki qabul boʻyicha maxsus qaydlar…"
              className={`${inputClass} h-auto resize-none py-2`}
            />
          </Field>
        </div>
      </div>
    </>
  );
}

function Stepper({ step, onGo }: { step: number; onGo: (target: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-3">
      {STEPS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "next";
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => onGo(i)}
              disabled={state !== "done"}
              aria-current={state === "current" ? "step" : undefined}
              className={`focus-ring flex items-center gap-2 rounded-lg py-1 pr-2 ${
                state === "done" ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "done"
                    ? "bg-brand text-brand-foreground"
                    : state === "current"
                      ? "bg-brand text-brand-foreground ring-4 ring-brand-tint"
                      : "border border-border bg-surface text-foreground-muted"
                }`}
              >
                {state === "done" ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`text-xs font-medium uppercase tracking-wide ${
                  state === "next" ? "text-foreground-muted" : "text-foreground"
                }`}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="mx-2 hidden h-px flex-1 bg-border sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ConfirmStep({ draft, classes }: { draft: EnrollDraft; classes: ClassOut[] }) {
  const homeroomName =
    classes.find((c) => c.name === draft.className)?.homeroom_teacher ?? "—";

  return (
    <>
      <h2 className="mb-1 text-base font-semibold text-foreground">Tasdiqlash</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Maʼlumotlarni tekshiring. Tasdiqlangach oʻquvchi {draft.className} sinfiga
        qoʻshiladi, shartnoma yoziladi va ota-ona uchun kabinet hisobi ochiladi.
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Oʻquvchi">{draft.studentFullName}</Row>
        <Row label="Tugʻilgan sana">{draft.birthDate || "—"}</Row>
        <Row label="Sinf">{draft.className}</Row>
        <Row label="Sinf rahbari">{homeroomName}</Row>
        <Row label="Qabul sanasi">{draft.enrollDate}</Row>
        <Row label="Ota-ona">
          {draft.guardianFullName} ({relationLabel(draft.guardianRelation)})
        </Row>
        <Row label="Telefon">{draft.guardianPhone}</Row>
        <Row label="Oylik toʻlov (chegirma bilan)">{formatSom(draft.monthlyFee)}</Row>
        {draft.discountPercent > 0 && (
          <>
            <Row label="Chegirma">{draft.discountPercent}%</Row>
            <Row label="Chegirma asosi">{draft.discountReason}</Row>
          </>
        )}
      </dl>
      {draft.note && (
        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
          {draft.note}
        </p>
      )}
    </>
  );
}

function RecapPanel({
  draft,
  step,
  onEdit,
}: {
  draft: EnrollDraft;
  step: number;
  onEdit: (step: number) => void;
}) {
  return (
    <aside className="h-fit rounded-xl border border-border bg-surface p-4 shadow-sm xl:sticky xl:top-20">
      <h2 className="mb-3 text-base font-semibold text-foreground">Kiritilgan maʼlumot</h2>

      <SectionHead index={1} label="Oʻquvchi" show={step > 0} onEdit={() => onEdit(0)} />
      {step > 0 ? (
        <div className="mt-1.5 rounded-lg bg-surface-muted p-3">
          <p className="text-sm font-medium text-foreground">{draft.studentFullName}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Row label="Tugʻilgan sana">{draft.birthDate || "—"}</Row>
          </dl>
        </div>
      ) : (
        <Placeholder />
      )}

      <div className="mt-4">
        <SectionHead index={2} label="Ota-ona" show={step > 1} onEdit={() => onEdit(1)} />
      </div>
      {step > 1 ? (
        <div className="mt-1.5 rounded-lg bg-surface-muted p-3">
          <p className="text-sm font-medium text-foreground">{draft.guardianFullName}</p>
          <span className="mt-1 inline-block">
            <Badge tone="success">{relationLabel(draft.guardianRelation)}</Badge>
          </span>
          <dl className="mt-2 space-y-1.5 text-xs">
            <Row label="Telefon raqami">{draft.guardianPhone}</Row>
          </dl>
        </div>
      ) : (
        <Placeholder />
      )}

      <div className="mt-4">
        <SectionHead index={3} label="Sinf va shartnoma" show={step > 2} onEdit={() => onEdit(2)} />
      </div>
      {step > 2 ? (
        <div className="mt-1.5 rounded-lg bg-surface-muted p-3">
          <p className="text-sm font-medium text-foreground">{draft.className} sinf</p>
          <dl className="mt-2 space-y-1.5 text-xs">
            <Row label="Oylik toʻlov">
              {formatSom(
                Math.round((draft.monthlyFee * (100 - draft.discountPercent)) / 100),
              )}
            </Row>
            <Row label="Qabul sanasi">{draft.enrollDate}</Row>
          </dl>
        </div>
      ) : (
        <Placeholder />
      )}
    </aside>
  );
}

function SectionHead({
  index,
  label,
  show,
  onEdit,
}: {
  index: number;
  label: string;
  show: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {index}. {label}
      </p>
      {show && (
        <button
          type="button"
          onClick={onEdit}
          className="focus-ring rounded text-xs font-medium text-brand-dark hover:underline"
        >
          Oʻzgartirish
        </button>
      )}
    </div>
  );
}

function Placeholder() {
  return (
    <p className="mt-1.5 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-foreground-muted">
      Hali toʻldirilmagan.
    </p>
  );
}

/** Qabul natijasi — ota-ona paroli BIR MARTA shu yerda koʻrsatiladi. */
interface EnrollResult {
  studentName: string;
  guardianLogin: string;
  guardianPassword: string;
}

function EnrolledScreen({
  result,
  onMore,
  onList,
}: {
  result: EnrollResult;
  onMore: () => void;
  onList: () => void;
}) {
  return (
    <div className="p-4 md:p-6">
      <div className="animate-enter mx-auto max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
          <CheckIcon className="h-6 w-6" />
        </span>
        <h1 className="text-h3 font-semibold text-foreground">Oʻquvchi bazaga qoʻshildi</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          <span className="font-medium text-foreground">{result.studentName}</span> bazaga
          qoʻshildi, amal audit jurnaliga tushdi.
        </p>
        <div className="mt-4 rounded-lg bg-warning-tint px-3 py-3 text-left">
          <p className="text-xs font-semibold text-warning">
            Ota-ona kabinetiga kirish maʼlumotlari — FAQAT HOZIR koʻrsatiladi
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-foreground-muted">Login</dt>
              <dd className="num font-semibold text-foreground">{result.guardianLogin}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-foreground-muted">Boshlangʻich parol</dt>
              <dd className="num font-semibold text-foreground">{result.guardianPassword}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-foreground-muted">
            Yozib oling va ota-onaga topshiring — sahifadan chiqilgach parolni
            qayta koʻrib boʻlmaydi, faqat yangisini berish mumkin.
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onList}
            className="focus-ring rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            Oʻquvchilar roʻyxati
          </button>
          <button
            type="button"
            onClick={onMore}
            className="focus-ring rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Yana qabul qilish
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}
