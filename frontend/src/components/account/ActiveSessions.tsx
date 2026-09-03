"use client";

/**
 * Faol qurilmalar (T-004, AUT-09 kengaytmasi).
 *
 * Loyiha egasining soʻrovi (2026-08-29): maktab va umumiy
 * kompyuterlarda hisob ochiq qolib ketmasin.
 *
 * Ekranning yagona savoli: «bu roʻyxatda menikimas qurilma bormi?»
 * Shuning uchun har qatorda qurilma nomi, IP va oxirgi faollik
 * turadi — brauzerning toʻliq `User-Agent` satri emas, u odamga
 * hech narsa aytmaydi.
 *
 * Joriy qurilma birinchi va uni chiqarib boʻlmaydi: buning uchun
 * «Chiqish» tugmasi bor va u sahifani ham toʻgʻri yopadi. Bu yerda
 * chiqarilsa, odam nima boʻlganini tushunmay qolardi.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { apiXato } from "@/lib/school/api";
import {
  fetchSessions,
  qurilmaNomi,
  revokeOtherSessions,
  revokeSession,
  type SessionOut,
} from "@/lib/sessions";

function sana(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActiveSessions() {
  const [qatorlar, setQatorlar] = useState<SessionOut[] | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [xabar, setXabar] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);

  const yukla = useCallback(async () => {
    setXato(null);
    try {
      setQatorlar(await fetchSessions());
    } catch (err) {
      setXato(apiXato(err, "Qurilmalar roʻyxatini yuklab boʻlmadi."));
      setQatorlar([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function chiqar(familyId: string) {
    setBand(familyId);
    setXato(null);
    setXabar(null);
    try {
      const n = await revokeSession(familyId);
      setXabar(n ? "Qurilma chiqarildi." : "Bu qurilma allaqachon chiqarilgan.");
      await yukla();
    } catch (err) {
      setXato(apiXato(err, "Chiqarib boʻlmadi."));
    } finally {
      setBand(null);
    }
  }

  async function hammasi() {
    setBand("all");
    setXato(null);
    setXabar(null);
    try {
      const n = await revokeOtherSessions();
      setXabar(
        n
          ? `${n} ta qurilma chiqarildi. Bu qurilma ochiq qoldi.`
          : "Boshqa qurilma yoʻq edi.",
      );
      await yukla();
    } catch (err) {
      setXato(apiXato(err, "Chiqarib boʻlmadi."));
    } finally {
      setBand(null);
    }
  }

  const boshqalar = (qatorlar ?? []).filter((q) => !q.current).length;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Faol qurilmalar</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Hisobingiz ochiq turgan qurilmalar. Tanimagan qurilmangizni koʻrsangiz —
          chiqaring va parolingizni almashtiring.
        </p>
      </div>

      {xato && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}
      {xabar && (
        <p className="rounded-lg bg-success-tint px-3 py-2 text-sm text-success">{xabar}</p>
      )}

      {qatorlar === null ? (
        <ListSkeleton count={2} />
      ) : (
        <ul className="flex flex-col gap-2">
          {qatorlar.map((q) => (
            <li
              key={q.family_id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {qurilmaNomi(q.user_agent)}
                  </span>
                  {q.current && <Badge tone="success">Shu qurilma</Badge>}
                  {!q.remember && <Badge tone="neutral">Vaqtinchalik</Badge>}
                </div>
                <p className="num mt-0.5 text-xs text-foreground-muted">
                  {q.ip_address ?? "IP nomaʼlum"} · {sana(q.issued_at)}
                </p>
              </div>

              {!q.current && (
                <button
                  type="button"
                  disabled={band !== null}
                  onClick={() => void chiqar(q.family_id)}
                  className="focus-ring h-9 shrink-0 rounded-lg border border-border px-3 text-sm font-medium text-danger hover:bg-danger-tint disabled:opacity-50"
                >
                  {band === q.family_id ? "Chiqarilmoqda…" : "Chiqarish"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {boshqalar > 0 && (
        <div>
          <button
            type="button"
            disabled={band !== null}
            onClick={() => void hammasi()}
            className="focus-ring h-10 rounded-lg border border-danger px-4 text-sm font-semibold text-danger hover:bg-danger-tint disabled:opacity-50"
          >
            {band === "all"
              ? "Chiqarilmoqda…"
              : `Boshqa qurilmalarning hammasidan chiqish (${boshqalar})`}
          </button>
          <p className="mt-1 text-xs text-foreground-muted">
            Shu qurilma ochiq qoladi — parolingizni almashtirishga ulgurasiz.
          </p>
        </div>
      )}
    </section>
  );
}
