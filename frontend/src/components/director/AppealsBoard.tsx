"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageSquareIcon } from "@/components/ui/icons";
import { AppealThread } from "@/components/shared/AppealThread";
import {
  APPEAL_TARGET_LABELS,
  appealStatsByClass,
  isOpen,
  type Appeal,
} from "@/lib/school/appeals";
import { DIRECTOR, staffById } from "@/lib/school/staff";

type Tab = "management" | "teachers";

/**
 * Rahbariyat uchun murojaatlar boshqaruvi.
 *
 * Ikki oqim ajratilgan (loyiha egasi soʻrovi):
 *   – rahbariyatga kelganlar (bu yerdan javob yoziladi),
 *   – ustozlarga kelganlar (rahbariyat kuzatadi, javobni ustoz yozadi).
 *
 * Sinflar kesimidagi grafik qaysi sinfda muammo koʻpligini bir qarashda
 * koʻrsatadi (DIR-02 ga qoʻshimcha).
 */
export function AppealsBoard({ appeals }: { appeals: Appeal[] }) {
  const [tab, setTab] = useState<Tab>("management");

  const management = useMemo(() => appeals.filter((a) => a.target === "rahbariyat"), [appeals]);
  const teachers = useMemo(() => appeals.filter((a) => a.target !== "rahbariyat"), [appeals]);
  const stats = useMemo(() => appealStatsByClass(appeals), [appeals]);

  const shown = tab === "management" ? management : teachers;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Jami murojaatlar" value={appeals.length} />
        <SummaryCard
          label="Ochiq (javob kutilmoqda)"
          value={appeals.filter(isOpen).length}
          tone="warning"
        />
        <SummaryCard
          label="Muammoli sinf"
          value={stats[0]?.className ?? "—"}
          note={stats[0] ? `${stats[0].total} ta murojaat` : undefined}
          tone="danger"
        />
      </div>

      <ClassChart stats={stats} />

      <div>
        <div role="tablist" aria-label="Murojaat oqimlari" className="mb-3 flex gap-1 border-b border-border">
          <TabButton
            active={tab === "management"}
            onClick={() => setTab("management")}
            label="Rahbariyatga"
            count={management.length}
          />
          <TabButton
            active={tab === "teachers"}
            onClick={() => setTab("teachers")}
            label="Ustozlarga"
            count={teachers.length}
          />
        </div>

        {tab === "teachers" && (
          <p className="mb-3 rounded-lg bg-info-tint px-3 py-2 text-xs text-info">
            Bu murojaatlarga tegishli ustoz javob beradi. Rahbariyat javob berilishini
            kuzatadi — kechiksa, ustoz bilan gaplashadi.
          </p>
        )}

        {shown.length === 0 ? (
          <EmptyState
            icon={<MessageSquareIcon className="h-5 w-5" />}
            title="Murojaat yoʻq"
            description={
              tab === "management"
                ? "Rahbariyatga hozircha hech kim murojaat qilmagan."
                : "Ustozlarga hozircha murojaat kelmagan."
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((appeal, i) => (
              <li key={appeal.id} className="animate-enter" style={{ animationDelay: `${i * 40}ms` }}>
                {tab === "teachers" && <AssigneeLine appeal={appeal} />}
                <AppealThread
                  appeal={appeal}
                  viewer="staff"
                  viewerStaffId={DIRECTOR.id}
                  defaultOpen={false}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AssigneeLine({ appeal }: { appeal: Appeal }) {
  const assignee = staffById(appeal.assigneeId);
  return (
    <p className="mb-1 text-xs text-foreground-muted">
      {APPEAL_TARGET_LABELS[appeal.target]}
      {appeal.subject ? ` · ${appeal.subject}` : ""} → {assignee?.fullName ?? "—"}
    </p>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-ring ${
        active
          ? "border-brand text-brand-dark"
          : "border-transparent text-foreground-muted hover:text-foreground"
      }`}
    >
      {label} <span className="num opacity-70">({count})</span>
    </button>
  );
}

function SummaryCard({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold num ${toneClass}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-foreground-muted">{note}</p>}
    </Card>
  );
}

/**
 * Sinflar kesimida murojaatlar — gorizontal ustunli grafik. Har ustun
 * ikki qismga boʻlingan: rahbariyatga va ustozlarga kelganlar.
 */
function ClassChart({
  stats,
}: {
  stats: { className: string; total: number; open: number; toManagement: number; toTeachers: number }[];
}) {
  const max = Math.max(...stats.map((s) => s.total), 1);

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Sinflar kesimida murojaatlar
        </h2>
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-brand" />
            Rahbariyatga
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-info" />
            Ustozlarga
          </span>
        </div>
      </div>
      <p className="mb-4 text-xs text-foreground-muted">
        Koʻpdan kamga tartiblangan — eng tepadagi sinf koʻproq eʼtibor talab qiladi.
      </p>

      {stats.length === 0 ? (
        <p className="text-sm text-foreground-muted">Maʼlumot yoʻq.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stats.map((stat) => (
            <li key={stat.className} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-sm font-medium text-foreground">
                {stat.className}
              </span>
              <div className="flex h-5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="bar-fill h-full bg-brand"
                  style={{ width: `${(stat.toManagement / max) * 100}%` }}
                  title={`Rahbariyatga: ${stat.toManagement}`}
                />
                <div
                  className="bar-fill h-full bg-info"
                  style={{ width: `${(stat.toTeachers / max) * 100}%` }}
                  title={`Ustozlarga: ${stat.toTeachers}`}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-foreground-muted">
                <span className="num font-medium text-foreground">{stat.total}</span> ta ·{" "}
                <span className="num">{stat.open}</span> ochiq
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
