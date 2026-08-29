"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PlusIcon, UsersIcon } from "@/components/ui/icons";
import { reassignHomeroom } from "@/lib/director/data";
import type { ClassStage, SchoolClass, Teacher } from "@/lib/director/types";

const STAGE_FILTERS: { id: ClassStage | "all"; label: string }[] = [
  { id: "all", label: "Barcha sinflar" },
  { id: "boshlangʻich", label: "Boshlangʻich" },
  { id: "oʻrta", label: "Oʻrta" },
  { id: "yuqori", label: "Yuqori" },
];

export function ClassesBoard({
  classes: initialClasses,
  teachers: initialTeachers,
}: {
  classes: SchoolClass[];
  teachers: Teacher[];
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [teachers, setTeachers] = useState(initialTeachers);
  const [stage, setStage] = useState<ClassStage | "all">("all");
  const [selectedId, setSelectedId] = useState(initialClasses[0]?.id ?? "");
  const [editingHomeroom, setEditingHomeroom] = useState(false);
  const [draftTeacherId, setDraftTeacherId] = useState("");

  const filtered = useMemo(
    () => (stage === "all" ? classes : classes.filter((c) => c.stage === stage)),
    [classes, stage],
  );

  const selected = classes.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  function openHomeroomEditor() {
    if (!selected) return;
    setDraftTeacherId(selected.homeroomTeacherId ?? "");
    setEditingHomeroom(true);
  }

  function saveHomeroom() {
    if (!selected) return;
    const result = reassignHomeroom(classes, teachers, selected.id, draftTeacherId || null);
    setClasses(result.classes);
    setTeachers(result.teachers);
    setEditingHomeroom(false);
  }

  // Yangi rahbar avvaldan boshqa sinfga biriktirilgan bo'lsa, ogohlantiramiz
  // (saqlashda u sinfdan avtomatik olib tashlanadi).
  const draftPreviousClass =
    draftTeacherId && classes.find((c) => c.homeroomTeacherId === draftTeacherId && c.id !== selected?.id);

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
            onClick={() => {
              setSelectedId(cls.id);
              setEditingHomeroom(false);
            }}
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
            <p className="text-sm font-medium text-foreground">
              {cls.homeroomTeacherName ?? <span className="italic text-foreground-muted">Tayinlanmagan</span>}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-foreground-muted">Oʻrtacha davomat</p>
              <p
                className={`text-sm font-semibold ${
                  cls.averageAttendance < 85 ? "text-danger" : "text-success"
                }`}
              >
                <span className="num">{cls.averageAttendance}%</span>
              </p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-5 rounded-xl border border-brand/40 bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{selected.name} sinf</h2>

              {editingHomeroom ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={draftTeacherId}
                    onChange={(e) => setDraftTeacherId(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <option value="">Tayinlanmagan</option>
                    {teachers
                      .filter((t) => t.status === "active")
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={saveHomeroom}
                    className="h-9 rounded-lg bg-brand px-3 text-xs font-medium text-brand-foreground hover:bg-brand-dark"
                  >
                    Saqlash
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingHomeroom(false)}
                    className="h-9 rounded-lg px-3 text-xs font-medium text-foreground-muted hover:bg-surface-muted"
                  >
                    Bekor
                  </button>
                  {draftPreviousClass && (
                    <p className="basis-full text-xs text-warning">
                      Diqqat: bu ustoz hozir {draftPreviousClass.name} sinfiga rahbar — saqlansa,
                      u yerdan avtomatik olib tashlanadi.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-0.5 flex items-center gap-2 text-xs text-foreground-muted">
                  Rahbar:{" "}
                  <span className="font-medium text-foreground">
                    {selected.homeroomTeacherName ?? "Tayinlanmagan"}
                  </span>
                  <button
                    type="button"
                    onClick={openHomeroomEditor}
                    className="text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    Oʻzgartirish
                  </button>
                </p>
              )}
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
