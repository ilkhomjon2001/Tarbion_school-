"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { InfoIcon } from "@/components/ui/icons";
import { isRemembered } from "@/lib/auth";

interface DeviceEntry {
  id: string;
  label: string;
  location: string;
  lastActiveLabel: string;
  isCurrent: boolean;
}

const OTHER_DEVICES: DeviceEntry[] = [
  {
    id: "d-1",
    label: "Chrome · Windows",
    location: "5-informatika xonasi",
    lastActiveLabel: "2 kun oldin",
    isCurrent: false,
  },
  {
    id: "d-2",
    label: "Safari · iPhone",
    location: "Uy",
    lastActiveLabel: "1 hafta oldin",
    isCurrent: false,
  },
  {
    id: "d-3",
    label: "Firefox · Windows",
    location: "Kutubxona kompyuteri",
    lastActiveLabel: "3 hafta oldin",
    isCurrent: false,
  },
];

/**
 * "Faol qurilmalar" — umumiy/maktab kompyuterlarida hisob ochiq qolib
 * ketmasligi uchun. DEMO: backendda haqiqiy sessiya jadvali yoʻq (T-004),
 * shuning uchun roʻyxat namunaviy — faqat "joriy qurilma" haqiqiy
 * (brauzerdan aniqlanadi), qolganlari illyustrativ. "Chiqarish" bosilgach
 * oʻsha qurilma faqat shu sahifa holatidan olib tashlanadi (backend
 * ulanganda haqiqiy sessiya bekor qilinadi).
 */
export function DeviceSecurity() {
  const [currentLabel, setCurrentLabel] = useState("Ushbu qurilma");
  const [remembered, setRemembered] = useState(false);
  const [others, setOthers] = useState(OTHER_DEVICES);

  useEffect(() => {
    setCurrentLabel(describeBrowser(navigator.userAgent));
    setRemembered(isRemembered());
  }, []);

  const currentDevice: DeviceEntry = useMemo(
    () => ({
      id: "current",
      label: currentLabel,
      location: remembered ? "Bu qurilmada eslab qolingan" : "Faqat shu seans",
      lastActiveLabel: "Hozir",
      isCurrent: true,
    }),
    [currentLabel, remembered],
  );

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-lg bg-info-tint px-3 py-2 text-xs text-info">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Umumiy yoki maktab kompyuteridan foydalanganingizda, ishni tugatgach
          boshqa qurilmalarni bu yerdan chiqarib qoʻying.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        <DeviceRow device={currentDevice} />
        {others.map((device) => (
          <DeviceRow
            key={device.id}
            device={device}
            onLogout={() => setOthers((prev) => prev.filter((d) => d.id !== device.id))}
          />
        ))}
      </ul>

      {others.length > 0 && (
        <button
          type="button"
          onClick={() => setOthers([])}
          className="mt-3 h-10 w-full rounded-lg border border-danger/40 text-sm font-medium text-danger transition-colors hover:bg-danger-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          Joriy qurilmadan tashqari barchasidan chiqish
        </button>
      )}
    </div>
  );
}

function DeviceRow({ device, onLogout }: { device: DeviceEntry; onLogout?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{device.label}</p>
          {device.isCurrent && <Badge tone="success">Joriy qurilma</Badge>}
        </div>
        <p className="truncate text-xs text-foreground-muted">
          {device.location} · {device.lastActiveLabel}
        </p>
      </div>
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
        >
          Chiqarish
        </button>
      )}
    </li>
  );
}

function describeBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  let browser = "Brauzer";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/")) browser = "Safari";

  let os = "qurilma";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  return `${browser} · ${os}`;
}
