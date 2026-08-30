"use client";

/**
 * Backend sessiyasi bilan ishlaydigan bloklar uchun umumiy qobiq.
 *
 * Ish tartibi har joyda bir xil: sahifa ochilganda access token xotirada
 * yoʻq (u ataylab `localStorage` da saqlanmaydi), shuning uchun avval
 * refresh cookie'dan tiklanadi. Tiklanmasa — kirish formasi.
 *
 * Bu qobiq toʻrtta kabinetga xizmat qiladi. Har birida alohida yozilsa,
 * biri kechroq 401 ni notoʻgʻri ishlab, foydalanuvchini boʻsh ekranda
 * qoldirardi.
 */

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SessionError, login, restore } from "@/lib/session";

export type SessionPhase = "checking" | "anonymous" | "ready";

export function LiveSession({
  title,
  hint,
  children,
}: {
  title: string;
  /** Kirish formasi ostidagi izoh — kabinetga qarab farq qiladi. */
  hint?: string;
  children: (reloadKey: number) => React.ReactNode;
}) {
  const [phase, setPhase] = useState<SessionPhase>("checking");
  // Kirgandan keyin ichkaridagi blok qaytadan yuklansin.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await restore();
      if (!cancelled) setPhase(ok ? "ready" : "anonymous");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSuccess = useCallback(() => {
    setReloadKey((k) => k + 1);
    setPhase("ready");
  }, []);

  if (phase === "checking") {
    return <p className="text-sm text-foreground-muted">Sessiya tekshirilmoqda…</p>;
  }
  if (phase === "anonymous") {
    return <LoginPanel title={title} hint={hint} onSuccess={onSuccess} />;
  }
  return <>{children(reloadKey)}</>;
}

/**
 * Soʻrov xatosini foydalanuvchi tiliga oʻgiradi.
 *
 * 401 alohida ishlanadi: bu «xato» emas, sessiya tugagan. Foydalanuvchiga
 * qizil xato koʻrsatish oʻrniga qayta kirish taklif qilinadi.
 */
export function messageOf(error: unknown): string {
  if (error instanceof SessionError && error.status === 401) {
    return "Sessiya muddati tugadi. Sahifani yangilab qaytadan kiring.";
  }
  return error instanceof Error ? error.message : "Nomaʼlum xato";
}

export function LoginPanel({
  title,
  hint,
  onSuccess,
}: {
  title: string;
  hint?: string;
  onSuccess: () => void;
}) {
  const [userLogin, setUserLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(userLogin.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirib boʻlmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-md">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Bu boʻlim bazadan oʻqiydi — hisobingiz bilan kiring.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Login</span>
          {/* Login foydalanuvchi tanlamaydi — tizim `familiya.ism`
              shaklida yasaydi (backend `core/naming.py`). */}
          <input
            value={userLogin}
            onChange={(e) => setUserLogin(e.target.value)}
            autoComplete="username"
            placeholder="qodirov.bahodir"
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Parol</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !userLogin.trim() || !password}
          className="focus-ring rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Kirilmoqda…" : "Kirish"}
        </button>
      </form>

      {hint && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-foreground-muted">{hint}</p>
      )}
    </Card>
  );
}
