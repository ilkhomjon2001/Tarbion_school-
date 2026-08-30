"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { ACADEMIC_YEAR, useAdmin, useAdminDispatch } from "@/lib/admin/store";
import { APPLICATION_STATUS_LABELS, type Application } from "@/lib/admin/types";
import { CLASSES } from "@/lib/director/school-data";
import { homeroomTeacherOf } from "@/lib/school/staff";

const STEPS = ["Oʻquvchi", "Ota-ona / vasiy", "Sinf va shartnoma", "Tasdiqlash"];

const MONTHS_IN_YEAR = 9;
const CLASS_CAPACITY = 30;

/** Bosqich raqamiga qarab boshqariladigan qabul formasi. */
export function EnrollWizard() {
  const router = useRouter();
  const { applications, students } = useAdmin();
  const dispatch = useAdminDispatch();

  const [draft, setDraft] = useState<Application | null>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string | null>(null);

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

  function start(application: Application) {
    setDraft({ ...application });
    setStep(2); // shaxsiy maʼlumot arizadan keladi — darhol shartnomaga
    setDone(null);
  }

  function update(patch: Partial<Application>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  if (done) {
    return <EnrolledScreen name={done} onMore={() => setDone(null)} onList={() => router.push("/admin/oquvchilar")} />;
  }

  if (!draft) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Qabul</h1>
          <p className="text-sm text-foreground-muted">
            Kelib tushgan arizalar — birini tanlab qabul jarayonini boshlang
          </p>
        </div>

        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center text-sm text-foreground-muted">
            Yangi ariza yoʻq.
          </p>
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
                    onClick={() => start(application)}
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

  const yearly = Math.round((draft.monthlyFee * (100 - draft.discountPercent)) / 100) * MONTHS_IN_YEAR;
  const monthly = Math.round((draft.monthlyFee * (100 - draft.discountPercent)) / 100);

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

      <Stepper step={step} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="p-4">
            {step === 2 ? (
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
            ) : (
              <ConfirmStep application={{ ...draft, monthlyFee: monthly }} />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-tint px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-brand-dark">
              Dastlabki hisob-kitob
            </span>
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-muted/50 px-4 py-3">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="focus-ring rounded text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Qoralama sifatida saqlash
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(2, s - 1))}
                disabled={step === 2}
                className="focus-ring rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-40"
              >
                Orqaga
              </button>
              {step === 2 ? (
                <button
                  type="button"
                  disabled={draft.discountPercent > 0 && !draft.discountReason.trim()}
                  onClick={() => setStep(3)}
                  className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
                >
                  Keyingisi →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "ACCEPT_APPLICATION", application: draft });
                    setDone(draft.studentFullName);
                    setDraft(null);
                  }}
                  className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
                >
                  Qabul qilish va shartnomani ochish
                </button>
              )}
            </div>
          </div>
        </div>

        <RecapPanel application={draft} />
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-3">
      {STEPS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "next";
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
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
        Maʼlumotlarni tekshiring. Tasdiqlangach oʻquvchi bazaga qoʻshiladi va shartnoma
        boʻyicha toʻlov jadvali ochiladi.
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Oʻquvchi">{application.studentFullName}</Row>
        <Row label="Tugʻilgan sana">{application.birthDate}</Row>
        <Row label="Sinf">{application.className}</Row>
        <Row label="Qabul sanasi">{application.enrollDate}</Row>
        <Row label="Ota-ona">{application.guardianFullName}</Row>
        <Row label="Telefon">{application.guardianPhone}</Row>
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

function RecapPanel({ application }: { application: Application }) {
  return (
    <aside className="h-fit rounded-xl border border-border bg-surface p-4 shadow-sm xl:sticky xl:top-20">
      <h2 className="mb-3 text-base font-semibold text-foreground">Kiritilgan maʼlumot</h2>

      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        1. Oʻquvchi
      </p>
      <div className="mt-1.5 rounded-lg bg-surface-muted p-3">
        <p className="text-sm font-medium text-foreground">{application.studentFullName}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <Row label="Tugʻilgan sana">{application.birthDate}</Row>
          <Row label="Jinsi">{application.gender === "erkak" ? "Erkak" : "Ayol"}</Row>
        </dl>
        <p className="mt-2 border-t border-border pt-2 text-xs text-foreground-muted">
          Oldingi taʼlim muassasasi
          <span className="mt-0.5 block text-foreground">{application.previousSchool}</span>
        </p>
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        2. Ota-ona / vasiy
      </p>
      <div className="mt-1.5 rounded-lg bg-surface-muted p-3">
        <p className="text-sm font-medium text-foreground">{application.guardianFullName}</p>
        <span className="mt-1 inline-block">
          <Badge tone="success">{application.guardianRelation}</Badge>
        </span>
        <dl className="mt-2 space-y-1.5 text-xs">
          <Row label="Telefon raqami">{application.guardianPhone}</Row>
          <Row label="Manzil">{application.address}</Row>
        </dl>
      </div>
    </aside>
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
        <h1 className="text-h3 font-semibold text-foreground">Oʻquvchi qabul qilindi</h1>
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
            Yana ariza koʻrib chiqish
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
