/**
 * Administrator kabineti uchun boshlangʻich maʼlumot.
 *
 * MUHIM: bu yerda yangi "maktab" yaratilmaydi — oʻquvchilar, sinflar va
 * ustozlar `lib/director/school-data.ts` va `lib/school/staff.ts` dan
 * olinadi. Shu sabab admin kiritgan oʻzgarish rahbariyat koʻradigan
 * maʼlumot bilan bitta manbadan chiqadi.
 */

import {
  ALL_STUDENTS,
  CLASSES,
  classByName,
  type StudentRecord,
} from "@/lib/director/school-data";
import { APPEALS, type Appeal } from "@/lib/school/appeals";
import {
  ADMINISTRATOR,
  allTeachers,
  HOMEROOM,
  STAFF,
  subjectTeachersOf,
} from "@/lib/school/staff";
import {
  CONTRACT_END_REASONS,
  DEFAULT_SURVEY_QUESTIONS,
  type AdminClass,
  type AdminProfile,
  type AdminStudent,
  type AdminSubject,
  type ContractEndReason,
  type ContractEvent,
  type SchoolSettings,
  type UserAccount,
  type Application,
  type AuditEntry,
  type ConversationNote,
  type DocumentRequest,
  type Quarter,
  type Room,
  type SurveyDefinition,
  type SurveyRound,
  type TeacherSurveyResult,
} from "@/lib/admin/types";

/** Barqaror xesh — `school-data.ts` dagi bilan bir xil mantiq. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const GUARDIAN_FIRST = [
  "Bekzod", "Aziz", "Rustam", "Dilnoza", "Nargiza", "Alisher", "Jasur",
  "Feruza", "Bobur", "Kamola", "Shuhrat", "Malika", "Ulugʻbek", "Nodira",
];

const GUARDIAN_RELATION = ["Ota", "Ona", "Vasiy"];

/**
 * Administrator — `lib/school/staff.ts` dagi xodim. Alohida ism
 * toʻqilmaydi: audit jurnalidagi "kim" ustuni va xodimlar roʻyxati bitta
 * odamni koʻrsatishi kerak.
 */
export const ADMIN_NAME = ADMINISTRATOR.fullName;
export const ACADEMIC_YEAR = "2026–2027";

export function buildProfile(): AdminProfile {
  return {
    staffId: ADMINISTRATOR.id,
    fullName: ADMINISTRATOR.fullName,
    position: "Maktab administratori",
    phone: ADMINISTRATOR.phone,
    email: ADMINISTRATOR.email,
    workHours: "Dushanba–Shanba, 08:00–17:00",
    office: "102-xona, 1-qavat",
  };
}

function guardianOf(student: StudentRecord) {
  const seed = hash(`g-${student.id}`);
  const familyName = student.fullName.split(" ")[0];
  const first = GUARDIAN_FIRST[seed % GUARDIAN_FIRST.length];
  const relation = GUARDIAN_RELATION[(seed >>> 5) % GUARDIAN_RELATION.length];
  // Familiya ayol shakliga oʻtgan boʻlsa, otaga erkak shaklini qaytaramiz.
  const base = familyName.endsWith("a") ? familyName.slice(0, -1) : familyName;
  const name = relation === "Ona" ? `${base}a ${first}` : `${base} ${first}`;
  const digits = 100000000 + ((seed >>> 3) % 899999999);
  const s = String(digits);
  return {
    name,
    relation,
    phone: `+998 ${s.slice(0, 2)} ${s.slice(2, 5)} ${s.slice(5, 7)} ${s.slice(7, 9)}`,
  };
}

export function buildStudents(): AdminStudent[] {
  return ALL_STUDENTS.map((s) => {
    const seed = hash(`adm-${s.id}`);
    const guardian = guardianOf(s);
    const cls = classByName(s.className);
    const enrollYear = 2019 + (seed % 7);
    const enrollMonth = 8 + ((seed >>> 4) % 2); // avgust yoki sentabr
    const enrollDay = 1 + ((seed >>> 8) % 27);
    return {
      id: s.id,
      fullName: s.fullName,
      className: s.className,
      // Sinf raqamidan tugʻilgan yil: 1-sinf ≈ 7 yosh.
      birthYear: 2026 - ((cls?.grade ?? 7) + 6),
      guardianName: guardian.name,
      guardianPhone: guardian.phone,
      enrolledAt: `${enrollYear}-${String(enrollMonth).padStart(2, "0")}-${String(enrollDay).padStart(2, "0")}`,
      monthlyFee: s.monthlyFee,
      paidAmount: s.paidAmount,
      dueDate: s.dueDate,
      attendancePercent: s.attendanceMonth,
      discountPercent: 0,
      status: "active" as const,
    };
  });
}

