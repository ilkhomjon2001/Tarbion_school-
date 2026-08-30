/**
 * Backend bilan umumiy kontrakt — kodlar va yorliqlar.
 *
 * Bu faylning har bir qatori `backend/app/models/` dagi aniq enum'ning
 * aksi. Frontend hech qayerda oʻz kodini oʻylab topmaydi: davomat holati,
 * baho turi va vazifa holati SHU YERDAN olinadi.
 *
 * Manba fayllar:
 *   AttendanceStatus  → backend/app/models/attendance.py
 *   SubmissionStatus  → backend/app/models/homework.py
 *   GradeKind         → backend/app/models/homework.py
 *   GradingScale      → backend/app/models/homework.py
 *   BackendRole       → backend/app/models/identity.py
 *
 * Ikkalasi ajralib ketmasligi uchun tekshiruv bor:
 *   pnpm check:contracts
 * U backenddagi Python enum'larini oʻqib, shu fayl bilan solishtiradi.
 * Sherik enum'ga qiymat qoʻshsa — tekshiruv yiqiladi va biz koʻramiz.
 *
 * ── Bu fayl OpenAPI generatsiyasiga ZID EMAS ──
 *
 * DECISIONS.md da kelishilgan: soʻrov va javob tiplari qoʻlda yozilmaydi,
 * FastAPI '/openapi.json' dan '@hey-api/openapi-ts' orqali generatsiya
 * qilinadi. Bu fayl uning oʻrnini bosmaydi, chunki:
 *
 *   1) Generatsiya uchun ishlaydigan API kerak. Hozir 'api/v1/' boʻsh —
 *      generatsiya qiladigan narsa yoʻq, frontend esa bugun ishlashi kerak.
 *   2) Oʻzbekcha yorliqlar ('ATTENDANCE_LABELS_UZ') Pydantic sxemasi emas,
 *      oddiy 'dict' konstantasi — ular OpenAPI ga UMUMAN tushmaydi.
 *      Endpoint chiqqanda ham ular shu yerda qoladi (yoki backend ularni
 *      alohida endpoint orqali beradi — hali kelishilmagan).
 *   3) Vazn jadvali ('GRADE_WEIGHTS') — frontend hisobi, backendda u har
 *      bir baho uchun 'grades.weight' ustunida saqlanadi.
 *
 * Endpoint paydo boʻlganda: enum'lar generatsiya qilingan tiplardan
 * olinadi va bu fayldagi qoʻlda yozilgan union'lar oʻchiriladi; yorliq
 * va vazn jadvallari qoladi.
 */

// ───────────────────────── Davomat ─────────────────────────

/** `attendance.py::AttendanceStatus` — DAV-01. */
export type AttendanceStatus = "present" | "absent" | "excused" | "late";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "excused",
  "late",
];

/** `attendance.py::ATTENDANCE_LABELS_UZ` bilan bir xil boʻlishi shart. */
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Keldi",
  absent: "Kelmadi",
  excused: "Sababli",
  late: "Kechikdi",
};

export const ATTENDANCE_TONE: Record<
  AttendanceStatus,
  "success" | "danger" | "warning" | "info"
> = {
  present: "success",
  absent: "danger",
  excused: "info",
  late: "warning",
};

// ───────────────────── Uy vazifasi holati ─────────────────────

/**
 * `homework.py::SubmissionStatus` — UYV-03, UYV-04.
 *
 * `returned` («qayta ishlash uchun qaytarildi») avval faqat ustoz
 * kabinetida bor edi, oʻquvchi kabinetida yoʻq edi. Endi ikkalasi ham
 * shu roʻyxatdan oladi.
 */
export type SubmissionStatus =
  | "assigned"
  | "submitted"
  | "late"
  | "graded"
  | "returned";

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "assigned",
  "submitted",
  "late",
  "graded",
  "returned",
];

/** `homework.py::SUBMISSION_LABELS_UZ` bilan bir xil boʻlishi shart. */
export const SUBMISSION_LABELS: Record<SubmissionStatus, string> = {
  assigned: "Topshirilmagan",
  submitted: "Tekshirilmagan",
  late: "Kechikkan",
  graded: "Baholangan",
  returned: "Qaytarilgan",
};

