"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  AUDIENCE_LABELS,
  fetchAnnouncements,
  type AnnouncementOut,
} from "@/lib/announcements/api";

/**
 * Eʼlonlar — BAZADAN (T-020).
 *
 * Roʻyxat serverda kesilgan: bu yerga faqat butun maktab eʼlonlari va
 * oʻquvchining oʻz sinfiga tegishlilari keladi. Filtr yoʻq — filtr
 * boʻlsa, u serverdagi kesimni takrorlagan boʻlardi.
 */
export default function AnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementOut[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAnnouncements()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <Header title="Eʼlonlar" />
      <div className="flex flex-col gap-2 p-4">
        {error ? (
          <EmptyState
            title="Eʼlonlarni olib boʻlmadi"
            description="Internet aloqasini tekshirib, sahifani yangilang."
          />
        ) : items === null ? (
          <ListSkeleton count={3} />
        ) : items.length === 0 ? (
          <EmptyState title="Hozircha eʼlon yoʻq" />
        ) : (
          items.map((a) => (
            <Card key={a.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Badge tone={a.audience === "school" ? "brand" : "info"}>
                  {a.class_names.length > 0
                    ? a.class_names.join(", ")
                    : AUDIENCE_LABELS[a.audience]}
                </Badge>
                <span className="num text-xs text-foreground-muted">
                  {new Date(a.created_at).toLocaleDateString("uz-UZ")}
                </span>
              </div>
              <h2 className="font-semibold text-foreground">
                {a.important && <span className="mr-1.5 text-danger">!</span>}
                {a.title}
              </h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground-muted">{a.body}</p>
              <p className="mt-2 text-xs text-foreground-muted">{a.author_name}</p>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
