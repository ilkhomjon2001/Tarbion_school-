"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PlusIcon, UsersIcon } from "@/components/ui/icons";
import type { ClassStage, SchoolClass } from "@/lib/director/types";

const STAGE_FILTERS: { id: ClassStage | "all"; label: string }[] = [
  { id: "all", label: "Barcha sinflar" },
  { id: "boshlangʻich", label: "Boshlangʻich" },
  { id: "oʻrta", label: "Oʻrta" },
  { id: "yuqori", label: "Yuqori" },
];

export function ClassesBoard({ classes }: { classes: SchoolClass[] }) {
  const [stage, setStage] = useState<ClassStage | "all">("all");
  const [selectedId, setSelectedId] = useState(classes[0]?.id ?? "");

  const filtered = useMemo(
    () => (stage === "all" ? classes : classes.filter((c) => c.stage === stage)),
    [classes, stage],
  );

  const selected = classes.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStage(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                stage === f.id
                  ? "bg-brand text-brand-foreground"
                  : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <PlusIcon className="h-4 w-4" />
          Yangi sinf
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((cls) => (
          <button
            key={cls.id}
            type="button"
            onClick={() => setSelectedId(cls.id)}
            className={`rounded-xl border bg-surface p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
              selected?.id === cls.id
                ? "border-brand ring-1 ring-brand"
                : "border-border hover:border-brand/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-lg text-base font-bold ${
                  selected?.id === cls.id
                    ? "bg-brand text-brand-foreground"
                    : "bg-surface-muted text-foreground"
                }`}
              >
                {cls.name}
              </span>
              <span className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground-muted">
                <UsersIcon className="h-3.5 w-3.5" />
                {cls.studentCount}
              </span>
            </div>
            <p className="mt-3 text-xs text-foreground-muted">Sinf rahbari</p>
            <p className="text-sm font-medium text-foreground">{cls.homeroomTeacherName}</p>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-foreground-muted">Oʻrtacha davomat</p>
              <p
                className={`text-sm font-semibold ${
                  cls.averageAttendance < 85 ? "text-danger" : "text-success"
                }`}
              >
                {cls.averageAttendance}%
              </p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-5 rounded-xl border border-brand/40 bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{selected.name} sinf</h2>
              <p className="text-xs text-foreground-muted">Rahbar: {selected.homeroomTeacherName}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <span>
                <span className="font-semibold text-foreground">{selected.studentCount}</span>{" "}
                <span className="text-foreground-muted">oʻquvchi</span>
              </span>
              <span>
                <span className="font-semibold text-success">{selected.averageAttendance}%</span>{" "}
                <span className="text-foreground-muted">davomat</span>
              </span>
            </div>
          </div>

          {selected.students.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground-muted">
              Roʻyxat hozircha boʻsh.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="py-2">F.I.Sh</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {selected.students.map((student) => (
                  <tr key={student.id} className="border-t border-border">
                    <td className="flex items-center gap-2.5 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-foreground-muted">
                        {student.fullName
                          .split(" ")
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join("")}
                      </span>
                      {student.fullName}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={student.status === "active" ? "success" : "danger"}>
                        {student.status === "active" ? "Faol" : "Sababsiz"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
