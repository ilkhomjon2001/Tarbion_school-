"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  ACADEMIC_YEAR,
  ADMIN_NAME,
  buildAppeals,
  buildApplications,
  buildAuditLog,
  buildClasses,
  buildConversationNotes,
  buildDocumentRequests,
  buildProfile,
  buildQuarters,
  buildRooms,
  buildStudents,
  buildSubjects,
  buildSurveyResults,
  buildSurveys,
  ISSUED_DOCUMENTS_BEFORE,
  SURVEY_ROUND,
} from "@/lib/admin/seed";
import {
  DEBT_ACTION_LABELS,
  DOCUMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type AdminClass,
  type AdminProfile,
  type AdminStudent,
  type AdminSubject,
  type Application,
  type AuditAction,
  type AuditEntry,
  type ConversationNote,
  type DebtAction,
  type DebtActionType,
  type DocumentRequest,
  type PaymentEntry,
  type PaymentMethod,
  type Quarter,
  type Reminder,
  type Room,
  type SurveyDefinition,
} from "@/lib/admin/types";
import { withNewMessage, type Appeal } from "@/lib/school/appeals";
import { ADMINISTRATOR, staffById } from "@/lib/school/staff";
import { formatSom } from "@/lib/format";

/**
 * Administrator kabineti holati.
 *
 * DEMO: backend yoʻq, shuning uchun barcha amal shu yerdagi reducer'da
 * bajariladi. Holat sahifalar orasida saqlanadi (layout darajasidagi
 * provider), brauzer yangilanganda boshlangʻich holatga qaytadi —
 * loyiha egasi bilan shunday kelishilgan.
 *
 * Backend ulanganda har bir `case` bitta API chaqiruviga aylanadi,
 * komponentlar oʻzgarmaydi.
 */
export interface AdminState {
  profile: AdminProfile;
  students: AdminStudent[];
  payments: PaymentEntry[];
  debtActions: DebtAction[];
  reminders: Reminder[];
  applications: Application[];
  documents: DocumentRequest[];
  notes: ConversationNote[];
  appeals: Appeal[];
  surveys: SurveyDefinition[];
  classes: AdminClass[];
  subjects: AdminSubject[];
  rooms: Room[];
  quarters: Quarter[];
  audit: AuditEntry[];
  /** Berilgan hujjatlar hisoblagichi — raqam generatsiyasi uchun. */
  documentCounter: number;
}

export type AdminEvent =
  | {
      type: "RECORD_PAYMENT";
      studentId: string;
      amount: number;
      method: PaymentMethod;
      paidAt: string;
      receiptNo: string;
      note: string;
    }
  | { type: "STORNO_PAYMENT"; paymentId: string; reason: string }
  | {
      type: "DEBT_ACTION";
      studentId: string;
      actionType: DebtActionType;
      newDueDate?: string;
      percent?: number;
      amount: number;
      reason: string;
    }
  | { type: "SEND_REMINDER"; studentIds: string[]; channel: "bot" | "sms"; text: string }
  /** `applicationId` boʻlmasa — admin qoʻlda kiritgan yangi oʻquvchi. */
  | { type: "ACCEPT_APPLICATION"; application: Application; applicationId?: string }
  | { type: "REJECT_APPLICATION"; applicationId: string; reason: string }
  | { type: "ARCHIVE_STUDENT"; studentId: string; reason: string }
  | { type: "RESTORE_STUDENT"; studentId: string }
  | { type: "CREATE_SURVEY"; survey: Omit<SurveyDefinition, "id" | "createdAt" | "createdBy" | "answeredCount"> }
  | { type: "CLOSE_SURVEY"; surveyId: string }
  | { type: "ADD_ROOM"; room: Omit<Room, "id" | "status"> }
  | { type: "ARCHIVE_ROOM"; roomId: string }
  | { type: "UPDATE_QUARTER"; quarterId: string; from: string; to: string }
  | { type: "ADD_CLASS"; grade: number; parallel: string; homeroomTeacherId: string; capacity: number }
  | { type: "UPDATE_CLASS"; classId: string; homeroomTeacherId: string; capacity: number }
  | { type: "ARCHIVE_CLASS"; classId: string }
  | { type: "ADD_SUBJECT"; name: string; hoursPerWeek: number; teacherIds: string[] }
  | { type: "ARCHIVE_SUBJECT"; subjectId: string }
  | { type: "UPDATE_PROFILE"; profile: Omit<AdminProfile, "staffId"> }
  /** Admin ota-onaga birinchi boʻlib yozadi. */
  | { type: "START_APPEAL"; studentId: string; title: string; text: string }
  | { type: "SEND_APPEAL_MESSAGE"; appealId: string; text: string }
  | { type: "CLOSE_APPEAL"; appealId: string }
  | { type: "CHANGE_CLASS"; studentIds: string[]; className: string }
  | {
      type: "ISSUE_DOCUMENT";
      documentId: string;
      recipient: string;
      copies: number;
      extraText: string;
      docType: DocumentRequest["type"];
    }
  | { type: "SAVE_NOTE"; note: Omit<ConversationNote, "id" | "createdAt" | "authorName"> };

