"use client";

import type { DirectorReports } from "@/lib/director/types";

/**
 * DIR-08: hisobotni yuklab olish. Haqiqiy XLSX/PDF generatsiyasi uchun
 * kutubxona ulash kerak boʻlardi (bitta demo tugma uchun ortiqcha) — shu
 * sabab CSV tanlandi: qo'shimcha kutubxonasiz ishlaydi va Excel'da
 * to'g'ridan-to'g'ri ochiladi. Qaror docs/DECISIONS.md ga yozilgan.
 */
export function ExportReportButton({ data }: { data: DirectorReports }) {
  function handleExport() {
    const rows: string[][] = [["Boʻlim", "Ustun 1", "Ustun 2", "Ustun 3"]];

    rows.push(["Baholar taqsimoti", "Baho", "Oʻquvchilar soni", ""]);
    data.gradeDistribution.forEach((b) => rows.push(["", b.label, String(b.count), ""]));

    rows.push(["Fanlar boʻyicha oʻrtacha baho", "Fan", "Oʻrtacha baho", ""]);
    data.subjectAverages.forEach((s) => rows.push(["", s.subject, s.average.toFixed(1), ""]));

    rows.push(["Sinflar reytingi", "Sinf", "Oʻrtacha baho", ""]);
    data.classRanking.forEach((c) => rows.push(["", c.className, c.averageGrade.toFixed(1), ""]));

    rows.push(["Toʻlov yigʻilishi dinamikasi", "Oy", "Yigʻilgan foiz", ""]);
    data.paymentTrend.forEach((p) => rows.push(["", p.monthLabel, `${p.collectedPercent}%`, ""]));

    rows.push(["Xavf ostidagi oʻquvchilar", "F.I.Sh", "Sinf", "Sabab"]);
    data.atRiskStudents.forEach((s) => rows.push(["", s.fullName, s.className, s.detail]));

    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tarbion-hisobot.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      Hisobotni yuklab olish (CSV)
    </button>
  );
}
