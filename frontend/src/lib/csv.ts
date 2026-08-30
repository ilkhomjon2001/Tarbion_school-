/**
 * CSV yuklab olish — kutubxonasiz.
 *
 * XLSX/PDF uchun alohida kutubxona kerak boʻlardi (docs/DECISIONS.md
 * ga qara). CSV Excel'da toʻgʻridan-toʻgʻri ochiladi, BOM qoʻshilgani
 * uchun oʻzbekcha harflar buzilmaydi.
 */
export function downloadCsv(fileName: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