function initialState(): AdminState {
  const students = buildStudents();
  return {
    profile: buildProfile(),
    students,
    payments: [],
    debtActions: [],
    reminders: [],
    applications: buildApplications(),
    documents: buildDocumentRequests(students),
    notes: buildConversationNotes(),
    appeals: buildAppeals(),
    surveys: buildSurveys(),
    classes: buildClasses(),
    subjects: buildSubjects(),
    rooms: buildRooms(),
    quarters: buildQuarters(),
    audit: buildAuditLog(),
    documentCounter: ISSUED_DOCUMENTS_BEFORE,
  };
}

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/** Har bir amal audit yozuvi qoldiradi — CLAUDE.md 4-qoida. */
function withAudit(
  state: AdminState,
  action: AuditAction,
  entity: string,
  detail: string,
): AuditEntry[] {
  const entry: AuditEntry = {
    id: nextId("aud"),
    at: nowLabel(),
    // Profil tahrirlansa — keyingi yozuvlar yangi ism bilan tushadi,
    // eskilari tegilmaydi (audit yozuvi oʻzgarmaydi).
    actor: state.profile.fullName,
    action,
    entity,
    detail,
  };
  return [entry, ...state.audit];
}

function nowLabel(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Bugundan N kun keyingi sana, ISO. */
function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function staffName(staffId: string): string {
  return staffById(staffId)?.shortName ?? "—";
}

function studentLabel(state: AdminState, studentId: string): string {
  const student = state.students.find((s) => s.id === studentId);
  return student ? `${student.fullName} (${student.className})` : studentId;
}

function reducer(state: AdminState, event: AdminEvent): AdminState {
  switch (event.type) {
    case "RECORD_PAYMENT": {
      const payment: PaymentEntry = {
        id: nextId("pay"),
        studentId: event.studentId,
        amount: event.amount,
        method: event.method,
        paidAt: event.paidAt,
        receiptNo: event.receiptNo,
        note: event.note,
        createdBy: state.profile.fullName,
        kind: "payment",
      };
      return {
        ...state,
        payments: [payment, ...state.payments],
        students: state.students.map((s) =>
          s.id === event.studentId ? { ...s, paidAmount: s.paidAmount + event.amount } : s,
        ),
        audit: withAudit(
          state,
          "payment",
          studentLabel(state, event.studentId),
          `${formatSom(event.amount)} · ${PAYMENT_METHOD_LABELS[event.method]}${
            event.receiptNo ? ` · chek ${event.receiptNo}` : ""
          }`,
        ),
      };
    }

    case "STORNO_PAYMENT": {
      // Toʻlov yozuvi tahrirlanmaydi — teskari yozuv qoʻshiladi (9-qoida).
      const original = state.payments.find((p) => p.id === event.paymentId);
      if (!original) return state;
      const storno: PaymentEntry = {
        ...original,
        id: nextId("pay"),
        amount: -original.amount,
        note: event.reason,
        kind: "storno",
        paidAt: nowLabel().slice(0, 10),
        createdBy: state.profile.fullName,
      };
      return {
        ...state,
        payments: [storno, ...state.payments],
        students: state.students.map((s) =>
          s.id === original.studentId
            ? { ...s, paidAmount: Math.max(0, s.paidAmount - original.amount) }
            : s,
        ),
        audit: withAudit(
          state,
          "storno",
          studentLabel(state, original.studentId),
          `${formatSom(original.amount)} bekor qilindi · ${event.reason}`,
        ),
      };
    }

    case "DEBT_ACTION": {
      const record: DebtAction = {
        id: nextId("debt"),
        studentId: event.studentId,
        type: event.actionType,
        newDueDate: event.newDueDate,
        percent: event.percent,
        amount: event.amount,
        reason: event.reason,
        createdAt: nowLabel(),
        createdBy: state.profile.fullName,
      };
      return {
        ...state,
        debtActions: [record, ...state.debtActions],
        students: state.students.map((s) => {
          if (s.id !== event.studentId) return s;
          if (event.actionType === "extend") {
            return { ...s, dueDate: event.newDueDate ?? s.dueDate };
          }
          if (event.actionType === "discount") {
            return {
              ...s,
              discountPercent: event.percent ?? 0,
              paidAmount: s.paidAmount + event.amount,
            };
          }
          // writeoff — qarz yopilgan deb belgilanadi
          return { ...s, paidAmount: s.paidAmount + event.amount };
        }),
        audit: withAudit(
          state,
          "debt",
          studentLabel(state, event.studentId),
          `${DEBT_ACTION_LABELS[event.actionType]}${
            event.actionType === "extend"
              ? ` · yangi muddat ${event.newDueDate}`
              : ` · ${formatSom(event.amount)}`
          } · ${event.reason}`,
        ),
      };
    }

    case "SEND_REMINDER": {
      const reminder: Reminder = {
        id: nextId("rem"),
        studentIds: event.studentIds,
        channel: event.channel,
        text: event.text,
        sentAt: nowLabel(),
        sentBy: state.profile.fullName,
      };
      return {
        ...state,
        reminders: [reminder, ...state.reminders],
        audit: withAudit(
          state,
          "reminder",
          `${event.studentIds.length} nafar qarzdor`,
          `${event.channel === "bot" ? "Bot" : "SMS"} orqali eslatma`,
        ),
      };
    }

    case "ACCEPT_APPLICATION": {
      const app = event.application;
      const fee = Math.round((app.monthlyFee * (100 - app.discountPercent)) / 100);
      const student: AdminStudent = {
        id: nextId("new-student"),
        fullName: app.studentFullName,
        className: app.className,
        birthYear: Number(app.birthDate.slice(0, 4)),
        guardianName: app.guardianFullName,
        guardianPhone: app.guardianPhone,
        enrolledAt: app.enrollDate,
        monthlyFee: fee,
        paidAmount: 0,
        dueDate: `2026-09-${String(app.payDay).padStart(2, "0")}`,
        attendancePercent: 100,
        discountPercent: app.discountPercent,
        status: "active",
      };
      return {
        ...state,
        students: [student, ...state.students],
        applications: state.applications.map((a) =>
          a.id === event.applicationId ? { ...a, status: "accepted" as const } : a,
        ),
        audit: withAudit(
          state,
          "enroll",
          `${app.studentFullName} (${app.className})`,
          `${event.applicationId ? "Arizadan" : "Qoʻlda kiritildi"} · shartnoma ${formatSom(fee)}${
            app.discountPercent ? ` · chegirma ${app.discountPercent}%` : ""
          }`,
        ),
      };
    }

    case "REJECT_APPLICATION":
      return {
        ...state,
        applications: state.applications.map((a) =>
          a.id === event.applicationId ? { ...a, status: "rejected" as const } : a,
        ),
        audit: withAudit(
          state,
          "enroll",
          state.applications.find((a) => a.id === event.applicationId)?.studentFullName ?? "—",
          `Ariza rad etildi · ${event.reason}`,
        ),
      };

    case "ARCHIVE_STUDENT":
      // Oʻchirilmaydi — arxivlanadi (1-qoida).
      return {
        ...state,
        students: state.students.map((s) =>
          s.id === event.studentId ? { ...s, status: "archived" as const } : s,
        ),
        audit: withAudit(
          state,
          "archive",
          studentLabel(state, event.studentId),
          event.reason || "Sabab koʻrsatilmagan",
        ),
      };

    case "RESTORE_STUDENT":
      return {
        ...state,
        students: state.students.map((s) =>
          s.id === event.studentId ? { ...s, status: "active" as const } : s,
        ),
        audit: withAudit(
          state,
          "restore",
          studentLabel(state, event.studentId),
          "Arxivdan faol holatga qaytarildi",
        ),
      };

    case "CREATE_SURVEY": {
      const survey: SurveyDefinition = {
        ...event.survey,
        id: nextId("sv"),
        createdAt: nowLabel(),
        createdBy: state.profile.fullName,
        answeredCount: 0,
      };
      return {
        ...state,
        surveys: [survey, ...state.surveys],
        audit: withAudit(
          state,
          "survey",
          survey.title,
          `${survey.sentCount} nafar ota-onaga yuborildi · ${survey.questions.length} ta savol`,
        ),
      };
    }

    case "CLOSE_SURVEY":
      return {
        ...state,
        surveys: state.surveys.map((s) =>
          s.id === event.surveyId ? { ...s, status: "closed" as const } : s,
        ),
        audit: withAudit(
          state,
          "survey",
          state.surveys.find((s) => s.id === event.surveyId)?.title ?? "—",
          "Soʻrovnoma yopildi",
        ),
      };

    case "ADD_ROOM": {
      const room: Room = { ...event.room, id: nextId("room"), status: "active" };
      return {
        ...state,
        rooms: [...state.rooms, room],
        audit: withAudit(
          state,
          "reference",
          `${room.number}-xona`,
          `Qoʻshildi · ${room.kind} · ${room.capacity} oʻrin`,
        ),
      };
    }

    case "ARCHIVE_ROOM":
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === event.roomId ? { ...r, status: "archived" as const } : r,
        ),
        audit: withAudit(
          state,
          "reference",
          `${state.rooms.find((r) => r.id === event.roomId)?.number}-xona`,
          "Foydalanishdan chiqarildi",
        ),
      };

    case "UPDATE_QUARTER": {
      const quarter = state.quarters.find((q) => q.id === event.quarterId);
      return {
        ...state,
        quarters: state.quarters.map((q) =>
          q.id === event.quarterId ? { ...q, from: event.from, to: event.to } : q,
        ),
        audit: withAudit(
          state,
          "reference",
          quarter?.name ?? "Chorak",
          `Sanalar oʻzgartirildi: ${event.from} — ${event.to}`,
        ),
      };
    }

    case "ADD_CLASS": {
      const name = `${event.grade}-${event.parallel}`;
      if (state.classes.some((c) => c.name === name && c.status === "active")) return state;
      const cls: AdminClass = {
        id: nextId("cls"),
        name,
        grade: event.grade,
        parallel: event.parallel,
        stage: event.grade <= 6 ? "boshlangʻich" : event.grade <= 9 ? "oʻrta" : "yuqori",
        homeroomTeacherId: event.homeroomTeacherId,
        capacity: event.capacity,
        status: "active",
      };
      return {
        ...state,
        classes: [...state.classes, cls].sort(
          (a, b) => a.grade - b.grade || a.parallel.localeCompare(b.parallel),
        ),
        audit: withAudit(
          state,
          "reference",
          name,
          `Yangi sinf ochildi · sinf rahbari ${staffName(event.homeroomTeacherId)} · ${event.capacity} oʻrin`,
        ),
      };
    }

    case "UPDATE_CLASS": {
      const cls = state.classes.find((c) => c.id === event.classId);
      if (!cls) return state;
      return {
        ...state,
        classes: state.classes.map((c) =>
          c.id === event.classId
            ? { ...c, homeroomTeacherId: event.homeroomTeacherId, capacity: event.capacity }
            : c,
        ),
        audit: withAudit(
          state,
          "reference",
          cls.name,
          `Sinf rahbari ${staffName(event.homeroomTeacherId)} · sigʻim ${event.capacity}`,
        ),
      };
    }

    case "ARCHIVE_CLASS": {
      const cls = state.classes.find((c) => c.id === event.classId);
      // Oʻquvchisi bor sinf arxivlanmaydi — avval koʻchirish kerak.
      if (!cls || state.students.some((s) => s.status === "active" && s.className === cls.name)) {
        return state;
      }
      return {
        ...state,
        classes: state.classes.map((c) =>
          c.id === event.classId ? { ...c, status: "archived" as const } : c,
        ),
        audit: withAudit(state, "reference", cls.name, "Sinf arxivlandi"),
      };
    }

    case "ADD_SUBJECT": {
      const name = event.name.trim();
      if (!name || state.subjects.some((s) => s.status === "active" && s.name === name)) {
        return state;
      }
      const subject: AdminSubject = {
        id: nextId("subj"),
        name,
        classCount: 0,
        hoursPerWeek: event.hoursPerWeek,
        teacherIds: event.teacherIds,
        status: "active",
      };
      return {
        ...state,
        subjects: [subject, ...state.subjects],
        audit: withAudit(
          state,
          "reference",
          name,
          `Yangi fan qoʻshildi · haftasiga ${event.hoursPerWeek} soat · ${event.teacherIds.length} ustoz`,
        ),
      };
    }

    case "ARCHIVE_SUBJECT":
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === event.subjectId ? { ...s, status: "archived" as const } : s,
        ),
        audit: withAudit(
          state,
          "reference",
          state.subjects.find((s) => s.id === event.subjectId)?.name ?? "Fan",
          "Fan oʻquv rejasidan chiqarildi",
        ),
      };

    case "UPDATE_PROFILE":
      return {
        ...state,
        profile: { ...state.profile, ...event.profile },
        audit: withAudit(
          state,
          "profile",
          event.profile.fullName,
          "Profil maʼlumotlari yangilandi",
        ),
      };

    case "START_APPEAL": {
      const student = state.students.find((s) => s.id === event.studentId);
      if (!student) return state;
      const appeal: Appeal = {
        id: nextId("ap"),
        target: "rahbariyat",
        assigneeId: ADMINISTRATOR.id,
        className: student.className,
        studentFullName: student.fullName,
        parentName: student.guardianName,
        title: event.title,
        // Maktab birinchi yozdi — ota-onaning javobi kutilmoqda.
        status: "in_review",
        createdAt: nowLabel(),
        dueAt: plusDays(3),
        messages: [
          {
            id: nextId("apm"),
            author: "staff",
            staffId: ADMINISTRATOR.id,
            text: event.text,
            createdAt: nowLabel(),
          },
        ],
      };
      return {
        ...state,
        appeals: [appeal, ...state.appeals],
        audit: withAudit(
          state,
          "appeal",
          `${student.guardianName} (${student.fullName})`,
          `Maktab yozishmani boshladi · ${event.title}`,
        ),
      };
    }

    case "SEND_APPEAL_MESSAGE":
      return {
        ...state,
        appeals: state.appeals.map((a) =>
          a.id === event.appealId
            ? withNewMessage(a, {
                author: "staff",
                staffId: ADMINISTRATOR.id,
                text: event.text,
              })
            : a,
        ),
        audit: withAudit(
          state,
          "appeal",
          state.appeals.find((a) => a.id === event.appealId)?.parentName ?? "Ota-ona",
          `Javob yuborildi · ${event.text.slice(0, 60)}`,
        ),
      };

    case "CLOSE_APPEAL":
      return {
        ...state,
        appeals: state.appeals.map((a) =>
          a.id === event.appealId ? { ...a, status: "closed" as const } : a,
        ),
        audit: withAudit(
          state,
          "appeal",
          state.appeals.find((a) => a.id === event.appealId)?.title ?? "Murojaat",
          "Murojaat yopildi",
        ),
      };

    case "CHANGE_CLASS":
      return {
        ...state,
        students: state.students.map((s) =>
          event.studentIds.includes(s.id) ? { ...s, className: event.className } : s,
        ),
        audit: withAudit(
          state,
          "archive",
          `${event.studentIds.length} nafar oʻquvchi`,
          `Sinf oʻzgartirildi → ${event.className}`,
        ),
      };

    case "ISSUE_DOCUMENT": {
      const counter = state.documentCounter + 1;
      const number = `2026/09-${counter}`;
      return {
        ...state,
        documentCounter: counter,
        documents: state.documents.map((d) =>
          d.id === event.documentId
            ? {
                ...d,
                status: "issued" as const,
                number,
                issuedAt: nowLabel().slice(0, 10),
                issuedBy: state.profile.fullName,
                recipient: event.recipient,
                copies: event.copies,
                extraText: event.extraText,
              }
            : d,
        ),
        audit: withAudit(
          state,
          "document",
          `№ ${number}`,
          `${DOCUMENT_TYPE_LABELS[event.docType]} · ${event.copies} nusxa`,
        ),
      };
    }

    case "SAVE_NOTE": {
      const note: ConversationNote = {
        ...event.note,
        id: nextId("note"),
        authorName: state.profile.fullName,
        createdAt: nowLabel(),
      };
      return {
        ...state,
        notes: [note, ...state.notes],
        audit: withAudit(
          state,
          "note",
          event.note.summary.slice(0, 40) || "Suhbat",
          note.teacherId ? `Ustoz bahosi: ${note.rating}/5` : "Qaydnoma saqlandi",
        ),
      };
    }

    default:
      return state;
  }
}

