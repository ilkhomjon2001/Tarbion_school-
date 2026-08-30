import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className = "",
  style,
}: {
  children?: ReactNode;
  className?: string;
  /** Animatsiya kechikishi kabi hisoblanadigan qiymatlar uchun. */
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