export function guardianNameOf(studentId: string): string {
  const student = ALL_STUDENTS.find((s) => s.id === studentId);
  return student ? guardianOf(student).name : "—";
}

// ─────────────────────────── Arizalar ───────────────────────────

export function buildApplications(): Application[] {
  const base = [
    {
      studentFullName: "Karimov Sardor Bekzod oʻgʻli",
      birthDate: "2015-04-15",
      gender: "erkak" as const,
      previousSchool: "42-sonli umumiy oʻrta taʼlim maktabi",
      guardianFullName: "Karimov Bekzod Alisherovich",
      guardianPhone: "+998 90 123 45 67",
      guardianRelation: "Ota",
      address: "Toshkent sh., Yunusobod t., 4-daha, 12-uy",
      className: "6-A",
    },
    {
      studentFullName: "Yoqubova Nilufar Sanjar qizi",
      birthDate: "2016-11-02",
      gender: "ayol" as const,
      previousSchool: "17-sonli maktab",
      guardianFullName: "Yoqubova Dilnoza Rustamovna",
      guardianPhone: "+998 93 456 78 90",
      guardianRelation: "Ona",
      address: "Toshkent sh., Mirobod t., 7-uy",
      className: "5-B",
    },
    {
      studentFullName: "Islomov Doniyor Jasur oʻgʻli",
      birthDate: "2013-07-21",
      gender: "erkak" as const,
      previousSchool: "Xususiy «Bilim» maktabi",
      guardianFullName: "Islomov Jasur Toʻlqinovich",
      guardianPhone: "+998 97 111 22 33",
      guardianRelation: "Ota",
      address: "Toshkent sh., Chilonzor t., 19-daha",
      className: "8-A",
    },
  ];

  return base.map((item, i) => ({
    id: `app-${i + 1}`,
    ...item,
    academicYear: ACADEMIC_YEAR,
    enrollDate: "2026-09-02",
    monthlyFee: 3_500_000,
    discountPercent: 0,
    discountReason: "",
    payDay: 5,
    note: "",
    status: "new" as const,
    createdAt: ["2 soat oldin", "Kecha, 16:30", "12 Sen, 09:15"][i],
  }));
}

// ────────────────────── Maʼlumotnoma soʻrovlari ──────────────────────

export function buildDocumentRequests(students: AdminStudent[]): DocumentRequest[] {
  const pick = (index: number) => students[index % students.length];
  const rows: Array<{
    type: DocumentRequest["type"];
    status: DocumentRequest["status"];
    createdAt: string;
    index: number;
  }> = [
    { type: "oquv_joyi", status: "new", createdAt: "10:45, Bugun", index: 3 },
    { type: "baho_kochirmasi", status: "waiting", createdAt: "Kecha, 16:30", index: 41 },
    { type: "tibbiy", status: "waiting", createdAt: "12 Sen, 09:15", index: 88 },
    { type: "daromad", status: "waiting", createdAt: "11 Sen, 14:20", index: 130 },
    { type: "harbiy", status: "waiting", createdAt: "10 Sen, 11:05", index: 201 },
    { type: "oquv_joyi", status: "waiting", createdAt: "9 Sen, 15:40", index: 260 },
    { type: "daromad", status: "waiting", createdAt: "8 Sen, 10:10", index: 310 },
  ];

  return rows.map((row, i) => {
    const student = pick(row.index);
    return {
      id: `doc-${i + 1}`,
      studentId: student.id,
      type: row.type,
      requestedBy: student.guardianName,
      createdAt: row.createdAt,
      status: row.status,
    };
  });
}

/** Arxivdagi hujjatlar soni — reyestr sarlavhasida koʻrsatiladi. */
export const ISSUED_DOCUMENTS_BEFORE = 142;

// ─────────────────────────── Soʻrovnoma ───────────────────────────

const CRITERIA_LABELS = [
  "Darsni tushunarli tushuntiradi",
  "Oʻquvchilar bilan munosabati",
  "Dars intizomi",
  "Uy vazifalarini tekshirishi",
];

