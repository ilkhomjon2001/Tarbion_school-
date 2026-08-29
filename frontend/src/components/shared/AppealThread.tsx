"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
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

  const assignee = staffById(appeal.assigneeId);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setAppeal((prev) => withNewMessage(prev, { author: viewer, staffId: viewerStaffId, text }));
    setDraft("");
  }

  const counterparty =
    viewer === "parent"
      ? `${APPEAL_TARGET_LABELS[appeal.target]}${appeal.subject ? ` · ${appeal.subject}` : ""}${
          assignee ? ` · ${assignee.shortName}` : ""
        }`
      : `${appeal.parentName} · ${appeal.studentFullName} (${appeal.className})`;

  const lastMessage = appeal.messages[appeal.messages.length - 1];

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={STATUS_TONE[appeal.status]}>{APPEAL_STATUS_LABELS[appeal.status]}</Badge>
          <span className="text-[11px] text-foreground-muted">{appeal.createdAt}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <ul className="flex flex-col gap-2">
            {appeal.messages.map((message) => {
              const author = message.staffId ? staffById(message.staffId) : null;
              const mine = message.author === viewer;
              return (
                <li
                  key={message.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
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

          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Xabar yozing…"
              aria-label="Xabar matni"
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            />
            <div className="flex items-center justify-between">
              {viewer === "staff" ? (
                <button
                  type="button"
                  onClick={() => setAppeal((prev) => ({ ...prev, status: "closed" }))}
                  className="text-xs font-medium text-foreground-muted transition-colors hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Murojaatni yopish
                </button>
              ) : (
                <span className="text-xs text-foreground-muted">
                  Javob muddati: {appeal.dueAt}
                </span>
              )}
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim()}
                className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                Yuborish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
