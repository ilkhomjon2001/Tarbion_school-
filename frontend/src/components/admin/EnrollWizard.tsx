"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { ACADEMIC_YEAR, useAdmin, useAdminDispatch } from "@/lib/admin/store";
import { APPLICATION_STATUS_LABELS, type Application } from "@/lib/admin/types";
import { CLASSES } from "@/lib/director/school-data";
import { homeroomTeacherOf } from "@/lib/school/staff";

const STEPS = ["Oʻquvchi", "Ota-ona / vasiy", "Sinf va shartnoma", "Tasdiqlash"];

const MONTHS_IN_YEAR = 9;
const CLASS_CAPACITY = 30;

const RELATIONS = ["Ota", "Ona", "Vasiy", "Boshqa"];

/** Boʻsh forma — "Ariza kutmasdan qoʻshish" uchun. */
function emptyApplication(): Application {
  return {
    id: "",
    studentFullName: "",
    birthDate: "",
    gender: "erkak",
    previousSchool: "",
    guardianFullName: "",
    guardianPhone: "+998 ",
    guardianRelation: "Ota",
    address: "",
    className: CLASSES[0]?.name ?? "",
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
export function EnrollWizard({ startBlank = false }: { startBlank?: boolean }) {
  const router = useRouter();
  const { applications, students } = useAdmin();
  const dispatch = useAdminDispatch();

  const [draft, setDraft] = useState<Application | null>(
    startBlank ? emptyApplication() : null,
  );
  const [step, setStep] = useState(startBlank ? 0 : 2);
  const [done, setDone] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const pending = applications.filter((a) => a.status === "new");

  // Sinf toʻlganini oʻquvchilar sonidan hisoblaymiz — qoʻlda yozilgan
  // "joy yoʻq" bayrogʻi tez eskiradi.
  const capacity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      if (s.status !== "active") continue;
      counts.set(s.className, (counts.get(s.className) ?? 0) + 1);
    }
    return CLASSES.map((c) => ({
      name: c.name,
      count: counts.get(c.name) ?? 0,
      free: CLASS_CAPACITY - (counts.get(c.name) ?? 0),
    }));
  }, [students]);

  function startFromApplication(application: Application) {
    setDraft({ ...application });
    setStep(2);
    setDone(null);
    setTouched(false);
  }

  function startBlankDraft() {
    setDraft(emptyApplication());
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
        name={done}
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
              <ContractStep draft={draft} update={update} capacity={capacity} />
            )}
            {step === 3 && <ConfirmStep application={{ ...draft, monthlyFee: monthly }} />}

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
                  onClick={() => {
                    dispatch({
                      type: "ACCEPT_APPLICATION",
                      application: draft,
                      applicationId: draft.id || undefined,
                    });
                    setDone(draft.studentFullName);
                    setDraft(null);
                  }}
                  className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
                >
                  Qabul qilish va sinfga qoʻshish
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
              <option key={r} value={r}>
                {r}
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
  capacity,
}: {
  draft: Application;
  update: (patch: Partial<Application>) => void;
  capacity: { name: string; count: number; free: number }[];
}) {
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
            {capacity.map((c) => (
              <option key={c.name} value={c.name} disabled={c.free <= 0}>
                {c.name} · {c.count} oʻquvchi ·{" "}
                {c.free > 0 ? `${c.free} joy bor` : "Joy yoʻq"}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-foreground-muted">
            Sinf rahbari: {homeroomTeacherOf(draft.className)?.fullName ?? "—"}
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

function ConfirmStep({ application }: { application: Application }) {
  return (
    <>
      <h2 className="mb-1 text-base font-semibold text-foreground">Tasdiqlash</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Maʼlumotlarni tekshiring. Tasdiqlangach oʻquvchi {application.className} sinfiga
        qoʻshiladi va shartnoma boʻyicha toʻlov jadvali ochiladi.
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Oʻquvchi">{application.studentFullName}</Row>
        <Row label="Tugʻilgan sana">{application.birthDate || "—"}</Row>
        <Row label="Sinf">{application.className}</Row>
        <Row label="Sinf rahbari">
          {homeroomTeacherOf(application.className)?.fullName ?? "—"}
        </Row>
        <Row label="Qabul sanasi">{application.enrollDate}</Row>
        <Row label="Oldingi maktab">{application.previousSchool || "—"}</Row>
        <Row label="Ota-ona / vasiy">
          {application.guardianFullName} ({application.guardianRelation})
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
            <Badge tone="success">{application.guardianRelation}</Badge>
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

function EnrolledScreen({
  name,
  onMore,
  onList,
}: {
  name: string;
  onMore: () => void;
  onList: () => void;
}) {
  return (
    <div className="p-4 md:p-6">
      <div className="animate-enter mx-auto max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
          <CheckIcon className="h-6 w-6" />
        </span>
        <h1 className="text-h3 font-semibold text-foreground">Oʻquvchi sinfga qoʻshildi</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          <span className="font-medium text-foreground">{name}</span> bazaga qoʻshildi.
          Toʻlov jadvali ochildi, amal audit jurnaliga tushdi.
        </p>
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
