"use client";

import { useState } from "react";

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "mismatch">("idle");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (newPassword.length < 8) {
          setStatus("mismatch");
          return;
        }
        if (newPassword !== confirmPassword) {
          setStatus("mismatch");
          return;
        }
        setStatus("success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-foreground">
          Joriy parol
        </label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setStatus("idle");
          }}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
        />
      </div>
      <div>
        <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-foreground">
          Yangi parol
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setStatus("idle");
          }}
          placeholder="Kamida 8 ta belgi"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-foreground">
          Yangi parolni takrorlang
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setStatus("idle");
          }}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!currentPassword || !newPassword || !confirmPassword}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          Yangilash
        </button>
        {status === "success" ? <span className="text-sm text-success">Parol yangilandi</span> : null}
        {status === "mismatch" ? (
          <span className="text-sm text-danger">
            Yangi parollar mos emas yoki juda qisqa (kamida 8 belgi)
          </span>
        ) : null}
      </div>
    </form>
  );
}
