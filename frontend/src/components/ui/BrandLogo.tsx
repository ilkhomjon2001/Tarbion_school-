import Image from "next/image";

/**
 * Tarbion logotipi — barcha kabinetlar uchun yagona manba.
 *
 * Har bo'lim o'z logotipini yozib qo'ymasin: aks holda ustoz, o'quvchi va
 * rahbariyat kabinetida uch xil o'lcham va uch xil variant paydo bo'ladi.
 * Bu yerdan olinadi.
 *
 * Variantlar:
 *   wordmark  — faqat "Tarbion" (yon panel sarlavhasi uchun)
 *   lockup    — "Tarbion" + shior (oq fonli keng joylar uchun)
 *   white     — oq versiya (yashil fon uchun, masalan kirish sahifasi)
 *   mark      — kvadrat belgi (tor joy, mobil sarlavha)
 */

type Variant = "wordmark" | "lockup" | "white" | "mark";

const SOURCES: Record<Variant, { src: string; width: number; height: number }> = {
  wordmark: { src: "/logo/tarbion-wordmark.png", width: 320, height: 71 },
  lockup: { src: "/logo/tarbion-lockup.png", width: 560, height: 87 },
  white: { src: "/logo/tarbion-lockup-white.png", width: 560, height: 87 },
  mark: { src: "/logo/tarbion-mark.png", width: 256, height: 256 },
};

export function BrandLogo({
  variant = "wordmark",
  className = "h-7 w-auto",
  subtitle,
  priority = false,
}: {
  variant?: Variant;
  /** Balandlikni shu yerda beriladi, masalan "h-7 w-auto". */
  className?: string;
  /** Logotip ostidagi matn — kabinet nomi ("Ustoz kabineti" va h.k.). */
  subtitle?: string;
  priority?: boolean;
}) {
  const source = SOURCES[variant];

  const image = (
    <Image
      src={source.src}
      alt="Tarbion"
      width={source.width}
      height={source.height}
      priority={priority}
      className={className}
    />
  );

  if (!subtitle) return image;

  return (
    <span className="block min-w-0">
      {image}
      <span className="mt-1 block truncate text-[11px] text-foreground-muted">
        {subtitle}
      </span>
    </span>
  );
}
