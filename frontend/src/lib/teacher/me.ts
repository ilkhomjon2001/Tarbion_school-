"use client";

/**
 * Ustozning oʻzi haqidagi maʼlumot — serverdan (T-005, ADM-08).
 *
 * `DEMO_TEACHER` ning oʻrniga. Profil `/auth/me` dan, oʻqitadigan
 * sinf va fanlar esa OʻZ dars jadvalidan (`/schedule/entries` ustoz
 * kesimida) chiqariladi.
 *
 * Nega jadvaldan: "qaysi sinfda qaysi fanni oʻqitaman" degan savolga
 * ikkita manba bor edi — `teacher_subjects` (qaysi fanni umuman
 * oʻqitadi) va jadval (qaysi sinfda haqiqatan dars beradi). Baho va
 * jurnal uchun keraklisi ikkinchisi: fanni bilishi sinfga kirish
 * huquqini bermaydi.
 */

import { useEffect, useMemo, useState } from "react";

import type { UserOut } from "@/lib/api/types.gen";
import { getUser, restore } from "@/lib/session";
import { fetchSchedule, type ScheduleEntryOut } from "@/lib/school/api";

export type TeacherMe = {
  user: UserOut | null;
  fullName: string;
  shortName: string;
  roles: string[];
  /** Sinf rahbarimi — `/teacher/tarbiya` va kengaytirilgan huquqlar uchun. */
  isHomeroom: boolean;
  loading: boolean;
};

export function useTeacherMe(): TeacherMe {
  const [user, setUser] = useState<UserOut | null>(getUser());
  const [loading, setLoading] = useState(user === null);

  useEffect(() => {
    if (user !== null) return;
    let alive = true;

    restore()
      .then(() => alive && setUser(getUser()))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [user]);

  const roles = user?.roles ?? [];

  return {
    user,
    fullName: user?.full_name ?? "",
    shortName: user?.short_name ?? "",
    roles,
    isHomeroom: roles.includes("homeroom_teacher"),
    loading,
  };
}

// ─────────────────── Oʻqitadigan sinf va fanlar ───────────────────

export type TeachingSlot = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  /** Haftada necha marta — jadvaldan sanaladi. */
  weeklyHours: number;
};

export type MyTeaching = {
  slots: TeachingSlot[];
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  entries: ScheduleEntryOut[];
  loading: boolean;
  error: string | null;
};

/**
 * Ustoz qaysi sinfda qaysi fanni oʻqitadi.
 *
 * Sinf tanlash roʻyxatlari (eʼlon, test, uy vazifasi) shu yerdan
 * toʻldiriladi — mock roʻyxat emas.
 */
export function useMyTeaching(): MyTeaching {
  const { user, loading: meLoading } = useTeacherMe();
  const [entries, setEntries] = useState<ScheduleEntryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (meLoading) return;
    if (user === null) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);

    fetchSchedule({ teacherId: user.id })
      .then((rows) => alive && setEntries(rows))
      .catch(() => alive && setError("Dars yuklamasini olib boʻlmadi."))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [user, meLoading]);

  const slots = useMemo(() => {
    const map = new Map<string, TeachingSlot>();
    for (const e of entries) {
      const key = `${e.class_id}:${e.subject_id}`;
      const bor = map.get(key);
      if (bor) {
        map.set(key, { ...bor, weeklyHours: bor.weeklyHours + 1 });
      } else {
        map.set(key, {
          classId: e.class_id,
          className: e.class_name,
          subjectId: e.subject_id,
          subjectName: e.subject_name,
          weeklyHours: 1,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) =>
        a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName),
    );
  }, [entries]);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of slots) map.set(s.classId, s.className);
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [slots]);

  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of slots) map.set(s.subjectId, s.subjectName);
    return [...map]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [slots]);

  return { slots, classes, subjects, entries, loading: loading || meLoading, error };
}

// ─────────────────────────── Sana ───────────────────────────

const DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MONTHS_UZ = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const WEEKDAYS_UZ = [
  "yakshanba",
  "dushanba",
  "seshanba",
  "chorshanba",
  "payshanba",
  "juma",
  "shanba",
];

/** «29-avgust, shanba» — Toshkent boʻyicha bugun (CLAUDE.md 3-qoida). */
export function todayLabel(): string {
  const iso = DATE_FMT.format(new Date());
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}, ${WEEKDAYS_UZ[d.getDay()]}`;
}
