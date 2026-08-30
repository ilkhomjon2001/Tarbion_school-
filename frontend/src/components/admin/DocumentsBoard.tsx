"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardIcon } from "@/components/ui/icons";
import { ACADEMIC_YEAR, useAdmin, useAdminDispatch } from "@/lib/admin/store";
import { buildDocumentText, fullDate, SCHOOL_NAME } from "@/lib/admin/documents";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  type AdminStudent,
  type DocumentRequest,
  type DocumentType,
} from "@/lib/admin/types";

type Tab = "queue" | "registry";

const STATUS_TONE = {
  new: "success",
  waiting: "warning",
  issued: "neutral",
} as const;

export function DocumentsBoard({ preselectStudent = "" }: { preselectStudent?: string }) {
  const { documents, students } = useAdmin();
  const [tab, setTab] = useState<Tab>("queue");
  const queue = useMemo(() => documents.filter((d) => d.status !== "issued"), [documents]);
  const registry = useMemo(() => documents.filter((d) => d.status === "issued"), [documents]);

  // Oʻquvchilar sahifasidan "Maʼlumotnoma yaratish" bosilsa — oʻsha
  // oʻquvchining soʻrovi ochilgan holda keladi. Boshlangʻich qiymat
  // useEffect'da emas, useState ichida hisoblanadi: aks holda server
  // chizgan HTML'da quruvchi boʻlmay qoladi va sahifa sakrab ochiladi.
  const [activeId, setActiveId] = useState<string | null>(() => {
    const match = preselectStudent
      ? documents.find((d) => d.studentId === preselectStudent && d.status !== "issued")
      : undefined;
    return match?.id ?? null;
  });

  // Hujjat berilgach navbatdan chiqadi — keyingisiga oʻtamiz.
  const active = queue.find((d) => d.id === activeId) ?? queue[0] ?? null;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <h1 className="text-h2 font-bold text-foreground">Maʼlumotnomalar</h1>

      <div role="tablist" aria-label="Maʼlumotnoma boʻlimlari" className="flex gap-1 border-b border-border">
        <TabButton active={tab === "queue"} onClick={() => setTab("queue")}>
          Soʻrovlar ({queue.length})
        </TabButton>
        <TabButton active={tab === "registry"} onClick={() => setTab("registry")}>
          Berilganlar reyestri ({registry.length})
        </TabButton>
      </div>

      {tab === "registry" ? (
        <Registry rows={registry} students={students} />
      ) : queue.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon className="h-5 w-5" />}
          title="Soʻrov yoʻq"
          description="Barcha maʼlumotnoma soʻrovlari bajarilgan."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ol className="flex flex-col gap-2">
            <li className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Navbat
            </li>
            {queue.map((doc) => {
              const student = students.find((s) => s.id === doc.studentId);
              const selected = doc.id === activeId;
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(doc.id)}
                    aria-pressed={selected}
                    className={`focus-ring block w-full rounded-xl border bg-surface p-3 text-left transition-colors ${
                      selected
                        ? "border-brand ring-1 ring-brand"
                        : "card-interactive border-border"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <Badge tone={STATUS_TONE[doc.status]}>
                        {DOCUMENT_STATUS_LABELS[doc.status]}
                      </Badge>
                      <span className="text-xs text-foreground-muted">{doc.createdAt}</span>
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-foreground">
                      {student?.fullName ?? "—"}
                    </span>
                    <span className="block text-xs text-foreground-muted">
                      {student?.className} sinf oʻquvchisi
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-foreground">
                      <ClipboardIcon className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                      {DOCUMENT_TYPE_LABELS[doc.type]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {active && (
            <DocumentBuilder
              key={active.id}
              request={active}
              student={students.find((s) => s.id === active.studentId)!}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DocumentBuilder({
  request,
  student,
}: {
  request: DocumentRequest;
  student: AdminStudent;
}) {
  const dispatch = useAdminDispatch();
  const { documentCounter } = useAdmin();
  const [type, setType] = useState<DocumentType>(request.type);
  const [recipient, setRecipient] = useState("");
  const [copies, setCopies] = useState(1);
  const [extraText, setExtraText] = useState("");

  const number = `2026/09-${documentCounter + 1}`;
  const paragraphs = buildDocumentText(type, {
    student,
    academicYear: ACADEMIC_YEAR,
    recipient,
    extraText,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {student.fullName} uchun maʼlumotnoma yaratish
        </h2>
        <span className="num rounded-md bg-surface-muted px-2 py-1 text-xs text-foreground-muted">
          № {number}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        {/* Chap: maʼlumotlar */}
        <div className="flex flex-col gap-3">
          <Field label="Maʼlumotnoma turi">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className={inputClass}
            >
              {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <div className="rounded-lg border border-border bg-surface-muted/60 p-3">
            <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-dark">
              Avtomatik
            </span>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Oʻquvchi F.I.Sh">{student.fullName}</Row>
              <Row label="Tugʻilgan yili">{student.birthYear}</Row>
              <Row label="Sinf">{student.className}</Row>
              <Row label="Oʻquv yili">{ACADEMIC_YEAR}</Row>
              <Row label="Qabul qilingan sana">{student.enrolledAt}</Row>
              <Row label="Ota-ona / vasiy">{student.guardianName}</Row>
            </dl>
            <p className="mt-2 border-t border-border pt-2 text-[11px] text-foreground-muted">
              Bu maydonlar bazadan olinadi — qoʻlda kiritilmaydi, shu sabab hujjatda
              xato boʻlmaydi.
            </p>
          </div>

          <Field label="Kimga taqdim etiladi">
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Talab qilingan joyga"
              className={inputClass}
            />
          </Field>

          <Field label="Nusxalar soni">
            <input
              type="number"
              min={1}
              max={10}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
              className={`${inputClass} max-w-28`}
            />
          </Field>

          <Field label="Qoʻshimcha matn">
            <textarea
              value={extraText}
              onChange={(e) => setExtraText(e.target.value)}
              rows={3}
              placeholder="Ixtiyoriy — hujjat oxiriga qoʻshiladi"
              className={`${inputClass} h-auto resize-none py-2`}
            />
          </Field>
        </div>

        {/* Oʻng: A4 oldindan koʻrish */}
        <div className="rounded-lg bg-surface-muted p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Oldindan koʻrish
          </p>
          <article className="print-doc mx-auto max-w-[440px] rounded bg-surface p-6 text-[13px] leading-relaxed shadow-sm">
            <header className="border-b border-border pb-3 text-center">
              <p className="text-sm font-bold text-brand">{SCHOOL_NAME}</p>
              <p className="mt-0.5 text-[11px] text-foreground-muted">
                Toshkent shahri · Mirobod tumani
              </p>
            </header>

            <div className="mt-3 flex justify-between text-[11px] text-foreground-muted">
              <span>Sana: {fullDate("2026-09-20")}</span>
              <span className="num">Qayd raqami: № {number}</span>
            </div>

            <h3 className="my-4 text-center text-base font-bold tracking-wide text-foreground">
              MAʼLUMOTNOMA
            </h3>

            {paragraphs.map((text, i) => (
              <p key={i} className="mb-2 text-justify indent-6 text-foreground">
                {text}
              </p>
            ))}

            <div className="mt-8 flex items-end justify-between text-[11px] text-foreground-muted">
              <span>
                Direktor
                <span className="mt-4 block w-28 border-b border-foreground-muted" />
              </span>
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border text-center text-[9px]">
                Muhr oʻrni
              </span>
            </div>
          </article>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-muted/50 px-4 py-3">
        <span className="text-xs text-foreground-muted">
          Berilgandan keyin hujjat reyestrga tushadi va oʻchirilmaydi.
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="focus-ring rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Chop etish / PDF
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "ISSUE_DOCUMENT",
                documentId: request.id,
                recipient: recipient.trim() || "Talab qilingan joyga",
                copies,
                extraText,
                docType: type,
              })
            }
            className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            Yaratish va ota-onaga yuborish
          </button>
        </div>
      </div>
    </div>
  );
}

function Registry({
  rows,
  students,
}: {
  rows: DocumentRequest[];
  students: AdminStudent[];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardIcon className="h-5 w-5" />}
        title="Reyestr boʻsh"
        description="Hali bu sessiyada hujjat berilmagan. Soʻrovlar boʻlimidan hujjat yarating."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="scroll-x">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              <th className="px-3 py-3">№</th>
              <th className="px-3 py-3">Sana</th>
              <th className="px-3 py-3">Oʻquvchi</th>
              <th className="px-3 py-3">Turi</th>
              <th className="px-3 py-3">Nusxa</th>
              <th className="px-3 py-3">Kim berdi</th>
              <th className="px-3 py-3">Holati</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((doc) => {
              const student = students.find((s) => s.id === doc.studentId);
              return (
                <tr
                  key={doc.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="num px-3 py-2.5 font-medium text-foreground">{doc.number}</td>
                  <td className="num px-3 py-2.5 text-foreground-muted">{doc.issuedAt}</td>
                  <td className="px-3 py-2.5">
                    {student?.fullName}
                    <span className="block text-xs text-foreground-muted">
                      {student?.className} sinf
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-foreground-muted">
                    {DOCUMENT_TYPE_LABELS[doc.type]}
                  </td>
                  <td className="num px-3 py-2.5 text-foreground-muted">{doc.copies}</td>
                  <td className="px-3 py-2.5 text-foreground-muted">{doc.issuedBy}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone="success">Yuborildi</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-brand text-brand-dark"
          : "border-transparent text-foreground-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}