const StateContext = createContext<AdminState | null>(null);
const DispatchContext = createContext<Dispatch<AdminEvent> | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAdmin(): AdminState {
  const state = useContext(StateContext);
  if (!state) throw new Error("useAdmin faqat AdminProvider ichida ishlaydi");
  return state;
}

export function useAdminDispatch(): Dispatch<AdminEvent> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error("useAdminDispatch faqat AdminProvider ichida ishlaydi");
  return dispatch;
}

// ─────────────────────── Hosila (derived) qiymatlar ───────────────────────

export function debtOf(student: AdminStudent): number {
  return Math.max(0, student.monthlyFee - student.paidAmount);
}

/** Toʻlov muddatidan necha kun oʻtgan. Manfiy boʻlsa — hali kelmagan. */
export function overdueDays(student: AdminStudent, today = new Date("2026-09-20")): number {
  const due = new Date(student.dueDate);
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

export function useDebtors() {
  const { students } = useAdmin();
  return useMemo(
    () =>
      students
        .filter((s) => s.status === "active" && debtOf(s) > 0)
        .sort((a, b) => overdueDays(b) - overdueDays(a)),
    [students],
  );
}

/** Faol sinflar — qabul, koʻchirish va soʻrovnoma shu roʻyxatdan tanlaydi. */
export function useActiveClasses(): AdminClass[] {
  const { classes } = useAdmin();
  return useMemo(() => classes.filter((c) => c.status === "active"), [classes]);
}

export interface AdminNotification {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "info" | "warning" | "danger" | "brand";
  count: number;
}

/**
 * Bildirishnomalar — alohida roʻyxat emas, mavjud holatdan hisoblanadi.
 * Shu sabab amal bajarilishi bilan (toʻlov kiritildi, ariza koʻrildi)
 * qoʻngʻiroqdagi son ham oʻzgaradi.
 */
export function useNotifications(): AdminNotification[] {
  const { students, applications, documents, appeals, surveys } = useAdmin();

  return useMemo(() => {
    const list: AdminNotification[] = [];

    const newApplications = applications.filter((a) => a.status === "new").length;
    if (newApplications > 0) {
      list.push({
        id: "n-app",
        title: "Yangi ariza",
        detail: `${newApplications} ta ariza koʻrib chiqilmagan`,
        href: "/admin/qabul",
        tone: "brand",
        count: newApplications,
      });
    }

    const pendingDocs = documents.filter((d) => d.status !== "issued").length;
    if (pendingDocs > 0) {
      list.push({
        id: "n-doc",
        title: "Maʼlumotnoma soʻrovi",
        detail: `${pendingDocs} ta soʻrov navbatda`,
        href: "/admin/malumotnomalar",
        tone: "info",
        count: pendingDocs,
      });
    }

    const overdue = students.filter(
      (s) => s.status === "active" && debtOf(s) > 0 && overdueDays(s) > 0,
    ).length;
    if (overdue > 0) {
      list.push({
        id: "n-debt",
        title: "Muddati oʻtgan toʻlov",
        detail: `${overdue} nafar oʻquvchida kechikish bor`,
        href: "/admin/tolovlar",
        tone: "danger",
        count: overdue,
      });
    }

    const unanswered = appeals.filter((a) => a.status === "new").length;
    if (unanswered > 0) {
      list.push({
        id: "n-appeal",
        title: "Javobsiz murojaat",
        detail: `${unanswered} ta murojaatga javob berilmagan`,
        href: "/admin/murojaatlar",
        tone: "warning",
        count: unanswered,
      });
    }

    const openSurveys = surveys.filter((s) => s.status === "active");
    const waiting = openSurveys.reduce((sum, s) => sum + (s.sentCount - s.answeredCount), 0);
    if (waiting > 0) {
      list.push({
        id: "n-survey",
        title: "Soʻrovnoma davom etmoqda",
        detail: `${waiting} nafar ota-ona hali javob bermagan`,
        href: "/admin/sorovnomalar",
        tone: "info",
        count: openSurveys.length,
      });
    }

    return list;
  }, [students, applications, documents, appeals, surveys]);
}

export function useFinanceSummary() {
  const { students, payments } = useAdmin();
  return useMemo(() => {
    const active = students.filter((s) => s.status === "active");
    const expected = active.reduce((sum, s) => sum + s.monthlyFee, 0);
    const collected = active.reduce((sum, s) => sum + s.paidAmount, 0);
    const debt = expected - collected;
    const today = nowLabel().slice(0, 10);
    const todayPayments = payments.filter((p) => p.paidAt === today && p.kind === "payment");
    return {
      expected,
      collected,
      debt,
      collectedPercent: expected === 0 ? 0 : Math.round((collected / expected) * 100),
      debtPercent: expected === 0 ? 0 : Math.round((debt / expected) * 100),
      debtorCount: active.filter((s) => debtOf(s) > 0).length,
      unpaidCount: active.filter((s) => s.paidAmount === 0).length,
      partialCount: active.filter((s) => s.paidAmount > 0 && debtOf(s) > 0).length,
      todayAmount: todayPayments.reduce((sum, p) => sum + p.amount, 0),
      todayCount: todayPayments.length,
    };
  }, [students, payments]);
}

export { ACADEMIC_YEAR, ADMIN_NAME, SURVEY_ROUND, buildSurveyResults };
