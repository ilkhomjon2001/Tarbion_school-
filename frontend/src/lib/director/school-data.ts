/**
 * Maktab boʻyicha oʻquvchilar, toʻlov va davomat maʼlumotlari.
 *
 * Demo maʼlumot QOʻLDA yozilmaydi — 16 sinf va ~400 oʻquvchi uchun bu
 * amaliy emas. Oʻrniga ism-familiya fondidan BARQAROR (deterministik)
 * generatsiya qilinadi: bir xil sinf har safar bir xil oʻquvchilarni,
 * bir xil toʻlov va davomatni beradi. Shu sabab sahifani yangilaganda
 * raqamlar sakramaydi va skrinshot bilan solishtirsa boʻladi.
 *
 * Pul CLAUDE.md 2-qoidasi boʻyicha BUTUN SONDA, soʻmda.
 *
 * Backend ulanganda bu fayl `students` + `payments` + `attendance`
 * jadvallariga soʻrovlar bilan almashtiriladi.
 */

import { allClassNames, HOMEROOM, staffById } from "@/lib/school/staff";

export type PaymentStatus = "paid" | "partial" | "overdue";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Toʻlangan",
  partial: "Qisman toʻlangan",
  overdue: "Kechikmoqda",
};

export type ClassStage = "boshlangʻich" | "oʻrta" | "yuqori";

export interface ClassDef {
  id: string;
  name: string;
  /** Parallel harfi: A, B, V, G — filtr uchun. */
  parallel: string;
  /** Sinf raqami: 5, 6, … 11. */
  grade: number;
  stage: ClassStage;
  studentCount: number;
}

export interface StudentRecord {
  id: string;
  fullName: string;
  className: string;
  /** Oylik shartnoma summasi, soʻmda. */
  monthlyFee: number;
  /** Shu oy uchun toʻlangan summa, soʻmda. */
  paidAmount: number;
  status: PaymentStatus;
  dueDate: string;
  /** Oylik davomat foizi. */
  attendanceMonth: number;
  /** Shu haftadagi davomat foizi. */
  attendanceWeek: number;
}

// ─────────────────────────── Ism fondi ───────────────────────────

const FIRST_NAMES = [
  "Alisher", "Madina", "Sardor", "Zilola", "Diyorbek", "Nodira", "Aziz", "Kamola",
  "Otabek", "Feruza", "Jaloliddin", "Sevinch", "Ravshan", "Gulbahor", "Sanjar",
  "Malika", "Sherzod", "Nilufar", "Bekzod", "Dilnoza", "Javlon", "Zarina",
  "Ulugʻbek", "Shahnoza", "Doniyor", "Mohira", "Temur", "Nozima", "Xurshid",
  "Sitora", "Akmal", "Yulduz", "Bahodir", "Oygul", "Farrux", "Dilshoda",
];

const LAST_NAMES = [
  "Usmonov", "Nazarov", "Rahimov", "Karimov", "Toshpulatov", "Ergashev",
  "Sultonov", "Yoqubov", "Zokirov", "Islomov", "Mirzayev", "Qodirov",
  "Abdullayev", "Nematov", "Yusupov", "Saidov", "Rustamov", "Xolmatov",
  "Aminov", "Ibragimov", "Nabiyev", "Sobirov", "Anvarov", "Tosheva",
];

/** Ayol ismlari — familiya oxiriga "a" qoʻshiladi. */
const FEMALE = new Set([
  "Madina", "Zilola", "Nodira", "Kamola", "Feruza", "Sevinch", "Gulbahor",
  "Malika", "Nilufar", "Dilnoza", "Zarina", "Shahnoza", "Mohira", "Nozima",
  "Sitora", "Yulduz", "Oygul", "Dilshoda",
]);

