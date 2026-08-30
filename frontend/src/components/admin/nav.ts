import {
  BarChartIcon,
  BookOpenIcon,
  ClipboardIcon,
  ClockIcon,
  GraduationCapIcon,
  GridIcon,
  MessageSquareIcon,
  PhoneIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";

/**
 * Admin navigatsiyasi bitta joyda — sidebar, mobil menyu va qidiruv
 * indeksi shundan oladi. Ikki joyda takrorlansa, biri yangilanmay
 * qolib ketadi.
 *
 * `href` bir vaqtning oʻzida `lib/access.ts` dagi boʻlim kalitidir —
 * super admin yashirgan boʻlim shu roʻyxatdan filtrlanadi.
 */
export const ADMIN_NAV = [
  { href: "/admin", label: "Bosh sahifa", icon: GridIcon },
  { href: "/admin/oquvchilar", label: "Oʻquvchilar", icon: UsersIcon },
  { href: "/admin/lidlar", label: "Lidlar", icon: PhoneIcon },
  { href: "/admin/qabul", label: "Qabul", icon: GraduationCapIcon },
  { href: "/admin/shartnomalar", label: "Shartnomalar", icon: ShieldIcon },
  { href: "/admin/qongiroqlar", label: "Qoʻngʻiroqlar", icon: PhoneIcon },
  { href: "/admin/tolovlar", label: "Toʻlovlar", icon: WalletIcon },
  { href: "/admin/malumotnomalar", label: "Maʼlumotnomalar", icon: ClipboardIcon },
  { href: "/admin/murojaatlar", label: "Murojaatlar", icon: MessageSquareIcon },
  { href: "/admin/sorovnomalar", label: "Soʻrovnomalar", icon: BarChartIcon },
  { href: "/admin/baza", label: "Maʼlumot bazasi", icon: BookOpenIcon },
  { href: "/admin/audit", label: "Audit jurnali", icon: ClockIcon },
  { href: "/admin/sozlamalar", label: "Sozlamalar", icon: SettingsIcon },
] as const;

export function isNavActive(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}
