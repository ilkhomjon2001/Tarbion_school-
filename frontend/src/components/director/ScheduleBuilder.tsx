"use client";

import { useMemo, useState } from "react";
import { AlertTriangleIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { subjectColor } from "@/lib/subject-colors";
import { PERIOD_TIMES, PERIODS, WEEKDAYS } from "@/lib/director/types";
import type {
  LessonCell,
  ScheduleGrid,
  SchoolClass,
  Teacher,
  Weekday,
} from "@/lib/director/types";

type EditingCell = { day: Weekday; period: number } | null;

type Draft = { subject: string; teacherId: string; room: string };

export function ScheduleBuilder({
  classes,
  teachers,
  subjects,
  initialGrid,
}: {
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: string[];
  initialGrid: ScheduleGrid;
}) {
  const [grid, setGrid] = useState<ScheduleGrid>(initialGrid);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [editing, setEditing] = useState<EditingCell>(null);
  const [draft, setDraft] = useState<Draft>({ subject: subjects[0] ?? "", teacherId: teachers[0]?.id ?? "", room: "" });
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const teacherById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const classGrid = grid[classId];

  function conflictFor(day: Weekday, period: number, teacherId: string, excludeClassId: string) {
    for (const otherClassId of Object.keys(grid)) {
      if (otherClassId === excludeClassId) continue;
      const cell = grid[otherClassId]?.[day]?.[period];
      if (cell && cell.teacherId === teacherId) {
        const otherClass = classes.find((c) => c.id === otherClassId);
        return otherClass?.name ?? otherClassId;
      }
    }
    return null;
  }

  function openEditor(day: Weekday, period: number) {
    const existing = classGrid?.[day]?.[period];
    setDraft({
      subject: existing?.subject ?? subjects[0] ?? "",
      teacherId: existing?.teacherId ?? teachers[0]?.id ?? "",
      room: existing?.room ?? "",
    });
    setEditing({ day, period });
  }

  function closeEditor() {
    setEditing(null);
  }

  function saveCell() {
    if (!editing) return;
    const cell: LessonCell = { subject: draft.subject, teacherId: draft.teacherId, room: draft.room.trim() || "—" };
    setGrid((prev) => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [editing.day]: { ...prev[classId][editing.day], [editing.period]: cell },
      },
    }));
    setEditing(null);
    markSaved();
  }

  function clearCell(day: Weekday, period: number) {
    setGrid((prev) => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [day]: { ...prev[classId][day], [period]: null },
      },
    }));
    markSaved();
  }

  function markSaved() {
    setSavedAt(new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }));
  }

  const draftConflict = editing ? conflictFor(editing.day, editing.period, draft.teacherId, classId) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="class-select" className="text-sm text-foreground-muted">
            Sinf:
          </label>
          <select
            id="class-select"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setEditing(null);
            }}
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} sinf
              </option>
            ))}
          </select>
        </div>
        {savedAt && (
          <p className="text-xs text-foreground-muted">Oʻzgarish saqlandi · {savedAt}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              <th className="w-24 px-3 py-2.5">Para</th>
              {WEEKDAYS.map((day) => (
                <th key={day} className="px-2 py-2.5">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2.5 text-xs text-foreground-muted">
                  <p className="font-medium text-foreground">{period}-para</p>
                  <p>{PERIOD_TIMES[period]}</p>
                </td>
                {WEEKDAYS.map((day) => {
                  const isEditing = editing?.day === day && editing?.period === period;
                  const cell = classGrid?.[day]?.[period] ?? null;
                  const conflictWith = cell
                    ? conflictFor(day, period, cell.teacherId, classId)
                    : null;

                  return (
                    <td key={day} className="min-w-[150px] px-1.5 py-1.5">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5 rounded-lg border border-brand bg-brand-tint/40 p-2">
                          <select
                            value={draft.subject}
                            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                            className="h-8 rounded-md border border-border bg-surface px-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                          >
                            {subjects.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <select
                            value={draft.teacherId}
                            onChange={(e) => setDraft((d) => ({ ...d, teacherId: e.target.value }))}
                            className="h-8 rounded-md border border-border bg-surface px-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                          >
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.shortName}
                              </option>
                            ))}
                          </select>
                          <input
                            value={draft.room}
                            onChange={(e) => setDraft((d) => ({ ...d, room: e.target.value }))}
                            placeholder="Xona"
                            className="h-8 rounded-md border border-border bg-surface px-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                          />
                          {draftConflict && (
                            <p className="flex items-start gap-1 text-[11px] text-danger">
                              <AlertTriangleIcon className="mt-0.5 h-3 w-3 shrink-0" />
                              Ziddiyat: {teacherById.get(draft.teacherId)?.shortName} {draftConflict}{" "}
                              sinfida shu vaqtda band.
                            </p>
                          )}
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={saveCell}
                              className="h-7 flex-1 rounded-md bg-brand text-xs font-medium text-brand-foreground hover:bg-brand-dark"
                            >
                              Saqlash
                            </button>
                            <button
                              type="button"
                              onClick={closeEditor}
                              className="h-7 rounded-md px-2 text-xs font-medium text-foreground-muted hover:bg-surface-muted"
                            >
                              Bekor
                            </button>
                          </div>
                        </div>
                      ) : cell ? (
                        <div
                          className={`group relative rounded-lg px-2.5 py-2 text-xs ${subjectColor(cell.subject).block}`}
                        >
                          <button
                            type="button"
                            onClick={() => openEditor(day, period)}
                            className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <p className="font-medium">{cell.subject}</p>
                            <p className="opacity-90">{teacherById.get(cell.teacherId)?.shortName ?? cell.teacherId}</p>
                            <p className="opacity-75">{cell.room}</p>
                          </button>
                          {conflictWith && (
                            <span
                              title={`Ziddiyat: ${conflictWith} sinfi bilan`}
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white"
                            >
                              <AlertTriangleIcon className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => clearCell(day, period)}
                            aria-label="Darsni oʻchirish"
                            className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-surface/80 text-foreground-muted hover:text-danger group-hover:flex"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditor(day, period)}
                          aria-label="Dars qoʻshish"
                          className="flex h-16 w-full items-center justify-center rounded-lg border border-dashed border-border text-foreground-muted/50 transition-colors hover:border-brand hover:text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-foreground-muted">
        Qizil ogohlantirish belgisi — shu ustoz oʻsha kun/para band boʻlgan boshqa sinf bilan
        ziddiyat borligini bildiradi.
      </p>
    </div>
  );
}
