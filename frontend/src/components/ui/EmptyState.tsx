import type { ReactNode } from "react";

/**
 * Boʻsh holat. Faqat "maʼlumot yoʻq" deb qoʻyish yetarli emas —
 * belgi holatni bir qarashda tanitadi, `action` esa keyingi qadamni
 * koʻrsatadi (masalan "Birinchi eʼlonni qoʻshish").
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="animate-enter flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
      {icon && (
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-foreground-muted shadow-sm">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-foreground-muted">{description}</p>
      ) : null}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
