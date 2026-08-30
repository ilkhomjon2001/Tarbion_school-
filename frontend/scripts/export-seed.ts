/**
 * Frontend maktab maʼlumotini backend seed uchun JSON'ga chiqaradi.
 *
 * Nega shunday: mock maʼlumot allaqachon oʻzaro mos — ustozlar, sinflar,
 * dars yuklamasi va oʻquvchilar bir-biriga bogʻlangan. Uni backendda
 * QAYTA yozish ikkinchi haqiqat manbasini yaratardi va raqamlar
 * farq qilib ketardi. Shu sabab manba bitta: `lib/school/staff.ts` va
 * `lib/director/school-data.ts`.
 *
 * Ishlatish (frontend/ ichida):
 *   pnpm export:seed          → backend/seed-data.json
 *
 * Backend ulanib boʻlgach bu skript keraksiz boʻladi: maʼlumot bazada
 * qoladi va mock oʻchiriladi.
 */

import { writeFileSync } from "node:fs";
import { ALL_STUDENTS, CLASSES } from "../src/lib/director/school-data.ts";
import {
  HOMEROOM,
  STAFF,
  TEACHING_ASSIGNMENTS,
  allTeachers,
} from "../src/lib/school/staff.ts";
import { BELL_SCHEDULE } from "../src/lib/teacher/schedule.ts";
import { ACADEMIC_YEAR, BREAKS, TERMS } from "../src/lib/teacher/terms.ts";

const OUT = "../backend/seed-data.json";

/** "Anvarov Jamshid Odilovich" → familiya/ism/otasining ismi. */
function splitName(full: string): [string, string, string | null] {
  const parts = full.trim().split(/\s+/);
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? null];
}

/** Xodim roli → backenddagi `RoleName` qiymati. */
const STAFF_ROLE_TO_BACKEND: Record<string, string> = {
  teacher: "teacher",
  director: "director",
  admin: "admin",
  psychologist: "teacher", // psixolog alohida rol emas — hozircha ustoz huquqi
  academic: "academic",
};

const teacherIds = new Set(allTeachers().map((t) => t.id));
const homeroomIds = new Set(Object.values(HOMEROOM));

const staff = STAFF.map((s) => {
  const [lastName, firstName, middleName] = splitName(s.fullName);
  const roles = [STAFF_ROLE_TO_BACKEND[s.role] ?? "teacher"];
  // Sinf rahbari — qoʻshimcha rol, ustoz rolining oʻrnini bosmaydi (AUT-04).
  if (teacherIds.has(s.id) && homeroomIds.has(s.id)) roles.push("homeroom_teacher");
  return {
    ref: s.id,
    lastName,
    firstName,
    middleName,
    phone: s.phone.replace(/\D/g, ""),
    email: s.email,
    roles,
    subjects: s.subjects,
  };
});

// Fanlar — dars yuklamasidan va xodim profilidan yigʻiladi.
const subjectNames = Array.from(
  new Set([
    ...TEACHING_ASSIGNMENTS.map((a) => a.subject),
    ...STAFF.flatMap((s) => s.subjects),
  ]),
).sort((a, b) => a.localeCompare(b, "uz"));

const classes = CLASSES.map((c) => ({
  ref: c.id,
  name: c.name,
  grade: c.grade,
  homeroomRef: HOMEROOM[c.name] ?? null,
  studentCount: c.studentCount,
}));

const students = ALL_STUDENTS.map((s) => {
  const [lastName, firstName] = splitName(s.fullName);
  return {
    ref: s.id,
    lastName,
    firstName,
    className: s.className,
    // Davomat foizi — davomat yozuvlarini generatsiya qilishda ishlatiladi,
    // shunda rahbariyatdagi foiz mock bilan bir xil chiqadi.
    attendanceMonth: s.attendanceMonth,
  };
});

const payload = {
  generatedAt: new Date().toISOString(),
  academicYear: {
    name: ACADEMIC_YEAR.replace("–", "-"),
    startsOn: TERMS[0].startsOn,
    endsOn: TERMS[TERMS.length - 1].endsOn,
  },
  terms: TERMS.map((t) => ({
    index: t.index,
    name: t.name,
    startsOn: t.startsOn,
    endsOn: t.endsOn,
  })),
  // Taʼtil kunlari — bu oraliqda dars generatsiya qilinmaydi.
  breaks: BREAKS.map((b) => ({ name: b.name, startsOn: b.startsOn, endsOn: b.endsOn })),
  bellSchedule: Object.entries(BELL_SCHEDULE).map(([period, t]) => ({
    period: Number(period),
    startsAt: t.start,
    endsAt: t.end,
  })),
  subjects: subjectNames,
  staff,
  classes,
  students,
  assignments: TEACHING_ASSIGNMENTS.map((a) => ({
    className: a.className,
    subject: a.subject,
    teacherRef: a.teacherId,
    hoursPerWeek: a.hoursPerWeek,
  })),
};

writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");

console.log(`${OUT} yozildi:`);
console.log(`  xodim        ${payload.staff.length}`);
console.log(`  fan          ${payload.subjects.length}`);
console.log(`  sinf         ${payload.classes.length}`);
console.log(`  oʻquvchi     ${payload.students.length}`);
console.log(`  yuklama      ${payload.assignments.length}`);
console.log(`  chorak       ${payload.terms.length}`);
console.log(`  para         ${payload.bellSchedule.length}`);
