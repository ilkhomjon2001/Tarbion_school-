"use client";

import { useEffect, useState } from "react";

import { fetchChildren, type Child } from "@/lib/parent/api";

const KEY = "tarbion.parent.child";

/**
 * Vasiyning farzandlari va tanlangani (OTA-02).
 *
 * Roʻyxat BACKENDDAN keladi — `guardians` jadvalidagi bogʻlanish
 * boʻyicha. Avval mockdagi ikkita bola qattiq yozilgandi.
 *
 * Tanlov `localStorage` da saqlanadi — ota-ona har sahifada qaytadan
 * tanlab oʻtirmasin. Bu shunchaki qulaylik: saqlangan id serverda
 * qaytadan tekshiriladi, begona bolaning id sini qoʻlda yozib qoʻyish
 * hech nima bermaydi (X-1).
 */
export function useChildren(): {
  children: Child[];
  child: Child | null;
  select: (id: string) => void;
  loading: boolean;
  error: string | null;
} {
  const [children, setChildren] = useState<Child[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetchChildren()
      .then((rows) => {
        if (!alive) return;
        setChildren(rows);

        let saved: string | null = null;
        try {
          saved = window.localStorage.getItem(KEY);
        } catch {
          /* xotira bloklangan */
        }
        const bor = saved && rows.some((c) => c.id === saved);
        setId(bor ? saved : (rows[0]?.id ?? null));
      })
      .catch(() => {
        if (alive) setError("Farzandlar roʻyxatini yuklab boʻlmadi.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  function select(next: string) {
    setId(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* jimgina oʻtkazib yuboriladi */
    }
  }

  const child = children.find((c) => c.id === id) ?? children[0] ?? null;
  return { children, child, select, loading, error };
}


/**
 * Eski, sodda shakl: `[child, select]`.
 *
 * Hali backendga ulanmagan sahifalar (toʻlov, tarbiya, oshxona…) shuni
 * ishlatadi va oʻzgarmasdan qoladi. Yuklanayotganda boʻsh kartochka
 * qaytadi — sahifa yiqilmasin.
 *
 * Yangi kod `useChildren()` ni ishlatsin: unda `loading` va `error`
 * holatlari bor.
 */
const BOSH_CHILD: Child = {
  id: "",
  fullName: "",
  shortName: "",
  className: "",
  relation: "",
  isArchived: false,
};

export function useChild(): [Child, (id: string) => void] {
  const { child, select } = useChildren();
  return [child ?? BOSH_CHILD, select];
}
