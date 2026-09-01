"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { ACADEMIC_YEAR, useAdmin, useAdminDispatch } from "@/lib/admin/store";
import { APPLICATION_STATUS_LABELS, type Application } from "@/lib/admin/types";
import {
  apiXato,
  createGuardian,
  createStudent,
  fetchClasses,
  type ClassOut,
} from "@/lib/school/api";

const STEPS = ["Oʻquvchi", "Ota-ona / vasiy", "Sinf va shartnoma", "Tasdiqlash"];

const MONTHS_IN_YEAR = 9;

/** Qarindoshlik — bazada kod, ekranda oʻzbekcha (StudentCard bilan bir xil). */
const RELATIONS: { id: string; label: string }[] = [
  { id: "father", label: "Ota" },
  { id: "mother", label: "Ona" },
  { id: "guardian", label: "Vasiy" },
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

/** Boʻsh forma — "Ariza kutmasdan qoʻshish" uchun. */
function emptyApplication(defaultClass: string): Application {
  return {
    id: "",
    studentFullName: "",
    birthDate: "",
    gender: "erkak",
    previousSchool: "",
    guardianFullName: "",
    guardianPhone: "+998 ",
    guardianRelation: "father",
    address: "",
    className: defaultClass,
    academicYear: ACADEMIC_YEAR,
    enrollDate: "2026-09-02",
    monthlyFee: 3_500_000,
    discountPercent: 0,
    discountReason: "",
    payDay: 5,
    note: "",
    status: "new",
    createdAt: "Qoʻlda kiritildi",
  };
}

/**
 * Qabul jarayoni ikki yoʻl bilan boshlanadi:
 *   1) kelib tushgan arizadan — shaxsiy maʼlumot allaqachon toʻlgan,
 *      shuning uchun 3-bosqichdan ochiladi;
 *   2) qoʻlda — toʻrtala bosqich boshidan toʻldiriladi (ota-ona
 *      maktabga oʻzi kelgan holat).
 */
export function EnrollWizard({
  startBlank = false,
  fromLeadId,
}: {
  startBlank?: boolean;
  /** Lidlar boʻlimidan kelgan boʻlsa — forma oldindan toʻldiriladi. */
  fromLeadId?: string;
}) {
  const router = useRouter();
  const { applications, leads } = useAdmin();
  const dispatch = useAdminDispatch();

  // Sinflar BAZADAN — sinf tanlanmasa oʻquvchi «sinfsiz» yaratiladi.
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        setClasses(await fetchClasses());
      } catch (err) {
        setLoadError(apiXato(err, "Sinflar roʻyxatini olib boʻlmadi."));
      }
    })();
  }, []);

  const [draft, setDraft] = useState<Application | null>(() => {
    if (!startBlank) return null;
    const blank = emptyApplication("");
    const lead = fromLeadId ? leads.find((l) => l.id === fromLeadId) : undefined;
    if (!lead) return blank;
    // Lidda bor maʼlumot koʻchiriladi, qolgani qoʻlda toʻldiriladi.
    return {
      ...blank,
      studentFullName: lead.childName,
      birthDate: `${lead.birthYear}-01-01`,
      className: lead.targetClass,
      guardianFullName: lead.parentName,
      guardianPhone: lead.phone,
      note: lead.note,
      createdAt: `Liddan (${lead.createdAt})`,
    };
  });
  const [step, setStep] = useState(startBlank ? 0 : 2);
  const [done, setDone] = useState<EnrollResult | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const pending = applications.filter((a) => a.status === "new");

  /**
   * Yakuniy qadam — BAZAGA yozadi: avval oʻquvchi, keyin vasiy hisobi.
   * Vasiy paroli javobda BIR MARTA keladi va yakuniy ekranda koʻrsatiladi.
   *
   * Telefon boshqa hisobda boʻlsa server 409 qaytaradi va xabar kimligini
   * aytadi — bunday holda ikkinchi farzand oʻquvchi kartochkasidagi
   * «Mavjud hisobga bogʻlash» orqali qoʻshiladi.
   */
  async function accept(application: Application) {
    setSaving(true);
    setSaveError("");
    try {
      const classId =
        classes.find((c) => c.name === application.className)?.id ?? null;
      const student = await createStudent({
        ...splitFullName(application.studentFullName),
        birth_date: application.birthDate || null,
        class_id: classId,
      });
      const guardian = await createGuardian(student.id, {
        ...splitFullName(application.guardianFullName),
        phone: application.guardianPhone.trim() || null,
        relation: application.guardianRelation,
        is_primary: true,
      });
      if (application.id) {
        dispatch({
          type: "ACCEPT_APPLICATION",
          application,
          applicationId: application.id,
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

  function startFromApplication(application: Application) {
    setDraft({ ...application });
    setStep(2);
    setDone(null);
    setTouched(false);
  }

  function startBlankDraft() {
    setDraft(emptyApplication(classes[0]?.name ?? ""));
    setStep(0);
    setDone(null);
    setTouched(false);
  }

  function update(patch: Partial<Application>) {
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
              Kelib tushgan arizani koʻrib chiqing yoki oʻquvchini qoʻlda kiriting
            </p>
          </div>
          <button
            type="button"
            onClick={startBlankDraft}
            className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            <PlusIcon className="h-4 w-4" />
            Ariza kutmasdan qoʻshish
          </button>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">Yangi ariza yoʻq</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Ota-ona maktabga oʻzi kelgan boʻlsa, tepadagi tugma orqali qoʻlda kiriting.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pending.map((application) => (
              <li
                key={application.id}
                className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {application.studentFullName}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {application.className} · {application.previousSchool}
                    </p>
                  </div>
                  <Badge tone="warning">{APPLICATION_STATUS_LABELS[application.status]}</Badge>
                </div>
                <dl className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                  <Row label="Ota-ona">{application.guardianFullName}</Row>
                  <Row label="Telefon">{application.guardianPhone}</Row>
                  <Row label="Kelib tushdi">{application.createdAt}</Row>
                </dl>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startFromApplication(application)}
                    className="focus-ring flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
                  >
                    Koʻrib chiqish
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "REJECT_APPLICATION",
                        applicationId: application.id,
                        reason: "Joy yoʻq",
                      })
                    }
                    className="focus-ring rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:border-danger hover:text-danger"
                  >
                    Rad etish
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
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
              <ContractStep draft={draft} update={update} classes={classes} />
            )}
            {step === 3 && (
              <ConfirmStep
                application={{ ...draft, monthlyFee: monthly }}
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

        <RecapPanel application={draft} step={step} onEdit={setStep} />
      </div>
    </div>
  );
}