const PARENT_COMMENTS = [
  "Darslarni bolam qiziqib oʻrganyapti. Rahmat ustozga.",
  "Baʼzida darsda shovqin boʻlishini aytadi, lekin tushuntirishi zoʻr.",
  "Uy vazifasini vaqtida tekshirmaydi, shu joyi biroz sust.",
  "Farzandimga alohida eʼtibor qaratgani uchun minnatdorman.",
  "Savollarimga har doim tez javob beradi.",
];

export const SURVEY_ROUND: SurveyRound = {
  id: "sv-2026-1",
  label: "2026 · 1-chorak",
  sentCount: 412,
  answeredCount: 287,
};

export function buildSurveyResults(): TeacherSurveyResult[] {
  return allTeachers()
    .map((teacher) => {
      const seed = hash(`sv-${teacher.id}`);
      const responseCount = 18 + (seed % 28);

      // Baho taqsimoti: koʻpchilik 4–5, ozchilik past.
      const five = Math.round(responseCount * (0.4 + ((seed >>> 3) % 35) / 100));
      const four = Math.round((responseCount - five) * 0.6);
      const three = Math.max(0, responseCount - five - four - ((seed >>> 7) % 3));
      const two = Math.max(0, responseCount - five - four - three - ((seed >>> 11) % 2));
      const one = Math.max(0, responseCount - five - four - three - two);

      const distribution: Record<number, number> = { 1: one, 2: two, 3: three, 4: four, 5: five };
      const total = one + two + three + four + five || 1;
      const average = (one + two * 2 + three * 3 + four * 4 + five * 5) / total;

      const criteria = CRITERIA_LABELS.map((label, i) => {
        const c = hash(`${teacher.id}-${label}`);
        // Mezon bahosi umumiy oʻrtacha atrofida ±0.5 oraligʻida tebranadi.
        const delta = ((c >>> (i * 3)) % 11) / 10 - 0.5;
        return { label, score: Math.min(5, Math.max(1, Number((average + delta).toFixed(1)))) };
      });

      const comments = PARENT_COMMENTS.slice(0, 2 + (seed % 2)).map((text, i) => ({
        id: `${teacher.id}-c${i}`,
        text: PARENT_COMMENTS[(seed + i) % PARENT_COMMENTS.length],
        className: homeroomOrTaught(teacher.id, seed + i),
      }));

      return {
        teacherId: teacher.id,
        distribution,
        responseCount: total,
        average: Number(average.toFixed(1)),
        criteria,
        comments,
      };
    })
    .sort((a, b) => b.average - a.average);
}

function homeroomOrTaught(teacherId: string, seed: number): string {
  const own = Object.entries(HOMEROOM).find(([, id]) => id === teacherId)?.[0];
  if (own) return own;
  const names = Object.keys(HOMEROOM);
  return names[seed % names.length];
}

export function buildSurveys(): SurveyDefinition[] {
  return [
    {
      id: "sv-1",
      title: "Oʻqituvchilar faoliyati — 1-chorak",
      period: SURVEY_ROUND.label,
      audience: "all",
      classNames: [],
      questions: DEFAULT_SURVEY_QUESTIONS.map((text, i) => ({ id: `q-${i + 1}`, text })),
      status: "active",
      createdAt: "2026-09-05 09:00",
      createdBy: ADMIN_NAME,
      sentCount: SURVEY_ROUND.sentCount,
      answeredCount: SURVEY_ROUND.answeredCount,
    },
  ];
}

// ─────────────────────── Maʼlumot bazasi ───────────────────────

/**
 * Sinflar. Boshlangʻich roʻyxat dars yuklamasidan chiqadi — admin qoʻshgan
 * yangi sinf esa faqat admin do'konida yashaydi (backend ulanmagunicha
 * boshqa kabinetlar eski roʻyxatni koʻradi).
 */
export function buildClasses(): AdminClass[] {
  return CLASSES.map((cls) => ({
    id: cls.id,
    name: cls.name,
    grade: cls.grade,
    parallel: cls.parallel,
    stage: cls.stage,
    homeroomTeacherId: HOMEROOM[cls.name] ?? "",
    // Sigʻim mavjud oʻquvchi sonidan biroz katta — qabulda boʻsh joy koʻrinadi.
    capacity: 30,
    status: "active" as const,
  }));
}

export function buildSubjects(): AdminSubject[] {
  const map = new Map<string, { teachers: Set<string>; classes: number; hours: number }>();
  for (const cls of CLASSES) {
    for (const row of subjectTeachersOf(cls.name)) {
      const entry = map.get(row.subject) ?? { teachers: new Set<string>(), classes: 0, hours: 0 };
      entry.teachers.add(row.teacher.id);
      entry.classes += 1;
      entry.hours += row.hoursPerWeek;
      map.set(row.subject, entry);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].hours - a[1].hours)
    .map(([name, info], i) => ({
      id: `subj-${i + 1}`,
      name,
      classCount: info.classes,
      hoursPerWeek: info.hours,
      teacherIds: [...info.teachers],
      status: "active" as const,
    }));
}