/** Barqaror xesh — bir xil matn har doim bir xil son beradi. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ─────────────────────────── Sinflar ───────────────────────────

const STAGE_BY_GRADE = (grade: number): ClassStage =>
  grade <= 6 ? "boshlangʻich" : grade <= 9 ? "oʻrta" : "yuqori";

const MONTHLY_FEE_BY_STAGE: Record<ClassStage, number> = {
  "boshlangʻich": 3_000_000,
  "oʻrta": 3_500_000,
  "yuqori": 4_000_000,
};

/** Sinflar — `lib/school/staff.ts` dagi dars yuklamasidan olinadi. */
export const CLASSES: ClassDef[] = allClassNames().map((name) => {
  const [gradeText, parallel] = name.split("-");
  const grade = Number(gradeText);
  const seed = hash(`cls-${name}`);
  return {
    // "10-A" → "c-10a" (dars jadvali gridi shu kalitlarni ishlatadi)
    id: `c-${name.toLowerCase().replace("-", "")}`,
    name,
    parallel,
    grade,
    stage: STAGE_BY_GRADE(grade),
    studentCount: 18 + (seed % 12), // 18–29 nafar
  };
});

export function classByName(name: string): ClassDef | null {
  return CLASSES.find((c) => c.name === name) ?? null;
}

/** Mavjud parallel harflari — filtr tugmalari uchun. */
export function parallels(): string[] {
  return Array.from(new Set(CLASSES.map((c) => c.parallel))).sort();
}

// ─────────────────────── Oʻquvchilar generatsiyasi ───────────────────────

function buildStudent(className: string, index: number, stage: ClassStage): StudentRecord {
  const seed = hash(`${className}-${index}`);
  const first = FIRST_NAMES[seed % FIRST_NAMES.length];
  const baseLast = LAST_NAMES[(seed >>> 5) % LAST_NAMES.length];
  const last = FEMALE.has(first) && !baseLast.endsWith("a") ? `${baseLast}a` : baseLast;

  const monthlyFee = MONTHLY_FEE_BY_STAGE[stage];

  // Toʻlov holati: ~72% toʻlangan, ~13% qisman, ~15% kechikkan.
  const payRoll = (seed >>> 11) % 100;
  let status: PaymentStatus;
  let paidAmount: number;
  if (payRoll < 72) {
    status = "paid";
    paidAmount = monthlyFee;
  } else if (payRoll < 85) {
    status = "partial";
    // Yarmidan koʻprogʻi toʻlangan, 100 000 soʻmga yaxlitlangan.
    paidAmount = Math.round((monthlyFee * (0.4 + ((seed >>> 17) % 40) / 100)) / 100_000) * 100_000;
  } else {
    status = "overdue";
    paidAmount = 0;
  }

  const attendanceMonth = 76 + ((seed >>> 3) % 24); // 76–99%
  const attendanceWeek = Math.min(100, Math.max(60, attendanceMonth + (((seed >>> 7) % 13) - 6)));

  return {
    id: `${className}-s${index + 1}`,
    fullName: `${last} ${first}`,
    className,
    monthlyFee,
    paidAmount,
    status,
    dueDate: status === "overdue" ? "2026-08-25" : "2026-09-05",
    attendanceMonth,
    attendanceWeek,
  };
}

const STUDENTS_BY_CLASS = new Map<string, StudentRecord[]>(
  CLASSES.map((cls) => [
    cls.name,
    Array.from({ length: cls.studentCount }, (_, i) => buildStudent(cls.name, i, cls.stage)),
  ]),
);

export function studentsOfClass(className: string): StudentRecord[] {
  return STUDENTS_BY_CLASS.get(className) ?? [];
}

export const ALL_STUDENTS: StudentRecord[] = CLASSES.flatMap((c) => studentsOfClass(c.name));

// ─────────────────────────── Toʻlov hisobi ───────────────────────────

export interface ClassPaymentStat {
  className: string;
  parallel: string;
  grade: number;
  homeroomTeacherName: string | null;
  studentCount: number;
  /** Yigʻilishi kerak boʻlgan umumiy summa. */
  expected: number;
  /** Haqiqatda yigʻilgan summa. */
  collected: number;
  /** Qarzdorlik summasi. */
  debt: number;
  /** Yigʻilish foizi. */
  collectedPercent: number;
  paidCount: number;
  partialCount: number;
  overdueCount: number;
}

