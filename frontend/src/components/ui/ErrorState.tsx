export function ErrorState({
  title = "Xatolik yuz berdi",
  description = "Maʼlumotni yuklab boʻlmadi. Internet aloqasini tekshirib, qayta urinib koʻring.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-danger-tint bg-danger-tint px-4 py-10 text-center">
      <p className="text-sm font-medium text-danger">{title}</p>
      <p className="text-sm text-danger/80">{description}</p>
    </div>
  );
}