/** Bosqich boʻyicha majburiy maydonlar. */
function validate(draft: Application, step: number): string[] {
  const problems: string[] = [];

  if (step === 0) {
    if (draft.studentFullName.trim().split(/\s+/).length < 2) {
      problems.push("Oʻquvchining ism va familiyasini toʻliq kiriting.");
    }
    if (!draft.birthDate) problems.push("Tugʻilgan sanani tanlang.");
  }

  if (step === 1) {
    if (draft.guardianFullName.trim().split(/\s+/).length < 2) {
      problems.push("Ota-ona / vasiy F.I.Sh ni toʻliq kiriting.");
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
  draft: Application;
  update: (patch: Partial<Application>) => void;
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
        <Field label="Jinsi">
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {(["erkak", "ayol"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update({ gender: g })}
                aria-pressed={draft.gender === g}
                className={`focus-ring flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  draft.gender === g
                    ? "bg-brand text-brand-foreground"
                    : "text-foreground-muted hover:bg-surface-muted"
                }`}
              >
                {g === "erkak" ? "Erkak" : "Ayol"}
              </button>
            ))}
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Oldingi taʼlim muassasasi">
            <input
              value={draft.previousSchool}
              onChange={(e) => update({ previousSchool: e.target.value })}
              placeholder="Birinchi sinfga kelayotgan boʻlsa — boʻsh qoldiring"
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </>
  );
}

function GuardianStep({
  draft,
  update,
}: {
  draft: Application;
  update: (patch: Partial<Application>) => void;
}) {
  return (
    <>
      <h2 className="mb-1 text-base font-semibold text-foreground">Ota-ona / vasiy</h2>
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
        <div className="sm:col-span-2">
          <Field label="Yashash manzili">
            <input
              value={draft.address}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="Toshkent sh., Yunusobod t., 4-daha, 12-uy"
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </>
  );
}

