import type { SearchIndexItem } from "@/lib/search";
import type { SchoolClass, Teacher } from "@/lib/director/types";

const NAV_PAGES: SearchIndexItem[] = [
  { id: "d-nav-home", label: "Bosh sahifa", category: "Sahifa", href: "/rahbar" },
  { id: "d-nav-jadval", label: "Dars jadvali", category: "Sahifa", href: "/rahbar/jadval" },
  { id: "d-nav-sinflar", label: "Sinflar", category: "Sahifa", href: "/rahbar/sinflar" },
  { id: "d-nav-ustozlar", label: "Ustozlar", category: "Sahifa", href: "/rahbar/ustozlar" },
  { id: "d-nav-tolovlar", label: "Toʻlovlar", category: "Sahifa", href: "/rahbar/tolovlar" },
  { id: "d-nav-hisobotlar", label: "Hisobotlar", category: "Sahifa", href: "/rahbar/hisobotlar" },
  { id: "d-nav-murojaatlar", label: "Murojaatlar", category: "Sahifa", href: "/rahbar/murojaatlar" },
];

export function buildDirectorSearchIndex({
  teachers,
  classes,
}: {
  teachers: Teacher[];
  classes: SchoolClass[];
}): SearchIndexItem[] {
  return [
    ...NAV_PAGES,
    ...teachers.map((teacher) => ({
      id: `d-teacher-${teacher.id}`,
      label: teacher.fullName,
      category: "Ustoz",
      href: `/rahbar/ustozlar/${teacher.id}`,
    })),
    ...classes.map((cls) => ({
      id: `d-class-${cls.id}`,
      label: `${cls.name} sinf`,
      category: "Sinf",
      href: "/rahbar/sinflar",
    })),
  ];
}
