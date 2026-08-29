export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="text-sm text-foreground-muted">{description}</p>
      ) : null}
    </div>
  );
}
