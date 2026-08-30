"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  AlertTriangleIcon,
  BellIcon,
  ClipboardIcon,
  GraduationCapIcon,
  MessageSquareIcon,
  PhoneIcon,
} from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { debtOf, overdueDays, useAdmin, useAdminDispatch, useDebtors, useFinanceSummary } from "@/lib/admin/store";
import { DOCUMENT_TYPE_LABELS } from "@/lib/admin/types";
import { isOpen } from "@/lib/school/appeals";

const TODAY_LABEL = "20-sentabr, 2026";

/** Admin bosh sahifasi — analitika emas, ish navbati. */
export function AdminDashboard() {
  const { applications, documents, students, appeals, leads } = useAdmin();
  const finance = useFinanceSummary();
  const debtors = useDebtors();

  const newApplications = applications.filter((a) => a.status === "new");
  const openDocuments = documents.filter((d) => d.status !== "issued");
  const openAppeals = appeals.filter(isOpen);

  // Lidlar: hali arizaga yetmagan va yoʻqotilmaganlari.
  const activeLeads = leads.filter((l) => l.stage !== "rad" && l.stage !== "ariza").length;
  const overdueLeads = leads.filter(
    (l) => l.stage !== "rad" && l.stage !== "ariza" && l.nextActionAt < "2026-09-20",
  ).length;

  // Eng kech qolgan qarzdor — navbatning birinchi qatoriga chiqadi.
  const worstDebtor = debtors[0];

  const recentlyEnrolled = useMemo(
    () => [...students].sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt)).slice(0, 4),
    [students],
  );

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2 font-bold text-foreground">Bugungi ishlar</h1>
        <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm text-foreground-muted">
          {TODAY_LABEL}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <QueueCard
          href="/admin/lidlar"
          icon={<PhoneIcon className="h-5 w-5" />}
          tone="brand"
          value={activeLeads}
          label="Faol lidlar"
          note={overdueLeads > 0 ? `${overdueLeads} tasi kechikdi` : undefined}
          index={0}
        />
        <QueueCard
          href="/admin/qabul"
          icon={<GraduationCapIcon className="h-5 w-5" />}
          tone="warning"
          value={newApplications.length}
          label="Yangi arizalar"
          index={1}
        />
        <QueueCard
          href="/admin/tolovlar"
          icon={<AlertTriangleIcon className="h-5 w-5" />}
          tone="danger"
          value={finance.debtorCount}
          label="Qarzdorlar"
          note={formatSom(finance.debt)}
          index={2}
        />
        <QueueCard
          href="/admin/malumotnomalar"
          icon={<ClipboardIcon className="h-5 w-5" />}
          tone="info"
          value={openDocuments.length}
          label="Maʼlumotnoma soʻrovi"
          index={3}
        />
        <QueueCard
          href="/admin/murojaatlar"
          icon={<MessageSquareIcon className="h-5 w-5" />}
          tone="brand"
          value={openAppeals.length}
          label="Javob kutayotgan murojaat"
          index={4}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">Navbatdagi vazifalar</h2>
          <ul className="flex flex-col gap-3">
            {newApplications[0] && (
              <TaskRow
                tone="warning"
                icon={<GraduationCapIcon className="h-5 w-5 text-warning" />}
                title={`Yangi ariza: ${shortName(newApplications[0].studentFullName)} (${newApplications[0].className})`}
                context={`Ota-ona: ${shortName(newApplications[0].guardianFullName)} · ${newApplications[0].createdAt}`}
                href="/admin/qabul"
                action="Koʻrib chiqish"
              />
            )}
            {openDocuments[0] && (
              <TaskRow
                tone="info"
                icon={<ClipboardIcon className="h-5 w-5 text-info" />}
                title={`Maʼlumotnoma soʻrovi: ${nameOf(students, openDocuments[0].studentId)}`}
                context={`Turi: ${DOCUMENT_TYPE_LABELS[openDocuments[0].type].toLowerCase()}`}
                href="/admin/malumotnomalar"
                action="Tayyorlash"
              />
            )}
            {worstDebtor && (
              <TaskRow
                tone="danger"
                icon={<AlertTriangleIcon className="h-5 w-5 text-danger" />}
                title={`Qarzdorlik ${overdueDays(worstDebtor)} kun: ${worstDebtor.fullName} (${worstDebtor.className})`}
                context={`Qarz ${formatSom(debtOf(worstDebtor))} · ${worstDebtor.guardianName}`}
                href="/admin/tolovlar"
                action="Toʻlovni kiritish"
              />
            )}
            {openAppeals[0] && (
              <TaskRow
                tone="brand"
                icon={<MessageSquareIcon className="h-5 w-5 text-brand" />}
                title={`Ota-ona murojaati: ${openAppeals[0].parentName}`}
                context={`Mavzu: ${openAppeals[0].title.toLowerCase()}`}
                href="/admin/murojaatlar"
                action="Javob berish"
              />
            )}
          </ul>
        </section>

        <div className="flex flex-col gap-5">
          <Card className="animate-enter">
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Soʻnggi qabul qilinganlar
              </h2>
              <Link
                href="/admin/oquvchilar"
                className="focus-ring shrink-0 rounded text-xs font-medium text-brand-dark hover:underline"
              >
                Barchasini koʻrish
              </Link>
            </div>
            <ul className="flex flex-col gap-2.5">
              {recentlyEnrolled.map((student) => (
                <li key={student.id} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11px] font-semibold text-brand-dark">
                    {initials(student.fullName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {student.fullName}
                    </span>
                    <span className="block text-xs text-foreground-muted">
                      {student.className} sinf
                    </span>
                  </span>
                  <span className="num shrink-0 text-xs text-foreground-muted">
                    {student.enrolledAt.slice(5).replace("-", ".")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <ReminderCard count={finance.debtorCount} />
        </div>
      </div>
    </div>
  );
}

const TONE_ICON_BG = {
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
  brand: "bg-brand-tint text-brand-dark",
} as const;

const TONE_BORDER = {
  warning: "border-l-warning",
  danger: "border-l-danger",
  info: "border-l-info",
  brand: "border-l-brand",
} as const;

type Tone = keyof typeof TONE_ICON_BG;

function QueueCard({
  href,
  icon,
  tone,
  value,
  label,
  note,
  index,
}: {
  href: string;
  icon: React.ReactNode;
  tone: Tone;
  value: number;
  label: string;
  note?: string;
  index: number;
}) {
  return (
    <Link
      href={href}
      style={{ animationDelay: `${index * 40}ms` }}
      className="animate-enter card-interactive focus-ring block rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${TONE_ICON_BG[tone]}`}
      >
        {icon}
      </span>
      <p className="flex items-baseline gap-1">
        <span className="num text-3xl font-bold text-foreground">{value}</span>
        <span className="text-sm text-foreground-muted">ta</span>
      </p>
      <p className="mt-0.5 text-sm text-foreground-muted">{label}</p>
      {note && <p className="num mt-0.5 text-sm font-medium text-danger">{note}</p>}
    </Link>
  );
}

function TaskRow({
  tone,
  icon,
  title,
  context,
  href,
  action,
}: {
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  context: string;
  href: string;
  action: string;
}) {
  return (
    <li
      className={`animate-enter flex flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 border-border bg-surface p-4 shadow-sm ${TONE_BORDER[tone]}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">{context}</p>
        </div>
      </div>
      <Link
        href={href}
        className="focus-ring shrink-0 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
      >
        {action}
      </Link>
    </li>
  );
}

/** Ommaviy eslatma — do'konga yozadi va audit jurnaliga tushadi. */
function ReminderCard({ count }: { count: number }) {
  const dispatch = useAdminDispatch();
  const debtors = useDebtors();
  const { reminders } = useAdmin();
  const [sent, setSent] = useState(false);

  const last = reminders[0];

  return (
    <Card className="animate-enter border-danger-tint bg-danger-tint/40">
      <div className="flex items-start gap-2.5">
        <BellIcon className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Eslatma yuborish</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Tizimda <span className="num font-semibold text-danger">{count}</span> nafar qarzdor
            ota-ona mavjud.
          </p>
        </div>
      </div>

      {sent || last ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-foreground-muted">
          Oxirgi eslatma:{" "}
          <span className="font-medium text-foreground">{last?.sentAt ?? "hozir"}</span> ·{" "}
          <span className="num">{last?.studentIds.length ?? count}</span> nafarga
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          dispatch({
            type: "SEND_REMINDER",
            studentIds: debtors.map((d) => d.id),
            channel: "bot",
            text: "Hurmatli ota-ona, farzandingiz uchun oylik toʻlov muddati oʻtdi.",
          });
          setSent(true);
        }}
        className="focus-ring mt-3 w-full rounded-lg border border-danger bg-surface px-3 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger hover:text-brand-foreground"
      >
        Ommaviy eslatma yuborish
      </button>
    </Card>
  );
}

function nameOf(students: { id: string; fullName: string; className: string }[], id: string) {
  const student = students.find((s) => s.id === id);
  return student ? `${student.fullName} (${student.className})` : "—";
}

function shortName(fullName: string): string {
  return fullName.split(" ").slice(0, 2).join(" ");
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
