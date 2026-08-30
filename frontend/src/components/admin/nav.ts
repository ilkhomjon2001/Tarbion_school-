import {
  BarChartIcon,
  BookOpenIcon,
  ClipboardIcon,
  ClockIcon,
  GraduationCapIcon,
  GridIcon,
  MessageSquareIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";

/**
 * Admin navigatsiyasi bitta joyda — sidebar, mobil menyu va qidiruv
 * indeksi shundan oladi. Ikki joyda takrorlansa, biri yangilanmay
 * qolib ketadi.
 */
export const ADMIN_NAV = [
  { href: "/admin", label: "Bosh sahifa", icon: GridIcon },
  { href: "/admin/oquvchilar", label: "Oʻquvchilar", icon: UsersIcon },
  { href: "/admin/qabul", label: "Qabul", icon: GraduationCapIcon },
  { href: "/admin/tolovlar", label: "Toʻlovlar", icon: WalletIcon },
  { href: "/admin/malumotnomalar", label: "Maʼlumotnomalar", icon: ClipboardIcon },
  { href: "/admin/murojaatlar", label: "Murojaatlar", icon: MessageSquareIcon },
  { href: "/admin/sorovnomalar", label: "Soʻrovnomalar", icon: BarChartIcon },
  { href: "/admin/baza", label: "Maʼlumot bazasi", icon: BookOpenIcon },
  { href: "/admin/audit", label: "Audit jurnali", icon: ClockIcon },
] as const;

export function isNavActive(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}
