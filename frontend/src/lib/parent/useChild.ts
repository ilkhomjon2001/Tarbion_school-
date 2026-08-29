"use client";

import { useEffect, useState } from "react";

import { CHILDREN, type Child } from "@/lib/parent/data";

const KEY = "tarbion.parent.child";

/**
 * Tanlangan farzand (OTA-02).
 *
 * Tanlov saqlanadi — ota-ona har sahifada qaytadan tanlab oʻtirmasin.
 * Bitta farzandi boʻlsa almashtirgich koʻrsatilmaydi.
 */
export function useChild(): [Child, (id: string) => void] {
  const [id, setId] = useState(CHILDREN[0].id);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && CHILDREN.some((c) => c.id === saved)) setId(saved);
    } catch {
      /* xotira bloklangan — birinchi farzand qoladi */
    }
  }, []);

  function select(next: string) {
    setId(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* jimgina oʻtkazib yuboriladi */
    }
  }

  return [CHILDREN.find((c) => c.id === id) ?? CHILDREN[0], select];
}
