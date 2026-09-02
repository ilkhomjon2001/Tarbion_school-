"use client";

/**
 * Admin bosh sahifasi — BAZADAN.
 *
 * Avval bu yerda `lib/admin/store` dagi soxta navbat va moliya turardi.
 * Endi uch manba, uchchalasi ham server: moliya jamlanmasi
 * (`payments/summary`), maktab koʻrsatkichlari (`director/overview` —
 * u administratorga ham ochiq) va murojaatlar jamlanmasi.
 * Bittasi yiqilsa qolganlari baribir koʻrsatiladi.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ResetQueue } from "@/components/admin/ResetQueue";
import { Card } from "@/components/ui/Card";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  ClipboardIcon,
  GraduationCapIcon,
  MessageSquareIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { fetchSummary as fetchAppealsSummary } from "@/lib/appeals/api";
import { fetchOverview, type DirectorOverviewOut } from "@/lib/director/api";
import { fetchFinanceSummary, type FinanceSummaryOut } from "@/lib/payments/api";
import { apiXato } from "@/lib/school/api";

/** Bugungi sana — Toshkent vaqti bilan, «1-sentabr, 2026» koʻrinishida. */
function todayLabel(): string {
  const parts = new Intl.DateTimeFormat("uz-Latn-UZ", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}, ${get("year")}`;
}

export function AdminDashboard() {
  const [finance, setFinance] = useState<FinanceSummaryOut | null>(null);
  const [overview, setOverview] = useState<DirectorOverviewOut | null>(null);
  const [openAppeals, setOpenAppeals] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      // Har bir manba mustaqil: biri yiqilsa qolganlari chiqaveradi.
      const [fin, ov, ap] = await Promise.allSettled([
        fetchFinanceSummary(),
        fetchOverview(30),
        fetchAppealsSummary(),
      ]);
      if (fin.status === "fulfilled") setFinance(fin.value);
      if (ov.status === "fulfilled") setOverview(ov.value);
      if (ap.status === "fulfilled") setOpenAppeals(ap.value.new + ap.value.open);
      if (fin.status === "rejected" && ov.status === "rejected") {
        setError(apiXato(fin.reason, "Maʼlumotni serverdan olib boʻlmadi."));
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2 font-bold text-foreground">Bugungi ishlar</h1>
        <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm text-foreground-muted">
          {todayLabel()}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Parolni tiklash navbati — soʻrov boʻlmasa umuman koʻrinmaydi. */}
      <ResetQueue />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            href="/admin/oquvchilar"
            icon={<UsersIcon className="h-5 w-5" />}
            tone="brand"
            label="Oʻquvchilar"
            value={overview ? overview.total_students.toLocaleString("uz-Latn") : "—"}
            note={overview ? `${overview.total_classes} ta sinf` : "Maʼlumot kelmadi"}
            index={0}
          />
          <StatCard
            href="/admin/tolovlar"
            icon={<WalletIcon className="h-5 w-5" />}
            tone="info"
            label="Tushum (jami)"
            value={finance ? formatSom(finance.paid) : "—"}
            note={
              finance
                ? `Hisoblangan: ${formatSom(finance.charged)}`
                : "Maʼlumot kelmadi"
            }
            index={1}
          />
          <StatCard
            href="/admin/tolovlar"
            icon={<AlertTriangleIcon className="h-5 w-5" />}
            tone="danger"
            label="Qarzdorlar"
            value={finance ? String(finance.debtors) : "—"}
            note={finance ? `Qarz: ${formatSom(finance.debt)}` : "Maʼlumot kelmadi"}
            index={2}
          />
          <StatCard
            href="/admin/murojaatlar"
            icon={<MessageSquareIcon className="h-5 w-5" />}
            tone="warning"
            label="Ochiq murojaatlar"
            value={openAppeals === null ? "—" : String(openAppeals)}
            note={
              openAppeals === null
                ? "Maʼlumot kelmadi"
                : openAppeals > 0
                  ? "Javob kutilmoqda"
                  : "Hammasiga javob berilgan"
            }
            index={3}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">Tezkor havolalar</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickLink
              href="/admin/qabul?yangi=1"
              icon={<GraduationCapIcon className="h-5 w-5 text-brand" />}
              title="Yangi oʻquvchi qabul qilish"
              context="Oʻquvchi, vasiy hisobi va shartnoma — toʻrt qadamda"
            />
            <QuickLink
              href="/admin/tolovlar"
              icon={<WalletIcon className="h-5 w-5 text-info" />}
              title="Toʻlov kiritish"
              context="Naqd yoki oʻtkazma toʻlovni daftariga yozish"
            />
            <QuickLink
              href="/admin/malumotnomalar"
              icon={<ClipboardIcon className="h-5 w-5 text-warning" />}
              title="Maʼlumotnoma tayyorlash"
              context="Oʻqish joyi va boshqa hujjatlar — shablondan"
            />
            <QuickLink
              href="/admin/baza"
              icon={<BookOpenIcon className="h-5 w-5 text-success" />}
              title="Maʼlumot bazasi"
              context="Sinflar, fanlar, dars jadvali va oʻquv yili"
            />
          </ul>
        </section>

        <Card className="animate-enter h-fit">
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Davomat (oxirgi 30 kun)
          </h2>
          {overview === null ? (
            <p className="text-sm text-foreground-muted">
              {loading ? "Yuklanmoqda…" : "Maʼlumotni olib boʻlmadi."}
            </p>
          ) : (
            <>
              <p className="num text-3xl font-bold text-foreground">
                {overview.attendance_percent}%
              </p>
              <p className="mt-1 text-sm text-foreground-muted">
                {overview.lessons_conducted.toLocaleString("uz-Latn")} ta dars oʻtildi ·{" "}
                {overview.total_teachers} ustoz
              </p>
            </>
          )}
        </Card>
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

type Tone = keyof typeof TONE_ICON_BG;

function StatCard({
  href,
  icon,
  tone,
  label,
  value,
  note,
  index,
}: {
  href: string;
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: string;
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
      <p className="num text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-sm text-foreground-muted">{label}</p>
      {note && <p className="mt-0.5 text-xs text-foreground-muted">{note}</p>}
    </Link>
  );
}

function QuickLink({
  href,
  icon,
  title,
  context,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  context: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="animate-enter card-interactive focus-ring flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
      >
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 block text-xs text-foreground-muted">{context}</span>
        </span>
      </Link>
    </li>
  );
}
