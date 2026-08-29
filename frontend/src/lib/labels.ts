import type { AttendanceStatus, GradeType, HomeworkStatus } from "@/lib/types";

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

export const HOMEWORK_LABELS: Record<HomeworkStatus, string> = {
  assigned: "Berilgan",
  submitted: "Topshirilgan",
  late: "Kechikkan",
  graded: "Baholangan",
};

export const HOMEWORK_TONE: Record<
  HomeworkStatus,
  "brand" | "success" | "warning" | "danger"
> = {
  assigned: "brand",
  submitted: "brand",
  late: "danger",
  graded: "success",
};

export const GRADE_TYPE_LABELS: Record<GradeType, string> = {
  joriy: "Joriy",
  nazorat: "Nazorat ishi",
  chorak: "Chorak",
  yillik: "Yillik",
};