function ContractStep({
  draft,
  update,
  classes,
}: {
  draft: Application;
  update: (patch: Partial<Application>) => void;
  classes: ClassOut[];
}) {
  const chosen = classes.find((c) => c.name === draft.className);

  return (
    <>
      <h2 className="mb-4 text-base font-semibold text-foreground">
        Taʼlim maʼlumotlari va toʻlov shartlari
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Oʻquv yili">
          <input value={ACADEMIC_YEAR} readOnly className={`${inputClass} bg-surface-muted`} />
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
        </Field>
        <Field label="Oylik shartnoma summasi">
          <input
            type="number"
            value={draft.monthlyFee}
            onChange={(e) => update({ monthlyFee: Number(e.target.value) })}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-foreground-muted">
            Sinf bosqichi boʻyicha standart summa
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
        <Field label="Toʻlov kuni">
          <select
            value={draft.payDay}
            onChange={(e) => update({ payDay: Number(e.target.value) })}
            className={inputClass}
          >
            {[5, 10, 15, 25].map((d) => (
              <option key={d} value={d}>
                Har oyning {d}-sanasi
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
          <Field label="Qoʻshimcha izoh (ixtiyoriy)">
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

function ConfirmStep({
  application,
  classes,
}: {
  application: Application;
  classes: ClassOut[];
}) {
  const homeroomName =
    classes.find((c) => c.name === application.className)?.homeroom_teacher ?? "—";

  return (
    <>
      <h2 className="mb-1 text-base font-semibold text-foreground">Tasdiqlash</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Maʼlumotlarni tekshiring. Tasdiqlangach oʻquvchi {application.className} sinfiga
        qoʻshiladi va vasiy uchun kabinet hisobi ochiladi.
      </p>
      <p className="mb-4 rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
        Toʻlov moduli hali ulanmagan: shartnoma summasi, chegirma va toʻlov kuni
        hozircha bazaga yozilmaydi.
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Oʻquvchi">{application.studentFullName}</Row>
        <Row label="Tugʻilgan sana">{application.birthDate || "—"}</Row>
        <Row label="Sinf">{application.className}</Row>
        <Row label="Sinf rahbari">{homeroomName}</Row>
        <Row label="Qabul sanasi">{application.enrollDate}</Row>
        <Row label="Oldingi maktab">{application.previousSchool || "—"}</Row>
        <Row label="Ota-ona / vasiy">
          {application.guardianFullName} ({relationLabel(application.guardianRelation)})
        </Row>
        <Row label="Telefon">{application.guardianPhone}</Row>
        <Row label="Manzil">{application.address || "—"}</Row>
        <Row label="Oylik toʻlov">{formatSom(application.monthlyFee)}</Row>
        <Row label="Toʻlov kuni">Har oyning {application.payDay}-sanasi</Row>
        {application.discountPercent > 0 && (
          <>
            <Row label="Chegirma">{application.discountPercent}%</Row>
            <Row label="Chegirma asosi">{application.discountReason}</Row>
          </>
        )}
      </dl>
      {application.note && (
        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
          {application.note}
        </p>
      )}
    </>
  );
}

function RecapPanel({
  application,
  step,
  onEdit,
}: {
  application: Application;
  step: number;
  onEdit: (step: number) => void;
}) {
  return (
    <aside className="h-fit rounded-xl border border-border bg-surface p-4 shadow-sm xl:sticky xl:top-20">
      <h2 className="mb-3 text-base font-semibold text-foreground">Kiritilgan maʼlumot</h2>

      <SectionHead index={1} label="Oʻquvchi" show={step > 0} onEdit={() => onEdit(0)} />
      {step > 0 ? (
        <div className="mt-1.5 rounded-lg bg-surface-muted p-3">
          <p className="text-sm font-medium text-foreground">{application.studentFullName}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Row label="Tugʻilgan sana">{application.birthDate || "—"}</Row>
            <Row label="Jinsi">{application.gender === "erkak" ? "Erkak" : "Ayol"}</Row>
          </dl>
          {application.previousSchool && (
            <p className="mt-2 border-t border-border pt-2 text-xs text-foreground-muted">
              Oldingi taʼlim muassasasi
              <span className="mt-0.5 block text-foreground">{application.previousSchool}</span>
            </p>
          )}
        </div>
      ) : (
        <Placeholder />
      )}

      <div className="mt-4">
        <SectionHead index={2} label="Ota-ona / vasiy" show={step > 1} onEdit={() => onEdit(1)} />
      </div>
      {step > 1 ? (
        <div className="mt-1.5 rounded-lg bg-surface-muted p-3">
          <p className="text-sm font-medium text-foreground">{application.guardianFullName}</p>
          <span className="mt-1 inline-block">
            <Badge tone="success">{relationLabel(application.guardianRelation)}</Badge>
          </span>
          <dl className="mt-2 space-y-1.5 text-xs">
            <Row label="Telefon raqami">{application.guardianPhone}</Row>
            <Row label="Manzil">{application.address || "—"}</Row>
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
          <p className="text-sm font-medium text-foreground">{application.className} sinf</p>
          <dl className="mt-2 space-y-1.5 text-xs">
            <Row label="Oylik toʻlov">
              {formatSom(
                Math.round((application.monthlyFee * (100 - application.discountPercent)) / 100),
              )}
            </Row>
            <Row label="Qabul sanasi">{application.enrollDate}</Row>
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

/** Qabul natijasi — vasiy paroli BIR MARTA shu yerda koʻrsatiladi. */
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
            Vasiy kabinetiga kirish maʼlumotlari — FAQAT HOZIR koʻrsatiladi
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
