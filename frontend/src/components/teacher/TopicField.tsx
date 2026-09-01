"use client";

import { useEffect, useId, useRef, useState } from "react";

import { suggestTopics, warmTopics, type TopicSuggestion } from "@/lib/teacher/topics";

/**
 * Mavzu maydoni — bazadan bashorat bilan.
 *
 * Ustoz mavzuni qoʻlda toʻliq yozmasin: 2 harfdan keyin metodik bazadan
 * mos mavzular taklif qilinadi, mos kelmasa oʻz matnini yozaveradi.
 * Klaviatura bilan boshqariladi (↓ ↑ Enter Esc) — sichqoncha shart emas.
 */
export function TopicField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const listId = `${inputId}-list`;

  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    warmTopics();
  }, []);

  // Yozilgandan keyin qidiruv — har harfda emas, 180 ms tinchlikdan keyin.
  useEffect(() => {
    if (disabled) return;
    const handle = setTimeout(() => {
      suggestTopics(value).then((list) => {
        setSuggestions(list);
        setActive(-1);
      });
    }, 180);
    return () => clearTimeout(handle);
  }, [value, disabled]);

  // Tashqariga bosilsa yopiladi.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(item: TopicSuggestion) {
    onChange(item.title);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && !disabled && suggestions.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        Oʻtilgan mavzu
      </label>

      <input
        id={inputId}
        type="text"
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Mavzu nomini yozing — bazadan taklif qilinadi…"
        className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:bg-surface-muted/40"
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Taklif qilingan mavzular"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.title}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
                className={`w-full px-3 py-2 text-left transition-colors ${
                  i === active ? "bg-brand-tint" : "hover:bg-surface-muted/60"
                }`}
              >
                <span className="block text-sm">{s.title}</span>
                <span className="mt-0.5 block text-xs text-foreground-muted">
                  {s.year} · {s.className} · {s.term} · {s.index + 1}-dars
                  {s.model ? ` · ${s.model}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1.5 text-xs text-foreground-muted">
        Davomat bilan birga sinf jurnaliga yoziladi.
      </p>
    </div>
  );
}