// ─────────────────────────── Murojaatlar ───────────────────────────

/**
 * Yozishmalar `lib/school/appeals.ts` dan koʻchiriladi: admin ularga javob
 * yozadi va yangisini boshlaydi, shu sabab holat do'konda boʻlishi kerak.
 * Nusxa chuqur olinadi — umumiy massiv oʻzgarmasin.
 */
export function buildAppeals(): Appeal[] {
  return APPEALS.map((appeal) => ({
    ...appeal,
    messages: appeal.messages.map((m) => ({ ...m })),
  }));
}

export function buildRooms(): Room[] {
  const rows = [
    { number: "101", kind: "Oddiy sinf xonasi", capacity: 30, floor: 1 },
    { number: "108", kind: "Ona tili kabineti", capacity: 28, floor: 1 },
    { number: "110", kind: "Tarix kabineti", capacity: 28, floor: 1 },
    { number: "204", kind: "Matematika kabineti", capacity: 30, floor: 2 },
    { number: "206", kind: "Ingliz tili kabineti", capacity: 24, floor: 2 },
    { number: "301", kind: "Fizika laboratoriyasi", capacity: 24, floor: 3 },
    { number: "302", kind: "Kimyo laboratoriyasi", capacity: 24, floor: 3 },
    { number: "305", kind: "Informatika xonasi", capacity: 20, floor: 3 },
    { number: "Sport", kind: "Sport zali", capacity: 60, floor: 1 },
  ];
  return rows.map((row, i) => ({ ...row, id: `room-${i + 1}`, status: "active" as const }));
}

export function buildQuarters(): Quarter[] {
  return [
    { id: "q1", name: "1-chorak", from: "2026-09-01", to: "2026-10-30" },
    { id: "q2", name: "2-chorak", from: "2026-11-09", to: "2026-12-29" },
    { id: "q3", name: "3-chorak", from: "2027-01-12", to: "2027-03-20" },
    { id: "q4", name: "4-chorak", from: "2027-03-30", to: "2027-05-25" },
  ];
}

// ─────────────────────── Suhbat qaydnomalari ───────────────────────

export function buildConversationNotes(): ConversationNote[] {
  return [
    {
      id: "note-1",
      appealId: "ap-1",
      kind: "telefon",
      date: "2026-05-12",
      summary: "Kechikkan toʻlov boʻyicha ogohlantirildi, 20-maygacha kelishildi.",
      authorName: ADMIN_NAME,
      createdAt: "2026-05-12",
    },
    {
      id: "note-2",
      appealId: "ap-2",
      kind: "yuzma",
      date: "2026-03-12",
      summary: "Oʻtgan chorakka nisbatan natijasi 0.3 ballga oshgan. Intizom masalasida gaplashib olindi.",
      teacherId: "t-1",
      rating: 4,
      comment: "Ota-ona darsdagi shovqindan norozi, ustoz bilan gaplashildi.",
      authorName: ADMIN_NAME,
      createdAt: "2026-03-12",
    },
  ];
}

// ─────────────────────── Shartnoma harakati ───────────────────────

const END_REASON_KEYS = Object.keys(CONTRACT_END_REASONS) as ContractEndReason[];

const END_NOTES: Record<ContractEndReason, string> = {
  boshqa_maktab: "Ota-ona arizasi asosida, hujjatlar topshirildi",
  kochib_ketdi: "Oila boshqa viloyatga koʻchdi",
  moliyaviy: "Toʻlov imkoniyati boʻlmagani sababli",
  oila_qarori: "Oila qarori bilan taʼlim shakli oʻzgartirildi",
  bitirdi: "11-sinfni tamomladi, attestat berildi",
  boshqa: "Ariza asosida",
};

/**
 * Kelgan va ketgan shartnomalar.
 *
 * Kelganlar oʻquvchining `enrolledAt` sanasidan olinadi — alohida sana
 * toʻqilmaydi. Ketganlar joriy oʻquv yili uchun bir nechta namuna: bazani
 * boʻsh koʻrsatib qoʻymaslik uchun, sabab va sanasi bilan.
 */
