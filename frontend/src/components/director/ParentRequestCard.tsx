"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ParentRequest, RequestReply, RequestStatus } from "@/lib/director/types";

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "Yangi",
  in_progress: "Koʻrib chiqilmoqda",
  closed: "Yopilgan",
};

const STATUS_TONE: Record<RequestStatus, "info" | "warning" | "neutral"> = {
  new: "info",
  in_progress: "warning",
  closed: "neutral",
};

export function ParentRequestCard({ request }: { request: ParentRequest }) {
  const [replies, setReplies] = useState(request.replies);
  const [status, setStatus] = useState(request.status);
  const [draft, setDraft] = useState("");

  function sendReply() {
    const text = draft.trim();
    if (!text) return;
    const reply: RequestReply = {
      id: `${request.id}-${Date.now()}`,
      author: "maktab",
      text,
      createdAt: "Hozir",
    };
    setReplies((prev) => [...prev, reply]);
    setDraft("");
    if (status === "new") setStatus("in_progress");
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{request.subject}</p>
          <p className="text-xs text-foreground-muted">
            {request.parentName} · {request.studentFullName} ({request.className})
          </p>
        </div>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
      </div>
      <p className="mt-2 text-sm text-foreground-muted">{request.message}</p>
      <p className="mt-1 text-[11px] text-foreground-muted">{request.createdAt}</p>

      {replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          {replies.map((reply) => (
            <li
              key={reply.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                reply.author === "maktab"
                  ? "self-end bg-brand-tint text-brand-dark"
                  : "self-start bg-surface-muted text-foreground"
              }`}
            >
              <p className="mb-0.5 text-[11px] font-medium opacity-70">
                {reply.author === "maktab" ? "Maktab" : request.parentName}
              </p>
              <p>{reply.text}</p>
              <p className="mt-0.5 text-[10px] opacity-60">{reply.createdAt}</p>
            </li>
          ))}
        </ul>
      )}

      {status === "closed" ? (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-foreground-muted">Bu murojaat yopilgan.</p>
          <button
            type="button"
            onClick={() => setStatus("in_progress")}
            className="text-xs font-medium text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Qayta ochish
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Javob yozing…"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStatus("closed")}
              className="text-xs font-medium text-foreground-muted transition-colors hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Murojaatni yopish
            </button>
            <button
              type="button"
              onClick={sendReply}
              disabled={!draft.trim()}
              className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              Yuborish
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
