"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_TARGET_LABELS,
  withNewMessage,
  type Appeal,
  type AppealStatus,
  type MessageAuthor,
} from "@/lib/school/appeals";
import { staffById } from "@/lib/school/staff";

const STATUS_TONE: Record<AppealStatus, "info" | "warning" | "success" | "neutral"> = {
  new: "info",
  in_review: "warning",
  answered: "success",
  closed: "neutral",
};

/**
 * Bitta murojaat = ochiq yozishma (chat). Uchala kabinet ham shu
 * komponentni ishlatadi, faqat `viewer` bilan kim yozayotgani belgilanadi.
 *
 * DEMO: xabar faqat sahifa holatida saqlanadi — backend (`appeal_messages`)
 * ulanganda `onSend` real API chaqiruviga almashtiriladi.
 */
export function AppealThread({
  appeal: initialAppeal,
  viewer,
  viewerStaffId,
  showCounterparty = true,
  defaultOpen = false,
}: {
  appeal: Appeal;
  viewer: MessageAuthor;
  /** `viewer === "staff"` boʻlsa — javob yozayotgan xodim id'si. */
  viewerStaffId?: string;
  /** Ota-ona uchun "kimga", xodim uchun "kimdan" koʻrsatiladi. */
  showCounterparty?: boolean;
  defaultOpen?: boolean;
}) {
  const [appeal, setAppeal] = useState(initialAppeal);
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const assignee = staffById(appeal.assigneeId);
  const messageCount = appeal.messages.length;

  // Yozishma ochilganda va yangi xabar qoʻshilganda oxiriga tushamiz —
  // aks holda uzun yozishmada yangi xabar koʻrinmay qoladi.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, messageCount]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setAppeal((prev) => withNewMessage(prev, { author: viewer, staffId: viewerStaffId, text }));
    setDraft("");
    inputRef.current?.focus();
  }

  const counterparty =
    viewer === "parent"
      ? `${APPEAL_TARGET_LABELS[appeal.target]}${appeal.subject ? ` · ${appeal.subject}` : ""}${
          assignee ? ` · ${assignee.shortName}` : ""
        }`
      : `${appeal.parentName} · ${appeal.studentFullName} (${appeal.className})`;

  const lastMessage = appeal.messages[messageCount - 1];
  const isClosed = appeal.status === "closed";

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-surface transition-colors ${
        open ? "border-brand/40" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring-inset flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-surface-muted/50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{appeal.title}</p>
          {showCounterparty && (
            <p className="truncate text-xs text-foreground-muted">{counterparty}</p>
          )}
          {!open && lastMessage && (
            <p className="mt-1 truncate text-xs text-foreground-muted">
              {lastMessage.author === "parent" ? "Ota-ona: " : "Maktab: "}
              {lastMessage.text}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="flex flex-col items-end gap-1">
            <Badge tone={STATUS_TONE[appeal.status]}>{APPEAL_STATUS_LABELS[appeal.status]}</Badge>
            <span className="text-[11px] text-foreground-muted">
              {appeal.createdAt} · <span className="num">{messageCount}</span> ta xabar
            </span>
          </div>
          <ChevronRightIcon
            aria-hidden="true"
            className={`mt-1 h-4 w-4 text-foreground-muted transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="animate-expand border-t border-border p-4">
          {/* Uzun yozishma kartochkani choʻzib yubormasin */}
          <ul ref={listRef} className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {appeal.messages.map((message) => {
              const author = message.staffId ? staffById(message.staffId) : null;
              const mine = message.author === viewer;
              return (
                <li
                  key={message.id}
                  className={`animate-enter max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    mine
                      ? "self-end bg-brand-tint text-brand-dark"
                      : "self-start bg-surface-muted text-foreground"
                  }`}
                >
                  <p className="mb-0.5 text-[11px] font-medium opacity-70">
                    {message.author === "parent" ? appeal.parentName : (author?.shortName ?? "Maktab")}
                  </p>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <p className="mt-0.5 text-[10px] opacity-60">{message.createdAt}</p>
                </li>
              );
            })}
          </ul>

          {isClosed ? (
            <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
              Murojaat yopilgan. Yangi savol boʻlsa — alohida murojaat yuboring.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Ctrl/Cmd + Enter — yuborish. Oddiy Enter yangi qator qoldiradi.
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="Xabar yozing…"
                aria-label="Xabar matni"
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {viewer === "staff" ? (
                  <CloseAction
                    confirming={confirmClose}
                    onAsk={() => setConfirmClose(true)}
                    onCancel={() => setConfirmClose(false)}
                    onConfirm={() => {
                      setAppeal((prev) => ({ ...prev, status: "closed" }));
                      setConfirmClose(false);
                    }}
                  />
                ) : (
                  <span className="text-xs text-foreground-muted">
                    Javob muddati: {appeal.dueAt}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="hidden text-[11px] text-foreground-muted sm:inline">
                    Ctrl + Enter
                  </span>
                  <button
                    type="button"
                    onClick={send}
                    disabled={!draft.trim()}
                    className="focus-ring h-9 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
                  >
                    Yuborish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Murojaatni yopish — ikki qadamli. Bir bosishda yopilib qolsa, xodim
 * xatosini oʻzi orqaga qaytara olmaydi (murojaat holati audit'ga tushadi).
 */
function CloseAction({
  confirming,
  onAsk,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={onAsk}
        className="focus-ring rounded text-xs font-medium text-foreground-muted transition-colors hover:text-danger"
      >
        Murojaatni yopish
      </button>
    );
  }

  return (
    <span className="animate-enter flex items-center gap-2 text-xs">
      <span className="text-foreground-muted">Yopilsinmi?</span>
      <button
        type="button"
        onClick={onConfirm}
        className="focus-ring rounded-md bg-danger px-2.5 py-1 font-medium text-brand-foreground transition-colors hover:opacity-90"
      >
        Ha, yopilsin
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="focus-ring rounded-md border border-border px-2.5 py-1 font-medium text-foreground-muted transition-colors hover:bg-surface-muted"
      >
        Bekor qilish
      </button>
    </span>
  );
}
