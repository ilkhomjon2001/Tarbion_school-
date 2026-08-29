"use client";

import { useState } from "react";
import type { Student } from "@/lib/types";

export function ContactInfoForm({ student }: { student: Student }) {
  const [phone, setPhone] = useState(student.phone ?? "");
  const [email, setEmail] = useState(student.email ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label htmlFor="profile-phone" className="mb-1.5 block text-sm font-medium text-foreground">
          Telefon raqami
        </label>
        <input
          id="profile-phone"
          type="tel"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            setSaved(false);
          }}
          placeholder="+998 90 123 45 67"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
        />
      </div>
      <div>
        <label htmlFor="profile-email" className="mb-1.5 block text-sm font-medium text-foreground">
          Elektron pochta
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setSaved(false);
          }}
          placeholder="email@example.com"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Saqlash
        </button>
        {saved ? <span className="text-sm text-success">Saqlandi</span> : null}
      </div>
    </form>
  );
}
