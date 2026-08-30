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
import { APPEALS } from "../src/lib/school/appeals.ts";
import { buildConversationNotes } from "../src/lib/admin/seed.ts";
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


// ─────────────────────── Murojaatlar ───────────────────────

// Murojaat yoʻnalishi endi `lib/contracts.ts` orqali backend enum'ining
// AYNAN oʻzi — bu yerda moslashtirish kerak emas. Ichki qayd turi esa hali
// admin do'konining oʻzbekcha kalitlarida.
const NOTE_KIND_TO_BACKEND: Record<string, string> = {
  telefon: "phone",
  yuzma: "in_person",
  onlayn: "online",
};

/**
 * Murojaatdagi «Abdullayev Alisher» kabi ismlar generatsiya qilingan
 * oʻquvchilar roʻyxatida yoʻq — mock murojaatlar alohida yozilgan. Shu
 * sabab har bir murojaatga OʻSHA SINFDAN haqiqiy oʻquvchi biriktiriladi
 * (murojaat id'si boʻyicha barqaror tanlov), matndagi ism esa
 * almashtiriladi. Aks holda bazada mavjud boʻlmagan bolaga murojaat
 * yozilardi va foreign key yiqilardi.
 */
function pickStudent(className: string, key: string) {
  const pool = ALL_STUDENTS.filter((s) => s.className === className);
  if (pool.length === 0) return null;
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return pool[(h >>> 0) % pool.length];
}

const appeals = APPEALS.flatMap((a) => {
  const student = pickStudent(a.className, a.id);
  if (!student) return [];

  // Xabar matnida bolaning ismi uchraydi ("Alisher algebradan orqada
  // qolyapti"). Mock ismlar bir xil tartibda emas — baʼzisi "Familiya Ism",
  // baʼzisi "Ism Familiya" — shuning uchun ikkala boʻlak ham almashtiriladi.
  // 4 harfdan qisqa boʻlak tegilmaydi: u oddiy soʻzga tushib qolishi mumkin.
  const realFirst = student.fullName.split(/\s+/).slice(-1)[0];
  const mockParts = a.studentFullName.split(/\s+/).filter((p) => p.length >= 4);
  const rename = (text: string) =>
    mockParts.reduce(
      (acc, part) => acc.split(part).join(realFirst),
      text.split(a.studentFullName).join(student.fullName),
    );

  // Fan oʻqituvchisi — sinfning HAQIQIY yuklamasidan. Backend ham aynan
  // shu qoidani tekshiradi ("bu oʻqituvchi farzandingizga dars bermaydi"),
  // shuning uchun mos kelmagan juftlik seed'da ham qolmasligi kerak.
  let subject: string | null = null;
  let teacherRef: string | null = null;
  if (a.target === "subject_teacher") {
    const forClass = TEACHING_ASSIGNMENTS.filter((x) => x.className === a.className);
    const exact = forClass.find((x) => x.subject === a.subject);
    const chosen = exact ?? forClass[0];
    if (!chosen) return [];
    subject = chosen.subject;
    teacherRef = chosen.teacherId;
  }

  return [
    {
      ref: a.id,
      studentRef: student.id,
      className: a.className,
      target: a.target,
      subject,
      assigneeRef: teacherRef,
      title: a.title,
      status: a.status,
      createdAt: a.createdAt,
      dueAt: a.dueAt,
      messages: a.messages.map((m) => ({
        author: m.author,
        staffRef: m.staffId ?? null,
        text: rename(m.text),
        createdAt: m.createdAt,
      })),
    },
  ];
});

const appealNotes = buildConversationNotes()
  .filter((n) => appeals.some((a) => a.ref === n.appealId))
  .map((n) => ({
    appealRef: n.appealId,
    kind: NOTE_KIND_TO_BACKEND[n.kind] ?? "phone",
    summary: n.summary,
    aboutTeacherRef: n.teacherId ?? null,
    teacherRating: n.rating ?? null,
    teacherComment: n.comment ?? null,
  }));

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
  appeals,
  appealNotes,
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
console.log(`  murojaat     ${payload.appeals.length} · ichki qayd ${payload.appealNotes.length}`);
