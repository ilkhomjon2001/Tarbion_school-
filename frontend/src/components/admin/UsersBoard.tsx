"use client";

/**
 * Foydalanuvchilar boʻlimi — faqat super administrator (T-005).
 *
 * Ikki yorliq:
 *   «Foydalanuvchilar» — hisoblar roʻyxati va amallar (parol, arxiv);
 *   «Huquqlar»         — boʻlim va huquqlarni boshqarish (AccessCenter).
 *
 * Ilgari AccessCenter /admin/sozlamalar ichida yashiringan edi — endi
 * alohida boʻlim. Bu ekran boshqaruv oynasi, HIMOYA EMAS: har bir amalni
 * server qaytadan tekshiradi (CLAUDE.md 7-qoida).
 *
 * XAVFSIZLIK: yangi parol faqat modal ichida BIR MARTA koʻrsatiladi.
 * U toast, console yoki log'ga chiqarilmaydi (X-10).
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { AccessCenter } from "@/components/admin/AccessCenter";
import { messageOf } from "@/components/shared/LiveSession";
import { Badge } from "@/components/ui/Badge";
import { fetchUsers, useAccess, type UserAccessOut } from "@/lib/access-api";
import {
  archiveUser,
  resetPassword,
  unarchiveUser,
  type PasswordResetOut,
} from "@/lib/admin/users-api";

const ROLE_LABELS: Record<string, string> = {
  student: "Oʻquvchi",
  parent: "Ota-ona",
  teacher: "Ustoz",
  homeroom_teacher: "Sinf rahbari",
  academic: "Oʻquv boʻlimi",
  admin: "Administrator",
  director: "Rahbariyat",
  superadmin: "Super administrator",
};

// Tugma uslublari — nishonlar telefonda 44px, desktopda 36px.
const btnBase =
  "focus-ring inline-flex h-11 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-9";
const btnPrimary = `${btnBase} bg-brand font-semibold text-brand-foreground hover:bg-brand-dark active:bg-brand-dark`;
const btnSecondary = `${btnBase} border border-border bg-surface text-foreground hover:bg-surface-muted active:bg-surface-muted`;
const btnDanger = `${btnBase} bg-danger font-semibold text-brand-foreground hover:bg-danger/90 active:bg-danger/90`;

type Tab = "users" | "access";

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Foydalanuvchilar" },
  { id: "access", label: "Huquqlar" },
];

export function UsersBoard() {
  const [tab, setTab] = useState<Tab>("users");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Yorliqlar orasida ← → bilan yurish (roving tabindex). */
  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      (index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Foydalanuvchilar</h1>
        <p className="text-sm text-foreground-muted">
          Hisoblar, parollar va kirish huquqlari — faqat super administrator
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Foydalanuvchilar boʻlimlari"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={`focus-ring -mb-px min-h-11 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:min-h-9 ${
              tab === t.id
                ? "border-brand text-brand-dark"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersList />}
      {tab === "access" && <AccessCenter />}

      <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
        Boʻlimni yashirish — qulaylik, himoya emas. Haqiqiy tekshiruv serverda:
        yashiringan boʻlim manzilini qoʻlda yozgan odam ham maʼlumotni ololmaydi.
      </p>
    </div>
  );
}

// ─────────────────────── Foydalanuvchilar roʻyxati ───────────────────────

type ModalState =
  | { kind: "password"; user: UserAccessOut }
  | { kind: "archive"; user: UserAccessOut }
  | { kind: "unarchive"; user: UserAccessOut }
  | null;

