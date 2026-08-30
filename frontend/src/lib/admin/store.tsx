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
  buildApplications,
  buildAuditLog,
  buildConversationNotes,
  buildDocumentRequests,
  buildQuarters,
  buildRooms,
  buildStudents,
  buildSurveyResults,
  buildSurveys,
  ISSUED_DOCUMENTS_BEFORE,
  SURVEY_ROUND,
} from "@/lib/admin/seed";
import {
  DEBT_ACTION_LABELS,
  DOCUMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type AdminStudent,
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
  students: AdminStudent[];
  payments: PaymentEntry[];
  debtActions: DebtAction[];
  reminders: Reminder[];
  applications: Application[];
  documents: DocumentRequest[];
  notes: ConversationNote[];
  surveys: SurveyDefinition[];
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
    students,
    payments: [],
    debtActions: [],
    reminders: [],
    applications: buildApplications(),
    documents: buildDocumentRequests(students),
    notes: buildConversationNotes(),
    surveys: buildSurveys(),
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
    actor: ADMIN_NAME,
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
        createdBy: ADMIN_NAME,
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
        createdBy: ADMIN_NAME,
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
        createdBy: ADMIN_NAME,
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
        sentBy: ADMIN_NAME,
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
        createdBy: ADMIN_NAME,
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
                issuedBy: ADMIN_NAME,
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
        authorName: ADMIN_NAME,
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