export function classPaymentStat(className: string): ClassPaymentStat {
  const students = studentsOfClass(className);
  const cls = classByName(className);
  const expected = students.reduce((s, st) => s + st.monthlyFee, 0);
  const collected = students.reduce((s, st) => s + st.paidAmount, 0);
  const homeroomId = HOMEROOM[className];

  return {
    className,
    parallel: cls?.parallel ?? "",
    grade: cls?.grade ?? 0,
    homeroomTeacherName: homeroomId ? (staffById(homeroomId)?.shortName ?? null) : null,
    studentCount: students.length,
    expected,
    collected,
    debt: expected - collected,
    collectedPercent: expected === 0 ? 0 : Math.round((collected / expected) * 100),
    paidCount: students.filter((s) => s.status === "paid").length,
    partialCount: students.filter((s) => s.status === "partial").length,
    overdueCount: students.filter((s) => s.status === "overdue").length,
  };
}

export function allClassPaymentStats(): ClassPaymentStat[] {
  return CLASSES.map((c) => classPaymentStat(c.name)).sort(
    (a, b) => a.grade - b.grade || a.parallel.localeCompare(b.parallel),
  );
}

/**
 * Sinf DARAJASI kesimi: "5-sinflar", "6-sinflar" … Rahbariyat avval shu
 * darajani koʻradi, keyin ichidan parallel sinflarni (5-A, 5-B) ochadi.
 * Argument sifatida filtrlangan roʻyxat berilsa, jamlanma ham shu kesim
 * boʻyicha qayta hisoblanadi.
 */
export interface GradePaymentStat {
  grade: number;
  stage: ClassStage;
  classCount: number;
  studentCount: number;
  expected: number;
  collected: number;
  debt: number;
  collectedPercent: number;
  paidCount: number;
  partialCount: number;
  overdueCount: number;
  classes: ClassPaymentStat[];
}

