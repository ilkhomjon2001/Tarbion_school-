"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StudentDrawer } from "@/components/admin/StudentDrawer";
import { PlusIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import { debtOf, useAdmin, useAdminDispatch } from "@/lib/admin/store";
import type { AdminStudent } from "@/lib/admin/types";
import { allClassNames } from "@/lib/school/staff";

const PAGE_SIZE = 15;

type StatusFilter = "active" | "archived" | "all";

const STATUS_LABELS: Record<StatusFilter, string> = {
  active: "Faol",
  archived: "Arxivlangan",
  all: "Barchasi",
};

/** Oʻquvchilar bazasi — qidiruv, filtr, ommaviy amallar. */
export function StudentsBoard({ initialQuery = "" }: { initialQuery?: string }) {
  const { students } = useAdmin();
  const [query, setQuery] = useState(initialQuery);
  const [className, setClassName] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  const profile = profileFor ? students.find((s) => s.id === profileFor) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (className !== "all" && s.className !== className) return false;
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.guardianName.toLowerCase().includes(q) ||
        s.guardianPhone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      );
    });
  }, [students, query, className, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
      setSelected([]);
    };
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Oʻquvchilar</h1>
          <p className="text-sm text-foreground-muted">
            Jami <span className="num">{students.filter((s) => s.status === "active").length}</span>{" "}
            ta faol oʻquvchi
          </p>
        </div>
        <Link
          href="/admin/qabul?yangi=1"
          className="focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Yangi oʻquvchi qabul qilish
        </Link>
      </div>

      {/* Filtrlar */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Ism, familiya yoki telefon orqali qidirish…"
            aria-label="Oʻquvchi qidirish"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
        <select
          value={className}
          onChange={(e) => resetPage(setClassName)(e.target.value)}
          aria-label="Sinf"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Barcha sinflar</option>
          {allClassNames().map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => resetPage(setStatus)(e.target.value as StatusFilter)}
          aria-label="Holati"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {selected.length > 0 && <BulkBar selected={selected} onDone={() => setSelected([])} />}

      {rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-5 w-5" />}
          title="Oʻquvchi topilmadi"
          description="Qidiruv soʻzini yoki filtrni oʻzgartirib koʻring."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Sahifadagi hammasini tanlash"
                      checked={rows.every((r) => selected.includes(r.id))}
                      onChange={(e) =>
                        setSelected(e.target.checked ? rows.map((r) => r.id) : [])
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                  </th>
                  <th className="px-3 py-3">Oʻquvchi</th>
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3">Ota-ona</th>
                  <th className="px-3 py-3">Qabul sanasi</th>
                  <th className="px-3 py-3">Toʻlov holati</th>
                  <th className="px-3 py-3">Davomat</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    checked={selected.includes(student.id)}
                    onCheck={(on) =>
                      setSelected((prev) =>
                        on ? [...prev, student.id] : prev.filter((id) => id !== student.id),
                      )
                    }
                    menuOpen={menuFor === student.id}
                    onMenu={() => setMenuFor(menuFor === student.id ? null : student.id)}
                    onClose={() => setMenuFor(null)}
                    onOpenProfile={() => setProfileFor(student.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-foreground-muted">
            <p>
              Oʻquvchi oʻchirilmaydi — arxivlanadi, baholari va toʻlov tarixi saqlanadi.
            </p>
            <div className="flex items-center gap-3">
              <span className="num">
                {safePage * PAGE_SIZE + 1}–{safePage * PAGE_SIZE + rows.length} / {filtered.length}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="focus-ring rounded-md border border-border px-2 py-1 transition-colors hover:bg-surface-muted disabled:opacity-40"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="focus-ring rounded-md border border-border px-2 py-1 transition-colors hover:bg-surface-muted disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profile && <StudentDrawer student={profile} onClose={() => setProfileFor(null)} />}
    </div>
  );
}

function StudentRow({
  student,
  checked,
  onCheck,
  menuOpen,
  onMenu,
  onClose,
  onOpenProfile,
}: {
  student: AdminStudent;
  checked: boolean;
  onCheck: (on: boolean) => void;
  menuOpen: boolean;
  onMenu: () => void;
  onClose: () => void;
  onOpenProfile: () => void;
}) {
  const dispatch = useAdminDispatch();
  const debt = debtOf(student);
  const tone = debt === 0 ? "success" : student.paidAmount > 0 ? "warning" : "danger";
  const label = debt === 0 ? "Toʻlangan" : student.paidAmount > 0 ? "Qisman" : "Kechikkan";

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50">
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          aria-label={`${student.fullName} tanlash`}
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={onOpenProfile}
          className="focus-ring flex w-full items-center gap-2.5 rounded text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-foreground-muted">
            {student.fullName
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0])
              .join("")}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground hover:text-brand-dark">
              {student.fullName}
            </span>
            <span className="num block text-xs text-foreground-muted">{student.birthYear}</span>
          </span>
        </button>
      </td>
      <td className="px-3 py-2.5 text-foreground-muted">{student.className}</td>
      <td className="px-3 py-2.5">
        <span className="block text-foreground">{student.guardianName}</span>
        <span className="num block text-xs text-foreground-muted">{student.guardianPhone}</span>
      </td>
      <td className="num px-3 py-2.5 text-foreground-muted">{student.enrolledAt}</td>
      <td className="px-3 py-2.5">
        {student.status === "archived" ? (
          <Badge tone="neutral">Arxivlangan</Badge>
        ) : (
          <Badge tone={tone}>{label}</Badge>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-surface-muted">
            <span
              className={`bar-fill block h-full rounded-full ${
                student.attendancePercent >= 90
                  ? "bg-success"
                  : student.attendancePercent >= 85
                    ? "bg-warning"
                    : "bg-danger"
              }`}
              style={{ width: `${student.attendancePercent}%` }}
            />
          </span>
          <span className="num text-xs font-medium text-foreground">
            {student.attendancePercent}%
          </span>
        </span>
      </td>
      <td className="relative px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={onMenu}
          aria-label={`${student.fullName} amallari`}
          aria-expanded={menuOpen}
          className="focus-ring rounded px-1.5 text-foreground-muted transition-colors hover:text-foreground"
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            className="animate-expand absolute right-2 top-10 z-20 w-56 rounded-lg border border-border bg-surface py-1 text-left shadow-lg"
            onMouseLeave={onClose}
          >
            <button
              type="button"
              onClick={() => {
                onOpenProfile();
                onClose();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-muted"
            >
              Profilni koʻrish
            </button>
            <Link
              href={`/admin/malumotnomalar?student=${student.id}`}
              className="block px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
            >
              Maʼlumotnoma yaratish
            </Link>
            <Link
              href="/admin/tolovlar"
              className="block px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
            >
              Toʻlovni koʻrish
            </Link>
            <Link
              href="/admin/murojaatlar"
              className="block px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
            >
              Ota-ona bilan bogʻlanish
            </Link>
            {student.status === "active" ? (
              <button
                type="button"
                onClick={() => {
                  // Tasdiq va sabab profil panelida soʻraladi — bir bosishda
                  // arxivlanib qolmasin.
                  onOpenProfile();
                  onClose();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-tint"
              >
                Arxivlash…
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "RESTORE_STUDENT", studentId: student.id });
                  onClose();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-success transition-colors hover:bg-success-tint"
              >
                Arxivdan qaytarish
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/** Bir nechta oʻquvchi tanlanganda chiqadigan amallar paneli. */
function BulkBar({ selected, onDone }: { selected: string[]; onDone: () => void }) {
  const dispatch = useAdminDispatch();
  const [className, setClassName] = useState("");

  return (
    <div className="animate-enter flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-brand-tint px-4 py-3">
      <span className="text-sm font-medium text-brand-dark">
        <span className="num">{selected.length}</span> ta oʻquvchi tanlandi
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <select
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          aria-label="Yangi sinf"
          className="focus-ring h-9 rounded-lg border border-border bg-surface px-2 text-sm"
        >
          <option value="">Sinfni tanlang</option>
          {allClassNames().map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!className}
          onClick={() => {
            dispatch({ type: "CHANGE_CLASS", studentIds: selected, className });
            onDone();
          }}
          className="focus-ring h-9 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          Sinfni oʻzgartirish
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({
              type: "SEND_REMINDER",
              studentIds: selected,
              channel: "bot",
              text: "Hurmatli ota-ona, maktab maʼmuriyatidan eslatma.",
            });
            onDone();
          }}
          className="focus-ring h-9 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          Eslatma yuborish
        </button>
        <button
          type="button"
          onClick={onDone}
          className="focus-ring h-9 rounded-lg px-3 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface"
        >
          Bekor qilish
        </button>
      </div>
    </div>
  );
}