export const SUBMISSION_TONE: Record<
  SubmissionStatus,
  "brand" | "success" | "warning" | "danger"
> = {
  assigned: "brand",
  submitted: "brand",
  late: "danger",
  graded: "success",
  returned: "warning",
};

// ───────────────────────── Baholar ─────────────────────────

/** `homework.py::GradeKind` — JUR-03. */
export type GradeKind = "current" | "control" | "term" | "annual";

export const GRADE_KINDS: GradeKind[] = ["current", "control", "term", "annual"];

export const GRADE_KIND_LABELS: Record<GradeKind, string> = {
  current: "Joriy",
  control: "Nazorat ishi",
  term: "Chorak",
  annual: "Yillik",
};

/**
 * JUR-04: chorak bahosi vaznli oʻrtachadan chiqadi.
 *
 * MUHIM: bu jadval BITTA boʻlishi shart. Ilgari ikkita edi —
 * `lib/grades.ts` da nazorat ishi 2 ga, `lib/teacher/store.ts` da 3 ga
 * teng edi. Natijada bir xil baholardan oʻquvchi kabineti va ustoz
 * jurnali ikki xil oʻrtacha chiqarardi.
 *
 * Backendda vazn `grades.weight` ustunida har bir baho uchun alohida
 * saqlanadi; bu yerdagi qiymat — sozlama kelmaguncha ishlaydigan standart.
 */
export const GRADE_WEIGHTS: Record<GradeKind, number> = {
  current: 1,
  control: 3,
  // Chorak va yillik — formulaning NATIJASI, kirish qiymati emas.
  term: 0,
  annual: 0,
};

/** `homework.py::GradingScale` — JUR-02. Backend matn kodi bilan ishlaydi. */
export type GradingScaleCode = "five" | "hundred";

/** `homework.py::SCALE_MAX`. */
export const SCALE_MAX: Record<GradingScaleCode, number> = {
  five: 5,
  hundred: 100,
};

/**
 * Interfeys eng yuqori ball bilan ishlaydi (`5` yoki `100`) — shunda
 * `scale === 5` kabi tekshiruvlar sodda qoladi. Backendga yuborishdan
 * oldin kodga oʻgiriladi.
 */
export type GradingScale = 5 | 100;

export function scaleToCode(scale: GradingScale): GradingScaleCode {
  return scale === 5 ? "five" : "hundred";
}

export function codeToScale(code: GradingScaleCode): GradingScale {
  return SCALE_MAX[code] as GradingScale;
}

// ───────────────────────── Rollar ─────────────────────────

/**
 * `identity.py::RoleName`.
 *
 * Ikki tomon toʻliq mos emas va bu ataylab:
 *
 *   `homeroom_teacher` — backendda alohida rol, frontendda alohida
 *   kabinet YOʻQ: sinf rahbari ustoz kabinetida ishlaydi, farqi faqat
 *   huquqlarda (`lib/teacher/roles.ts`). Shu sabab u `teacher` kabinetiga
 *   olib boradi.
 *
 *   `academic` — oʻquv boʻlimi. Maktab rahbari soʻragan yangi rol,
 *   backend enum'iga qoʻshildi.
 */
export type BackendRole =
  | "student"
  | "parent"
  | "teacher"
  | "homeroom_teacher"
  | "academic"
  | "admin"
  | "director"
  | "superadmin";

export const BACKEND_ROLES: BackendRole[] = [
  "student",
  "parent",
  "teacher",
  "homeroom_teacher",
  "academic",
  "admin",
  "director",
  "superadmin",
];

/**
 * JWT dagi rollardan kabinetni tanlash. Bir foydalanuvchida bir nechta
 * rol boʻlishi mumkin (AUT-04), shuning uchun tartib muhim: roʻyxatda
 * yuqoriroq turgan rol ustun keladi.
 */
export const ROLE_PRIORITY: BackendRole[] = [
  "superadmin",
  "director",
  "admin",
  "academic",
  "homeroom_teacher",
  "teacher",
  "parent",
  "student",
];