function UsersList() {
  const { user: me } = useAccess();
  const [users, setUsers] = useState<UserAccessOut[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      setUsers(await fetchUsers(q || undefined));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Qidiruvda har harfda soʻrov yubormaslik uchun kechikish.
    const t = setTimeout(() => void load(query), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  /** Amal muvaffaqiyatli boʻlganda roʻyxatdagi qatorni yangilaydi. */
  function replace(next: UserAccessOut) {
    setUsers((prev) =>
      prev.map((u) => (u.user_id === next.user_id ? next : u)),
    );
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Yuklanmoqda">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Login yoki ism boʻyicha qidirish"
          aria-label="Foydalanuvchi qidirish"
          className="h-11 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 sm:text-sm"
        />
        <p className="text-sm text-foreground-muted">
          <span className="num font-medium text-foreground">{users.length}</span>{" "}
          foydalanuvchi
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <p className="font-medium">Foydalanuvchi topilmadi</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <UserRow
              key={u.user_id}
              user={u}
              isSelf={me?.id === u.user_id}
              onAction={(kind) => setModal({ kind, user: u })}
            />
          ))}
        </ul>
      )}

      {modal?.kind === "password" && (
        <PasswordModal user={modal.user} onClose={() => setModal(null)} />
      )}
      {(modal?.kind === "archive" || modal?.kind === "unarchive") && (
        <ArchiveModal
          user={modal.user}
          mode={modal.kind}
          onClose={() => setModal(null)}
          onDone={(next) => {
            // Javob toʻliq boʻlmasa ham qator buzilmasin.
            replace({ ...modal.user, ...next });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  onAction,
}: {
  user: UserAccessOut;
  isSelf: boolean;
  onAction: (kind: "password" | "archive" | "unarchive") => void;
}) {
  const isSuperadmin = user.roles.includes("superadmin");

  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{user.full_name}</span>
          <span className="block truncate text-xs text-foreground-muted">
            {user.login}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5">
          {user.roles.map((r) => (
            <span
              key={r}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                r === "superadmin"
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface-muted text-foreground-muted"
              }`}
            >
              {ROLE_LABELS[r] ?? r}
            </span>
          ))}
          {user.is_active ? (
            <Badge tone="success">Faol</Badge>
          ) : (
            <Badge tone="neutral">Arxivda</Badge>
          )}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onAction("password")}
          className={btnSecondary}
        >
          Parol almashtirish
        </button>

        {isSelf ? (
          <span className="text-xs text-foreground-muted">
            Bu — sizning hisobingiz, uni arxivlab boʻlmaydi.
          </span>
        ) : isSuperadmin ? (
          <>
            <button
              type="button"
              disabled
              aria-describedby={`sa-note-${user.user_id}`}
              className={btnSecondary}
            >
              Arxivlash
            </button>
            <span
              id={`sa-note-${user.user_id}`}
              className="text-xs text-foreground-muted"
            >
              Super administrator arxivlanmaydi — tizim sozlovchisiz qolardi.
            </span>
          </>
        ) : user.is_active ? (
          <button
            type="button"
            onClick={() => onAction("archive")}
            className={`${btnBase} border border-danger/40 bg-surface text-danger hover:bg-danger-tint active:bg-danger-tint`}
          >
            Arxivlash
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAction("unarchive")}
            className={btnSecondary}
          >
            Arxivdan qaytarish
          </button>
        )}
      </div>
    </li>
  );
}

// ─────────────────────────────── Modallar ───────────────────────────────

/**
 * Modal qobigʻi: telefonda pastdan chiqadigan varaq (bottom sheet),
 * desktopda markaziy oyna. Esc va fon yopadi, fokus ichida aylanadi
 * va yopilganda ochgan tugmaga qaytadi (WCAG dialog namunasi).
 */
function ModalShell({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => returnTo.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Fokus tuzogʻi — Tab modal ichida aylanadi.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative z-10 max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl outline-none sm:max-w-md sm:rounded-2xl sm:p-5 sm:pb-5"
      >
        {children}
      </div>
    </div>
  );
}

/** Arxivlash / arxivdan qaytarish — majburiy tasdiqlash oynasi. */
function ArchiveModal({
  user,
  mode,
  onClose,
  onDone,
}: {
  user: UserAccessOut;
  mode: "archive" | "unarchive";
  onClose: () => void;
  onDone: (next: UserAccessOut) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const arxivga = mode === "archive";

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = arxivga
        ? await archiveUser(user.user_id)
        : await unarchiveUser(user.user_id);
      onDone(next);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  return (
    <ModalShell
      label={arxivga ? "Arxivlashni tasdiqlash" : "Arxivdan qaytarishni tasdiqlash"}
      onClose={onClose}
    >
      <h2 className="text-base font-semibold text-foreground">
        {arxivga ? "Arxivga oʻtkazish" : "Arxivdan qaytarish"}
      </h2>
      <p className="mt-2 text-sm text-foreground">
        {arxivga ? (
          <>
            <strong>{user.full_name}</strong> ({user.login}) arxivga
            oʻtkazilsinmi? U tizimga kira olmaydi, maʼlumotlari saqlanadi.
          </>
        ) : (
          <>
            <strong>{user.full_name}</strong> ({user.login}) arxivdan
            qaytarilsinmi? U yana tizimga kira oladi.
          </>
        )}
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
          Bekor qilish
        </button>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className={arxivga ? btnDanger : btnPrimary}
        >
          {busy
            ? "Bajarilmoqda…"
            : arxivga
              ? "Arxivga oʻtkazish"
              : "Arxivdan qaytarish"}
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * Parol almashtirish. Ikki rejim: tizim oʻzi yaratadi (standart) yoki
 * qoʻlda kiritiladi (kamida 8 belgi). Natijadagi parol BIR MARTA
 * koʻrsatiladi — modal yopilgach uni qaytarib boʻlmaydi.
 */
function PasswordModal({
  user,
  onClose,
}: {
  user: UserAccessOut;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PasswordResetOut | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const inputId = useId();
  const hintId = useId();

  const manualTooShort = mode === "manual" && value.length < 8;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || manualTooShort) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await resetPassword(user.user_id, mode === "auto" ? null : value));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!done) return;
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(done.new_password);
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <ModalShell label="Parol almashtirish" onClose={onClose}>
      <h2 className="text-base font-semibold text-foreground">
        Parol almashtirish
      </h2>
      <p className="mt-1 text-sm text-foreground-muted">
        {user.full_name} ({user.login})
      </p>

      {done === null ? (
        <form onSubmit={submit} className="mt-3">
          <fieldset>
            <legend className="sr-only">Parol qanday yaratilsin</legend>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  ["auto", "Tizim oʻzi yaratsin", "Kuchli parol avtomatik tuziladi"],
                  ["manual", "Qoʻlda kiritaman", "Kamida 8 belgi"],
                ] as const
              ).map(([id, label, hint]) => (
                <label
                  key={id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    mode === id
                      ? "border-brand/50 bg-brand-tint/25"
                      : "border-border hover:bg-surface-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="password-mode"
                    checked={mode === id}
                    onChange={() => setMode(id)}
                    className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-foreground-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode === "manual" && (
            <div className="mt-3">
              <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-foreground">
                Yangi parol
              </label>
              <div className="flex gap-2">
                <input
                  id={inputId}
                  type={show ? "text" : "password"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  aria-describedby={hintId}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-pressed={show}
                  className={btnSecondary}
                >
                  {show ? "Yashirish" : "Koʻrsatish"}
                </button>
              </div>
              <p id={hintId} className="mt-1 text-xs text-foreground-muted">
                Kamida 8 belgi.{" "}
                {value.length > 0 && manualTooShort
                  ? `Hozircha ${value.length} ta.`
                  : ""}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
              Bekor qilish
            </button>
            <button type="submit" disabled={busy || manualTooShort} className={btnPrimary}>
              {busy ? "Almashtirilmoqda…" : "Parolni almashtirish"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3" role="status">
          <p className="text-sm text-foreground">
            <strong>{done.login}</strong> uchun yangi parol:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="num min-w-0 flex-1 select-all break-all rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-base font-semibold tracking-wide">
              {done.new_password}
            </code>
            <button type="button" onClick={() => void copy()} className={btnSecondary}>
              {copied ? "Nusxalandi" : "Nusxalash"}
            </button>
          </div>
          {copyError && (
            <p role="alert" className="mt-1.5 text-xs text-danger">
              Nusxalab boʻlmadi — parolni qoʻlda koʻchiring.
            </p>
          )}
          <p className="mt-3 rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
            Bu parol boshqa koʻrsatilmaydi — hoziroq foydalanuvchiga yetkazing.
          </p>
          <div className="mt-4 flex sm:justify-end">
            <button type="button" onClick={onClose} className={`${btnPrimary} w-full sm:w-auto`}>
              Yopish
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
