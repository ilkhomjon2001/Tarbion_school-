import type { Announcement, Homework, TestItem } from "@/lib/types";

export interface SearchIndexItem {
  id: string;
  label: string;
  category: string;
  href: string;
}

const NAV_PAGES: SearchIndexItem[] = [
  { id: "nav-home", label: "Bosh sahifa", category: "Sahifa", href: "/student" },
  { id: "nav-schedule", label: "Jadval", category: "Sahifa", href: "/student/schedule" },
  { id: "nav-homework", label: "Uy vazifasi", category: "Sahifa", href: "/student/homework" },
  { id: "nav-tests", label: "Testlar", category: "Sahifa", href: "/student/tests" },
  { id: "nav-grades", label: "Baholar", category: "Sahifa", href: "/student/grades" },
  { id: "nav-announcements", label: "Eʼlonlar", category: "Sahifa", href: "/student/announcements" },
  { id: "nav-profile", label: "Profil", category: "Sahifa", href: "/student/profil" },
];

export function buildSearchIndex({
  homework,
  tests,
  announcements,
}: {
  homework: Homework[];
  tests: TestItem[];
  announcements: Announcement[];
}): SearchIndexItem[] {
  return [
    ...NAV_PAGES,
    ...homework.map((hw) => ({
      id: `hw-${hw.id}`,
      label: `${hw.subject} — ${hw.title}`,
      category: "Uy vazifasi",
      href: `/student/homework/${hw.id}`,
    })),
    ...tests.map((test) => ({
      id: `test-${test.id}`,
      label: `${test.subject} — ${test.title}`,
      category: "Test",
      href: `/student/tests/${test.id}`,
    })),
    ...announcements.map((item) => ({
      id: `ann-${item.id}`,
      label: item.title,
      category: "Eʼlon",
      href: "/student/announcements",
    })),
  ];
}
