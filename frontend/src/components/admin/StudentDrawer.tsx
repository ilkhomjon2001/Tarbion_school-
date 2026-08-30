"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { XIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { debtOf, overdueDays, useAdmin, useAdminDispatch } from "@/lib/admin/store";
import {
  CONTRACT_END_REASONS,
  DEBT_ACTION_LABELS,
  DOCUMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type AdminStudent,
  type ContractEndReason,
} from "@/lib/admin/types";
import { homeroomTeacherOf } from "@/lib/school/staff";

/**
 * Oʻquvchi profili — bitta oʻquvchi boʻyicha hamma narsa bir joyda:
 * shartnoma, toʻlov tarixi, berilgan hujjatlar, qarzdorlik amallari.
 * Admin uchun asosiy "kim bu bola" ekrani.
 */
export function StudentDrawer({
  student,
  onClose,
}: {
  student: AdminStudent;
  onClose: () => void;
}) {
  const dispatch = useAdminDispatch();
  const { payments, documents, debtActions } = useAdmin();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveReason, setArchiveReason] = useState("Ota-ona arizasi asosida");
  const [endReason, setEndReason] = useState<ContractEndReason>("boshqa_maktab");
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const debt = debtOf(student);
  const days = overdueDays(student);
  const history = payments.filter((p) => p.studentId === student.id);
  const docs = documents.filter((d) => d.studentId === student.id);
  const actions = debtActions.filter((a) => a.studentId === student.id);

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="flex-1 bg-foreground/20"
      />
      <aside className="animate-expand flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-lg sm:w-[460px]">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-dark">
              {student.fullName
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">
                {student.fullName}
              </h2>
              <p className="text-sm text-foreground-muted">
                {student.className} sinf ·{" "}
                <span className="num">{student.birthYear}</span>-yil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Panelni yopish"
            className="focus-ring shrink-0 rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-surface-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {student.status === "archived" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2.5">
              <span className="text-sm text-foreground-muted">
                Oʻquvchi arxivlangan — maʼlumotlari saqlanmoqda.
              </span>
              <button
                type="button"
                onClick={() => dispatch({ type: "RESTORE_STUDENT", studentId: student.id })}
                className="focus-ring rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
              >
                Arxivdan qaytarish
              </button>
            </div>
          )}

          <Section title="Asosiy maʼlumot">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Sinf rahbari">
                {homeroomTeacherOf(student.className)?.fullName ?? "—"}
              </Row>
              <Row label="Qabul sanasi">{student.enrolledAt}</Row>
              <Row label="Ota-ona / vasiy">{student.guardianName}</Row>
              <Row label="Telefon">{student.guardianPhone}</Row>
              <Row label="Oylik davomat">{student.attendancePercent}%</Row>
              <Row label="Holati">
                <Badge tone={student.status === "active" ? "success" : "neutral"}>
                  {student.status === "active" ? "Faol" : "Arxivlangan"}
                </Badge>
              </Row>
            </dl>
          </Section>

          <Section title="Shartnoma va toʻlov">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Oylik summa">{formatSom(student.monthlyFee)}</Row>
              <Row label="Toʻlangan">{formatSom(student.paidAmount)}</Row>
              <Row label="Qarz">
                <span className={debt > 0 ? "text-danger" : "text-success"}>
                  {debt > 0 ? formatSom(debt) : "Yoʻq"}
                </span>
              </Row>
              <Row label="Muddat">
                {student.dueDate}
                {days > 0 && debt > 0 && (
                  <span className="ml-1 text-xs font-normal text-danger">({days} kun)</span>
                )}
              </Row>
              {student.discountPercent > 0 && (
                <Row label="Chegirma">{student.discountPercent}%</Row>
              )}
            </dl>
            <Link
              href="/admin/tolovlar"
              className="focus-ring mt-3 inline-block rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-tint"
            >
              Toʻlovlar boʻlimida ochish
            </Link>
          </Section>

          <Section title={`Toʻlov tarixi (${history.length})`}>
            {history.length === 0 ? (
              <Empty>Bu sessiyada toʻlov kiritilmagan.</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {history.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span
                        className={`num block font-medium ${
                          p.kind === "storno" ? "text-danger" : "text-foreground"
                        }`}
                      >
                        {p.kind === "storno" ? "Storno " : ""}
                        {formatSom(Math.abs(p.amount))}
                      </span>
                      <span className="block text-xs text-foreground-muted">
                        {p.paidAt} · {PAYMENT_METHOD_LABELS[p.method]}
                        {p.receiptNo ? ` · ${p.receiptNo}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {actions.length > 0 && (
            <Section title={`Qarzdorlik amallari (${actions.length})`}>
              <ul className="flex flex-col gap-1.5">
                {actions.map((a) => (
                  <li key={a.id} className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
                    <span className="block font-medium text-foreground">
                      {DEBT_ACTION_LABELS[a.type]}
                      {a.type === "extend" ? ` → ${a.newDueDate}` : ` · ${formatSom(a.amount)}`}
                    </span>
                    <span className="block text-xs text-foreground-muted">{a.reason}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`Maʼlumotnomalar (${docs.length})`}>
            {docs.length === 0 ? (
              <Empty>Hujjat soʻralmagan.</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {DOCUMENT_TYPE_LABELS[d.type]}
                      </span>
                      <span className="num block text-xs text-foreground-muted">
                        {d.number ? `№ ${d.number} · ${d.issuedAt}` : d.createdAt}
                      </span>
                    </span>
                    <Badge tone={d.status === "issued" ? "success" : "warning"}>
                      {d.status === "issued" ? "Berildi" : "Navbatda"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/admin/malumotnomalar?student=${student.id}`}
              className="focus-ring mt-3 inline-block rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-tint"
            >
              Maʼlumotnoma yaratish
            </Link>
          </Section>

          {student.status === "active" && (
            <Section title="Shartnomani yopish">
              {confirmArchive ? (
                <div className="animate-enter flex flex-col gap-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-foreground">
                      Ketish sababi
                    </span>
                    <select
                      value={endReason}
                      onChange={(e) => setEndReason(e.target.value as ContractEndReason)}
                      className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                    >
                      {(Object.keys(CONTRACT_END_REASONS) as ContractEndReason[]).map((key) => (
                        <option key={key} value={key}>
                          {CONTRACT_END_REASONS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-foreground">
                      Oxirgi oʻqish kuni
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-foreground">
                      Izoh (audit jurnaliga yoziladi)
                    </span>
                    <input
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      placeholder="Masalan: ota-ona arizasi asosida"
                      className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmArchive(false)}
                      className="focus-ring rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted"
                    >
                      Bekor qilish
                    </button>
                    <button
                      type="button"
                      disabled={!archiveReason.trim() || !endDate}
                      onClick={() => {
                        dispatch({
                          type: "ARCHIVE_STUDENT",
                          studentId: student.id,
                          endReason,
                          endDate,
                          reason: archiveReason.trim(),
                        });
                        setConfirmArchive(false);
                      }}
                      className="focus-ring rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-brand-foreground transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                      Shartnomani yopish
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-foreground-muted">
                    Oʻquvchi oʻchirilmaydi — arxivlanadi. Baholari, davomati va toʻlov
                    tarixi hisobotlarda qoladi, yozuv «Shartnomalar» bazasiga tushadi.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(true)}
                    className="focus-ring mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-tint"
                  >
                    Shartnomani yopish
                  </button>
                </>
              )}
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="num font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-foreground-muted">
      {children}
    </p>
  );
}
