/**
 * Backend enum'lari bilan `lib/contracts.ts` mos kelishini tekshiradi.
 *
 * Ikki odam ikki tomonda ishlaydi. Sherik `AttendanceStatus` ga yangi
 * qiymat qoʻshsa yoki yorliq matnini oʻzgartirsa, frontend jimgina
 * eskirib qoladi — TypeScript buni koʻrmaydi, chunki Python fayl unga
 * begona. Shu skript aynan shuni tutadi.
 *
 * Ishlatish (frontend/ ichida):
 *   node --experimental-strip-types scripts/check-contracts.ts
 */

import { readFileSync, existsSync } from "node:fs";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_STATUSES,
  APPEAL_TARGET_LABELS,
  APPEAL_TARGETS,
  ATTENDANCE_LABELS,
  ATTENDANCE_STATUSES,
  BACKEND_ROLES,
  CONTACT_KIND_LABELS,
  CONTACT_KINDS,
  GRADE_KINDS,
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_KINDS,
  SCALE_MAX,
  SUBMISSION_LABELS,
  SUBMISSION_STATUSES,
} from "../src/lib/contracts.ts";

const BACKEND = "../backend/app/models";

let failed = 0;

function ok(name: string, condition: boolean, extra = "") {
  if (condition) {
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${extra ? `\n      ${extra}` : ""}`);
  }
}

function read(file: string): string {
  const path = `${BACKEND}/${file}`;
  if (!existsSync(path)) {
    console.log(`FAIL  ${file} topilmadi — backend koʻchirilganmi?`);
    failed += 1;
    return "";
  }
  return readFileSync(path, "utf8");
}

/** `class Foo(str, enum.Enum):` blokidan qiymatlarni oladi. */
function enumValues(source: string, className: string): string[] {
  const start = source.indexOf(`class ${className}(`);
  if (start === -1) return [];
  const rest = source.slice(start);
  // Blok keyingi yuqori darajadagi eʼlongacha davom etadi.
  const end = rest.slice(1).search(/\n(?:class |[A-Z_]+:|\S)/);
  const block = end === -1 ? rest : rest.slice(0, end + 1);
  return [...block.matchAll(/^\s+[A-Z_]+ = "([^"]+)"/gm)].map((m) => m[1]);
}

/** `NAME: dict[str, str] = { Enum.X.value: "matn", ... }` dan matnlarni oladi. */
function labelMap(source: string, constName: string): Record<string, string> {
  const start = source.indexOf(`${constName}:`);
  if (start === -1) return {};
  const block = source.slice(start, source.indexOf("}", start) + 1);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/\.([A-Z_]+)\.value:\s*"([^"]*)"/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

/** Python enum aʼzosi nomini qiymatiga bogʻlaydi. */
function memberToValue(source: string, className: string): Record<string, string> {
  const start = source.indexOf(`class ${className}(`);
  if (start === -1) return {};
  const rest = source.slice(start);
  const end = rest.slice(1).search(/\n(?:class |[A-Z_]+:|\S)/);
  const block = end === -1 ? rest : rest.slice(0, end + 1);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/^\s+([A-Z_]+) = "([^"]+)"/gm)) out[m[1]] = m[2];
  return out;
}

const same = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

const show = (a: string[], b: string[]) =>
  `backend: [${[...a].sort().join(", ")}]\n      frontend: [${[...b].sort().join(", ")}]`;

console.log("── Enum qiymatlari ──");

const attendance = read("attendance.py");
const homework = read("homework.py");
const identity = read("identity.py");
const appeals = read("appeals.py");
const notifications = read("notifications.py");

const beAttendance = enumValues(attendance, "AttendanceStatus");
ok(
  "AttendanceStatus",
  same(beAttendance, ATTENDANCE_STATUSES),
  show(beAttendance, ATTENDANCE_STATUSES),
);

const beSubmission = enumValues(homework, "SubmissionStatus");
ok(
  "SubmissionStatus",
  same(beSubmission, SUBMISSION_STATUSES),
  show(beSubmission, SUBMISSION_STATUSES),
);

const beGradeKind = enumValues(homework, "GradeKind");
ok("GradeKind", same(beGradeKind, GRADE_KINDS), show(beGradeKind, GRADE_KINDS));

const beScale = enumValues(homework, "GradingScale");
ok(
  "GradingScale",
  same(beScale, Object.keys(SCALE_MAX)),
  show(beScale, Object.keys(SCALE_MAX)),
);

const beRoles = enumValues(identity, "RoleName");
ok("RoleName", same(beRoles, BACKEND_ROLES), show(beRoles, BACKEND_ROLES));

const beTarget = enumValues(appeals, "AppealTarget");
ok("AppealTarget", same(beTarget, APPEAL_TARGETS), show(beTarget, APPEAL_TARGETS));

const beAppealStatus = enumValues(appeals, "AppealStatus");
ok(
  "AppealStatus",
  same(beAppealStatus, APPEAL_STATUSES),
  show(beAppealStatus, APPEAL_STATUSES),
);

const beContact = enumValues(appeals, "ContactKind");
ok("ContactKind", same(beContact, CONTACT_KINDS), show(beContact, CONTACT_KINDS));

const beNotifKind = enumValues(notifications, "NotificationKind");
ok(
  "NotificationKind",
  same(beNotifKind, NOTIFICATION_KINDS),
  show(beNotifKind, NOTIFICATION_KINDS),
);

console.log("── Oʻzbekcha yorliqlar ──");

function checkLabels(
  name: string,
  source: string,
  className: string,
  constName: string,
  frontend: Record<string, string>,
) {
  const members = memberToValue(source, className);
  const backend = labelMap(source, constName);
  const rows = Object.entries(backend);
  if (rows.length === 0) {
    ok(name, false, `${constName} oʻqilmadi`);
    return;
  }
  const bad: string[] = [];
  for (const [member, text] of rows) {
    const code = members[member];
    if (!code) {
      bad.push(`${member} — enum aʼzosi topilmadi`);
      continue;
    }
    if (frontend[code] !== text) {
      bad.push(`${code}: backend «${text}» ≠ frontend «${frontend[code] ?? "yoʻq"}»`);
    }
  }
  ok(`${name} (${rows.length} ta)`, bad.length === 0, bad.join("\n      "));
}

checkLabels(
  "ATTENDANCE_LABELS_UZ",
  attendance,
  "AttendanceStatus",
  "ATTENDANCE_LABELS_UZ",
  ATTENDANCE_LABELS,
);
checkLabels(
  "SUBMISSION_LABELS_UZ",
  homework,
  "SubmissionStatus",
  "SUBMISSION_LABELS_UZ",
  SUBMISSION_LABELS,
);

checkLabels(
  "APPEAL_TARGET_LABELS_UZ",
  appeals,
  "AppealTarget",
  "APPEAL_TARGET_LABELS_UZ",
  APPEAL_TARGET_LABELS,
);
checkLabels(
  "APPEAL_STATUS_LABELS_UZ",
  appeals,
  "AppealStatus",
  "APPEAL_STATUS_LABELS_UZ",
  APPEAL_STATUS_LABELS,
);
checkLabels(
  "CONTACT_KIND_LABELS_UZ",
  appeals,
  "ContactKind",
  "CONTACT_KIND_LABELS_UZ",
  CONTACT_KIND_LABELS,
);
checkLabels(
  "NOTIFICATION_KIND_LABELS_UZ",
  notifications,
  "NotificationKind",
  "NOTIFICATION_KIND_LABELS_UZ",
  NOTIFICATION_KIND_LABELS,
);

console.log("── SCALE_MAX qiymatlari ──");
const scaleLine = homework.match(/SCALE_MAX[^=]*=\s*\{([^}]*)\}/);
const beScaleMax: Record<string, number> = {};
if (scaleLine) {
  for (const m of scaleLine[1].matchAll(/\.([A-Z_]+)\.value:\s*(\d+)/g)) {
    const members = memberToValue(homework, "GradingScale");
    const code = members[m[1]];
    if (code) beScaleMax[code] = Number(m[2]);
  }
}
ok(
  "SCALE_MAX",
  Object.keys(beScaleMax).length > 0 &&
    Object.entries(beScaleMax).every(([k, v]) => SCALE_MAX[k as keyof typeof SCALE_MAX] === v),
  JSON.stringify(beScaleMax),
);

console.log(
  failed === 0
    ? "\nKontrakt mos — backend va frontend bir xil kodlardan ishlaydi."
    : `\n${failed} ta nomuvofiqlik. Backend oʻzgargan — src/lib/contracts.ts yangilanishi kerak.`,
);
process.exit(failed === 0 ? 0 : 1);