export function gradePaymentStats(
  classStats: ClassPaymentStat[] = allClassPaymentStats(),
): GradePaymentStat[] {
  const byGrade = new Map<number, ClassPaymentStat[]>();
  for (const stat of classStats) {
    const list = byGrade.get(stat.grade);
    if (list) list.push(stat);
    else byGrade.set(stat.grade, [stat]);
  }

  return Array.from(byGrade.entries())
    .map(([grade, list]) => {
      const classes = [...list].sort((a, b) => a.parallel.localeCompare(b.parallel));
      const expected = sum(classes, (c) => c.expected);
      const collected = sum(classes, (c) => c.collected);
      return {
        grade,
        stage: STAGE_BY_GRADE(grade),
        classCount: classes.length,
        studentCount: sum(classes, (c) => c.studentCount),
        expected,
        collected,
        debt: expected - collected,
        collectedPercent: expected === 0 ? 0 : Math.round((collected / expected) * 100),
        paidCount: sum(classes, (c) => c.paidCount),
        partialCount: sum(classes, (c) => c.partialCount),
        overdueCount: sum(classes, (c) => c.overdueCount),
        classes,
      };
    })
    .sort((a, b) => a.grade - b.grade);
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

export interface FinanceSummary {
  expected: number;
  collected: number;
  debt: number;
  collectedPercent: number;
  /** Qarzdorlik foizi — soʻralgani (100 − yigʻilish foizi). */
  debtPercent: number;
  overdueCount: number;
  paidCount: number;
  partialCount: number;
}

/**
 * Umumiy moliyaviy holat. `months` — necha oylik davr uchun hisoblansin
 * (oylik koʻrinish uchun 1, yillik uchun 9 — oʻquv yili sentabr–may).
 */
export function financeSummary(months = 1): FinanceSummary {
  const expected = ALL_STUDENTS.reduce((s, st) => s + st.monthlyFee, 0) * months;
  // Oldingi oylarda yigʻilish biroz yuqoriroq boʻlgan (qarz keyin yopilgan).
  const currentCollected = ALL_STUDENTS.reduce((s, st) => s + st.paidAmount, 0);
  const pastCollected = ALL_STUDENTS.reduce((s, st) => s + st.monthlyFee, 0) * 0.94;
  const collected = Math.round(currentCollected + pastCollected * (months - 1));

  return {
    expected,
    collected,
    debt: expected - collected,
    collectedPercent: expected === 0 ? 0 : Math.round((collected / expected) * 100),
    debtPercent: expected === 0 ? 0 : Math.round(((expected - collected) / expected) * 100),
    overdueCount: ALL_STUDENTS.filter((s) => s.status === "overdue").length,
    paidCount: ALL_STUDENTS.filter((s) => s.status === "paid").length,
    partialCount: ALL_STUDENTS.filter((s) => s.status === "partial").length,
  };
}

// ─────────────────────────── Davomat hisobi ───────────────────────────

export type AttendancePeriod = "week" | "month";

export const ATTENDANCE_PERIOD_LABELS: Record<AttendancePeriod, string> = {
  week: "Haftalik",
  month: "Oylik",
};

export interface ClassAttendanceStat {
  className: string;
  parallel: string;
  grade: number;
  homeroomTeacherName: string | null;
  studentCount: number;
  averagePercent: number;
  /** Davomati 85% dan past oʻquvchilar soni. */
  atRiskCount: number;
}

const RISK_THRESHOLD = 85;

export function classAttendanceStat(
  className: string,
  period: AttendancePeriod,
): ClassAttendanceStat {
  const students = studentsOfClass(className);
  const cls = classByName(className);
  const homeroomId = HOMEROOM[className];
  const values = students.map((s) => (period === "week" ? s.attendanceWeek : s.attendanceMonth));

  return {
    className,
    parallel: cls?.parallel ?? "",
    grade: cls?.grade ?? 0,
    homeroomTeacherName: homeroomId ? (staffById(homeroomId)?.shortName ?? null) : null,
    studentCount: students.length,
    averagePercent:
      values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    atRiskCount: values.filter((v) => v < RISK_THRESHOLD).length,
  };
}

export function allClassAttendanceStats(period: AttendancePeriod): ClassAttendanceStat[] {
  return CLASSES.map((c) => classAttendanceStat(c.name, period)).sort(
    (a, b) => a.averagePercent - b.averagePercent,
  );
}

/** Davomat — sinf darajasi kesimida ("5-sinflar"), ichida parallel sinflar. */
export interface GradeAttendanceStat {
  grade: number;
  stage: ClassStage;
  classCount: number;
  studentCount: number;
  averagePercent: number;
  atRiskCount: number;
  classes: ClassAttendanceStat[];
}

export function gradeAttendanceStats(
  classStats: ClassAttendanceStat[],
): GradeAttendanceStat[] {
  const byGrade = new Map<number, ClassAttendanceStat[]>();
  for (const stat of classStats) {
    const list = byGrade.get(stat.grade);
    if (list) list.push(stat);
    else byGrade.set(stat.grade, [stat]);
  }

  return Array.from(byGrade.entries())
    .map(([grade, list]) => {
      // Sinflar ichida eng past koʻrsatkich tepada — muammoni tez topish uchun.
      const classes = [...list].sort(
        (a, b) => a.averagePercent - b.averagePercent || a.parallel.localeCompare(b.parallel),
      );
      const studentCount = sum(classes, (c) => c.studentCount);
      return {
        grade,
        stage: STAGE_BY_GRADE(grade),
        classCount: classes.length,
        studentCount,
        // Oʻrtacha oʻquvchilar soniga qarab tortiladi, sinflar soniga emas.
        averagePercent:
          studentCount === 0
            ? 0
            : Math.round(sum(classes, (c) => c.averagePercent * c.studentCount) / studentCount),
        atRiskCount: sum(classes, (c) => c.atRiskCount),
        classes,
      };
    })
    .sort((a, b) => a.grade - b.grade);
}

export function attendanceOf(student: StudentRecord, period: AttendancePeriod): number {
  return period === "week" ? student.attendanceWeek : student.attendanceMonth;
}

export function isAtRisk(percent: number): boolean {
  return percent < RISK_THRESHOLD;
}

// ─────────────────────── Kunlik davomat (kalendar) ───────────────────────

export type DayStatus = "present" | "late" | "excused" | "absent";

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  present: "Keldi",
  late: "Kechikdi",
  excused: "Sababli",
  absent: "Sababsiz",
};

export interface AttendanceDay {
  /** ISO sana — kalit sifatida. */
  date: string;
  /** Oy kuni: 1–30. */
  day: number;
  /** Hafta kuni qisqartmasi: Du, Se, Ch, Pa, Ju, Sh. */
  weekdayShort: string;
  status: DayStatus;
}

const WEEKDAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

