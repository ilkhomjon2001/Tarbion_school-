"use client";

/**
 * Telegramga ulash (T-017, BOT-01).
 *
 * TZ: «Vasiy telefon raqami va bir martalik kod orqali botga ulanadi.»
 * Kod shu yerdan olinadi, telefon esa botning oʻzida tasdiqlanadi.
 *
 * Kod EKRANDA turadi va hech qayerga saqlanmaydi: sahifa yangilansa
 * yoʻqoladi va yangisi olinadi. Shuning uchun qadamlar ketma-ketligi
 * ataylab shunday — avval «botni oching», keyin kod. Odam kodni olib,
 * botni qidirishga ketsa, qaytib kelguncha muddat oʻtib ketardi.
 */

import { useCallback, useEffect, useState } from "react";

import {
  fetchTelegramStatus,
  issueTelegramCode,
  unlinkTelegram,
  type TelegramCodeOut,
  type TelegramStatusOut,
} from "@/lib/telegram";

const tugmaClass =
  "focus-ring inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-60";

function qolgan(iso: string): string {
  const daqiqa = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  return `${daqiqa} daqiqa`;
}

export function TelegramLink() {
  const [holat, setHolat] = useState<TelegramStatusOut | null>(null);
  const [kod, setKod] = useState<TelegramCodeOut | null>(null);
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const yukla = useCallback(async () => {
    try {
      setHolat(await fetchTelegramStatus());
    } catch {
      setHolat(null);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function kodOl() {
    setBand(true);
    setXato(null);
    try {
      setKod(await issueTelegramCode());
    } catch {
      setXato("Kod olinmadi. Qayta urinib koʻring.");
    } finally {
      setBand(false);
    }
  }

  async function uz() {
    setBand(true);
    setXato(null);
    try {
      await unlinkTelegram();
      setKod(null);
      await yukla();
    } catch {
      setXato("Uzib boʻlmadi. Qayta urinib koʻring.");
    } finally {
      setBand(false);
    }
  }

  if (holat === null) return null;

  // Bot sozlanmagan boʻlsa ulanishni taklif qilish — odamni bajarib
  // boʻlmaydigan ishga yuborish demakdir.
  if (!holat.bot_username) {
    return (
      <div className="mb-5 rounded-xl border border-border bg-surface-muted/60 p-4">
        <p className="font-medium text-foreground-muted">
          Telegram-bot hali ishga tushirilmagan
        </p>
        <p className="mt-1 text-sm text-foreground-muted">
          Bot ishga tushgach, davomat, baho va toʻlov haqidagi xabarlar Telegram
          orqali keladi. Ulanish yoʻriqnomasi shu yerda paydo boʻladi.
        </p>
      </div>
    );
  }

  if (holat.linked) {
    return (
      <div className="mb-5 rounded-xl border border-success bg-success-tint p-4">
        <p className="font-medium text-foreground">Telegram ulangan</p>
        <p className="mt-1 text-sm text-foreground-muted">
          Farzandingiz darsga kelmasa, yangi baho qoʻyilsa yoki maktab eʼlon
          chiqarsa — @{holat.bot_username} orqali xabar keladi.
        </p>
        {xato && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {xato}
          </p>
        )}
        <button
          type="button"
          disabled={band}
          onClick={() => void uz()}
          className="focus-ring mt-3 h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-60"
        >
          {band ? "Uzilmoqda…" : "Bogʻlanishni uzish"}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-border bg-surface p-4">
      <p className="font-medium text-foreground">Telegramga ulash</p>
      <p className="mt-1 text-sm text-foreground-muted">
        Ulansangiz farzandingiz darsga kelmagani, yangi baho va maktab eʼlonlari
        haqida darhol xabar olasiz.
      </p>

      <ol className="mt-3 flex flex-col gap-2 text-sm text-foreground">
        <li>
          <span className="font-medium">1.</span> Telegramda{" "}
          <a
            href={`https://t.me/${holat.bot_username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded text-brand-dark underline underline-offset-2"
          >
            @{holat.bot_username}
          </a>{" "}
          ni oching va <span className="num">/start</span> bosing.
        </li>
        <li>
          <span className="font-medium">2.</span> «Raqamimni yuborish» tugmasini
          bosing.
        </li>
        <li>
          <span className="font-medium">3.</span> Quyidagi kodni botga yuboring.
        </li>
      </ol>

      {kod ? (
        <div className="mt-3 rounded-lg bg-surface-muted p-3">
          <p className="num text-3xl font-bold tracking-[0.2em] text-foreground">
            {kod.code}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {qolgan(kod.expires_at)} amal qiladi. Muddati oʻtsa yangisini oling.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-foreground-muted">
          Kodni bot sizdan soʻraganda oling — u 15 daqiqa amal qiladi.
        </p>
      )}

      {xato && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {xato}
        </p>
      )}

      <button
        type="button"
        disabled={band}
        onClick={() => void kodOl()}
        className={`${tugmaClass} mt-3`}
      >
        {band ? "Olinmoqda…" : kod ? "Yangi kod olish" : "Kod olish"}
      </button>
    </div>
  );
}
