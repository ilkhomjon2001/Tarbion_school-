"use client";

import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";

/**
 * Sinf darajasi (5-sinflar, 6-sinflar …) akkordeon qatori.
 * Toʻlov va davomat kesimlarida bir xil koʻrinishda ishlatiladi:
 * daraja → parallel sinflar → oʻquvchilar.
 */
export function GradeAccordionItem({
  title,
  meta,
  percent,
  barClass,
  right,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  meta: string;
  percent: number;
  /** Progress bar rangi — kesimga qarab chegaralar har xil. */
  barClass: string;
  /** Oʻng tomondagi qoʻshimcha maʼlumot (summa, xavf ostidagilar soni). */
  right: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <li className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`focus-ring-inset flex w-full cursor-pointer flex-col gap-2 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:gap-4 ${
          isOpen ? "bg-brand-tint/40" : "hover:bg-surface-muted/60"
        }`}
      >
        <div className="flex items-start justify-between gap-3 sm:w-44 sm:shrink-0">
          <div>
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <p className="text-xs text-foreground-muted">{meta}</p>
          </div>
          <ChevronRightIcon
            aria-hidden="true"
            className={`mt-0.5 h-4 w-4 shrink-0 text-foreground-muted transition-transform sm:hidden ${
              isOpen ? "rotate-90" : ""
            }`}
          />
        </div>

        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`bar-fill h-full rounded-full ${barClass}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="num w-10 shrink-0 text-right text-xs font-semibold text-foreground">
            {percent}%
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 text-xs text-foreground-muted sm:w-64 sm:shrink-0 sm:justify-end">
          {right}
        </div>

        <ChevronRightIcon
          aria-hidden="true"
          className={`hidden h-4 w-4 shrink-0 text-foreground-muted transition-transform sm:block ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="animate-expand border-t border-border bg-surface-muted/30 p-3">
          {children}
        </div>
      )}
    </li>
  );
}