/**
 * Demo oʻquv oyi — 2026-yil sentabr. Yakshanba dam olish kuni, qolgan
 * oltita kun dars kuni (WEEKDAYS bilan bir xil).
 *
 * Backend ulanganda bu roʻyxat `academic_calendar` jadvalidan olinadi —
 * bayram va karantin kunlari ham hisobga olinishi kerak.
 */
export const MONTH_LABEL = "Sentabr 2026";

const SCHOOL_DAYS: { date: string; day: number; weekdayShort: string }[] = (() => {
  const out: { date: string; day: number; weekdayShort: string }[] = [];
  for (let day = 1; day <= 30; day += 1) {
    const d = new Date(Date.UTC(2026, 8, day));
    const weekday = d.getUTCDay();
    if (weekday === 0) continue; // yakshanba — dars yoʻq
    out.push({
      date: `2026-09-${String(day).padStart(2, "0")}`,
      day,
      weekdayShort: WEEKDAY_SHORT[weekday],
    });
  }
  return out;
})();

/** Haftalik koʻrinish — oxirgi olti dars kuni. */
const WEEK_DAYS = SCHOOL_DAYS.slice(-6);

export function schoolDaysOf(period: AttendancePeriod) {
  return period === "week" ? WEEK_DAYS : SCHOOL_DAYS;
}

/**
 * Oʻquvchining kunma-kun davomati. Kelmagan kunlar SONI foizga aniq mos
 * keladi (foiz alohida, kalendar alohida hisoblansa, ular bir-biriga
 * qarama-qarshi chiqib qolardi). Qaysi kunlar ekani xesh boʻyicha
 * barqaror tanlanadi — sahifa yangilanganda oʻzgarmaydi.
 */
export function attendanceDaysOf(
  student: StudentRecord,
  period: AttendancePeriod,
): AttendanceDay[] {
  const days = schoolDaysOf(period);
  const percent = attendanceOf(student, period);
  const missedCount = Math.round((days.length * (100 - percent)) / 100);

  // Kunlarni barqaror "tasodifiy" tartibda saralab, birinchilarini
  // kelmagan deb belgilaymiz.
  const ranked = days
    .map((d) => ({ ...d, seed: hash(`${student.id}-${d.date}`) }))
    .sort((a, b) => a.seed - b.seed);
  const missed = new Set(ranked.slice(0, missedCount).map((d) => d.date));

  return days.map((d) => {
    const seed = hash(`${student.id}-${d.date}`);
    let status: DayStatus;
    if (missed.has(d.date)) {
      // Kelmaganlarning uchdan biri sababli (ariza, kasallik varaqasi).
      status = seed % 3 === 0 ? "excused" : "absent";
    } else {
      status = seed % 11 === 0 ? "late" : "present";
    }
    return { date: d.date, day: d.day, weekdayShort: d.weekdayShort, status };
  });
}

/** Butun maktab boʻyicha oʻrtacha davomat. */
export function schoolAttendance(period: AttendancePeriod): number {
  const values = ALL_STUDENTS.map((s) => attendanceOf(s, period));
  return values.length === 0
    ? 0
    : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ─────────────────────────── Shartnoma holati ───────────────────────────

export interface ContractSummary {
  /** Davr boshidagi oʻquvchilar soni. */
  startCount: number;
  /** Yangi qoʻshilgan shartnomalar. */
  joined: number;
  /** Bekor qilingan (maktabdan ketgan) shartnomalar. */
  left: number;
  /** Hozirgi jami. */
  current: number;
  /** Sof oʻsish. */
  net: number;
}

/**
 * Shartnomalar harakati. Oʻquvchi maktabdan ketsa hisobdan OʻCHIRILMAYDI,
 * arxivlanadi (CLAUDE.md 1-qoida) — shuning uchun "ketgan" soni ham
 * saqlanadi va hisobotda koʻrinadi.
 */
export function contractSummary(months: number): ContractSummary {
  const current = ALL_STUDENTS.length;
  // Oyiga oʻrtacha 6 ta yangi, 2 ta ketish.
  const joined = months === 1 ? 6 : 6 * months + 12;
  const left = months === 1 ? 2 : 2 * months + 3;
  return {
    startCount: current - joined + left,
    joined,
    left,
    current,
    net: joined - left,
  };
}