export function buildContractEvents(students: AdminStudent[]): ContractEvent[] {
  const starts: ContractEvent[] = students.map((s) => ({
    id: `ce-start-${s.id}`,
    studentId: s.id,
    studentName: s.fullName,
    className: s.className,
    type: "start" as const,
    date: s.enrolledAt,
    note: "Shartnoma imzolandi",
    monthlyFee: s.monthlyFee,
    createdBy: ADMIN_NAME,
  }));

  // Ketganlar — roʻyxatdan barqaror tanlanadi, oʻquvchi arxivlanmaydi
  // (ular allaqachon bazadan chiqqan, faol roʻyxatda yoʻq deb qaraladi).
  const leavers = [12, 57, 104, 168, 233, 290, 341].map((index, i) => {
    const student = students[index % students.length];
    const seed = hash(`leave-${student.id}`);
    const reason = END_REASON_KEYS[seed % END_REASON_KEYS.length];
    const month = 9 + (i % 3); // sentabr–noyabr
    const day = 1 + ((seed >>> 4) % 27);
    return {
      id: `ce-end-${i + 1}`,
      studentId: student.id,
      studentName: student.fullName,
      className: student.className,
      type: "end" as const,
      date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      reason,
      note: END_NOTES[reason],
      monthlyFee: student.monthlyFee,
      createdBy: ADMIN_NAME,
    };
  });

  return [...starts, ...leavers].sort((a, b) => b.date.localeCompare(a.date));
}

// ─────────────────────── Foydalanuvchilar ───────────────────────

/**
 * Tizim foydalanuvchilari — xodimlar roʻyxatidan quriladi, alohida
 * "hisob" toʻqilmaydi. Login `familiya.ism` shaklida.
 */
export function buildUsers(): UserAccount[] {
  const ROLE_BY_STAFF: Record<string, UserAccount["role"]> = {
    director: "director",
    admin: "admin",
    teacher: "teacher",
    psychologist: "teacher",
  };

  const POSITION: Record<string, string> = {
    director: "Direktor",
    admin: "Maktab administratori",
    teacher: "Fan oʻqituvchisi",
    psychologist: "Psixolog",
  };

  const accounts: UserAccount[] = STAFF.map((person) => {
    const seed = hash(`acc-${person.id}`);
    const [family, first] = person.fullName.split(" ");
    return {
      id: `u-${person.id}`,
      fullName: person.fullName,
      staffId: person.id,
      position: POSITION[person.role] ?? "Xodim",
      login: `${family}.${first}`.toLowerCase().replace(/[ʻʼ']/g, ""),
      role: ROLE_BY_STAFF[person.role] ?? "teacher",
      sections: null,
      status: "active" as const,
      lastSeen: `${1 + (seed % 6)} soat oldin`,
    };
  });

  // Super administrator — texnik hisob, xodimlar roʻyxatida yoʻq.
  accounts.unshift({
    id: "u-root",
    fullName: "Tizim administratori",
    position: "Super administrator",
    login: "root",
    role: "superadmin",
    sections: null,
    status: "active",
    lastSeen: "Hozir",
  });

  return accounts;
}

// ─────────────────────── Maktab sozlamalari ───────────────────────

export function buildSchoolSettings(): SchoolSettings {
  return {
    name: "«Tarbion» xususiy umumtaʼlim maktabi",
    academicYear: ACADEMIC_YEAR,
    defaultPayDay: 5,
    maxDiscountPercent: 30,
    overdueAfterDays: 5,
    attendanceLockHours: 24,
    phone: "+998 71 200 10 10",
    address: "Toshkent sh., Yunusobod t., 4-daha, 1-uy",
  };
}

// ─────────────────────────── Audit ───────────────────────────

export function buildAuditLog(): AuditEntry[] {
  return [
    {
      id: "aud-1",
      at: "2026-09-12 09:14",
      actor: ADMIN_NAME,
      action: "payment",
      entity: "Nazarov Sardor (7-B)",
      detail: "3,500,000 soʻm · Naqd · chek №4417",
    },
    {
      id: "aud-2",
      at: "2026-09-11 16:02",
      actor: ADMIN_NAME,
      action: "document",
      entity: "№ 2026/09-133",
      detail: "Oʻquv joyi haqida maʼlumotnoma berildi",
    },
    {
      id: "aud-3",
      at: "2026-09-11 11:30",
      actor: ADMIN_NAME,
      action: "reminder",
      entity: "38 nafar qarzdor",
      detail: "Bot orqali ommaviy eslatma",
    },
  ];
}
