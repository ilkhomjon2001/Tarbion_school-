"use client";

/**
 * Xabar shablonlari (T-019, BOT-05) — administrator ekrani.
 *
 * Bu matnlar ota-onaning telefoniga boradi. Shuning uchun ikki narsa
 * ataylab qilingan:
 *
 *   · maydonlar TUGMA bilan qoʻyiladi — qoʻlda `{studentname}` deb
 *     yozilsa matnda oʻsha koʻrinishda qolib ketardi va ota-ona
 *     tushunarsiz xabar olardi;
 *   · saqlashdan oldin oldindan koʻrish bor — «kim nima oladi» degan
 *     savolga javob yuborilgandan keyin emas, oldin berilsin.
 *
 * Sukut matnlar backendda. «Sukutga qaytarish» ustamani arxivlaydi,
 * oʻchirmaydi.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { apiXato } from "@/lib/school/api";
import {
  fetchTemplates,
  resetTemplate,
  saveTemplate,
  type TemplateOut,
} from "@/lib/templates";

/** Maydon nomlari — odam tushunadigan tilda. */
const FIELD_LABELS: Record<string, string> = {
  student_name: "oʻquvchi",
  full_name: "toʻliq ism",
  class_name: "sinf",
  date: "sana",
  subject: "fan",
  period: "dars raqami",
  total: "darslar soni",
  present: "keldi",
  absent: "kelmadi",
  excused: "sababli",
  late: "kechikdi",
  login: "login",
  site: "sayt",
};

/** Oldindan koʻrish uchun namuna qiymatlar. */
const NAMUNA: Record<string, string> = {
  student_name: "Aliyev Ali",
  full_name: "Otayev Vali",
  class_name: "6-A",
  date: "07.09.2026",
  subject: "Fizika",
  period: "3",
  total: "6",
  present: "4",
  absent: "1",
  excused: "0",
  late: "1",
  login: "otayev.vali",
  site: "tarbion.uz",
};

function toldir(matn: string): string {
  return matn.replace(/\{([a-z_]+)\}/g, (m, k: string) => NAMUNA[k] ?? m);
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

export function MessageTemplates() {
  const [rows, setRows] = useState<TemplateOut[] | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  const yukla = useCallback(async () => {
    setXato(null);
    try {
      setRows(await fetchTemplates());
    } catch (err) {
      setXato(apiXato(err, "Shablonlarni yuklab boʻlmadi."));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  if (rows === null) return <ListSkeleton count={3} />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground-muted">
        Bu matnlar ota-onaning Telegramiga boradi. Jingalak qavsdagi maydonlar
        yuborishda haqiqiy qiymat bilan almashadi.
      </p>
      {xato && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}
      {rows.map((t) => (
        <TemplateCard key={t.kind} tpl={t} onChanged={yukla} />
      ))}
    </div>
  );
}

function TemplateCard({ tpl, onChanged }: { tpl: TemplateOut; onChanged: () => void }) {
  const [title, setTitle] = useState(tpl.title);
  const [body, setBody] = useState(tpl.body);
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [saqlandi, setSaqlandi] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitle(tpl.title);
    setBody(tpl.body);
  }, [tpl.title, tpl.body]);

  const ozgargan = title !== tpl.title || body !== tpl.body;

  function maydonQoy(field: string) {
    const el = bodyRef.current;
    if (!el) return;
    const boshi = el.selectionStart ?? body.length;
    const oxiri = el.selectionEnd ?? body.length;
    const yangi = `${body.slice(0, boshi)}{${field}}${body.slice(oxiri)}`;
    setBody(yangi);
    // Kursor qoʻyilgan maydondan keyin tursin.
    requestAnimationFrame(() => {
      el.focus();
      const p = boshi + field.length + 2;
      el.setSelectionRange(p, p);
    });
  }

  async function saqla() {
    setBand(true);
    setXato(null);
    try {
      await saveTemplate(tpl.kind, title, body);
      setSaqlandi(true);
      onChanged();
    } catch (err) {
      setXato(apiXato(err, "Saqlab boʻlmadi."));
    } finally {
      setBand(false);
    }
  }

  async function qaytar() {
    setBand(true);
    setXato(null);
    try {
      await resetTemplate(tpl.kind);
      onChanged();
    } catch (err) {
      setXato(apiXato(err, "Qaytarib boʻlmadi."));
    } finally {
      setBand(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{tpl.label}</h3>
        {tpl.customized ? (
          <Badge tone="warning">Oʻzgartirilgan</Badge>
        ) : (
          <Badge tone="neutral">Sukut matn</Badge>
        )}
      </div>

      <label className="mb-2 block">
        <span className="mb-1 block text-xs font-medium text-foreground-muted">Sarlavha</span>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaqlandi(false);
          }}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground-muted">Matn</span>
        <textarea
          ref={bodyRef}
          rows={4}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSaqlandi(false);
          }}
          className={`${inputClass} resize-y font-mono`}
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-foreground-muted">Maydon qoʻshish:</span>
        {tpl.fields.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => maydonQoy(f)}
            className="focus-ring rounded-md bg-surface-muted px-2 py-1 text-xs text-foreground hover:bg-border"
          >
            {FIELD_LABELS[f] ?? f}
          </button>
        ))}
      </div>

      {/* Oldindan koʻrish — «kim nima oladi» savoliga javob yuborishdan
          OLDIN berilsin. */}
      <div className="mt-3 rounded-lg bg-surface-muted p-3">
        <p className="mb-1 text-xs font-medium text-foreground-muted">
          Ota-ona shunday koʻradi:
        </p>
        <p className="text-sm font-semibold text-foreground">{toldir(title)}</p>
        <p className="whitespace-pre-wrap text-sm text-foreground">{toldir(body)}</p>
      </div>

      {xato && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={band || !ozgargan}
          onClick={() => void saqla()}
          className="focus-ring h-9 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-dark disabled:opacity-50"
        >
          {band ? "Saqlanmoqda…" : "Oʻzgarishlarni saqlash"}
        </button>
        {tpl.customized && (
          <button
            type="button"
            disabled={band}
            onClick={() => void qaytar()}
            className="focus-ring h-9 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            Sukut matnga qaytarish
          </button>
        )}
        {saqlandi && !ozgargan && (
          <span className="text-sm text-success">Saqlandi</span>
        )}
      </div>
    </section>
  );
}
