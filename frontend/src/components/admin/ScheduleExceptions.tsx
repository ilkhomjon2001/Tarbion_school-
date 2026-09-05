"use client";

/**
 * Jadval istisnolari (ADM-10).
 *
 * Istisno KONKRET darsga tegishli, jadval yozuviga emas: «5-sentabr
 * 3-para» oʻzgaradi, dushanbaning hamma 3-parasi emas. Shuning uchun
 * ekran avval SANA va SINF ni soʻraydi, keyin oʻsha kunning
 * paralarini koʻrsatadi.
 *
 * Uchta amal (TZ ADM-10):
 *   · dars bekor qilinishi
 *   · ustozni vaqtincha almashtirish
 *   · darsni boshqa paraga koʻchirish
 *
 * Bekor qilingan dars OʻCHIRILMAYDI — u jadvalda «bekor qilingan»
 * boʻlib turadi, shunda oila «dars nega yoʻq edi?» degan savolga
 * javob topadi. Davomat va baho bunday darsga olinmaydi (serverda).
 */

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CalendarIcon } from "@/components/ui/icons";
import {
  ScheduleExceptionRow,
  inputClass,
} from "@/components/admin/ScheduleExceptionRow";
import {
  fetchScheduleExceptions,
  type LessonExceptionOut,
} from "@/lib/academic/api";
import { messageOf } from "@/components/shared/LiveSession";
import { useSchoolDirectory } from "@/lib/school/api";
import { fetchClassDay } from "@/lib/teacher/day-api";
import type { DayLessonOut } from "@/lib/api/types.gen";

function bugunIso(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function keyinIso(kun: string, days: number): string {
  const d = new Date(`${kun}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ScheduleExceptions() {
  const dir = useSchoolDirectory();
  const [kun, setKun] = useState(bugunIso);
  const [classId, setClassId] = useState("");
  const [darslar, setDarslar] = useState<DayLessonOut[] | null>(null);
  const [istisnolar, setIstisnolar] = useState<LessonExceptionOut[]>([]);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    if (!classId && dir.classes.length > 0) setClassId(dir.classes[0].id);
  }, [dir.classes, classId]);

  const yukla = useCallback(async () => {
    if (!classId) return;
    setXato(null);
    try {
      const [kunlik, ist] = await Promise.all([
        fetchClassDay(classId, kun),
        // Istisnolar roʻyxati kengroq oraliqda — «shu haftada nima
        // oʻzgardi» savoli kunlik koʻrinishdan tez-tez soʻraladi.
        fetchScheduleExceptions(kun, keyinIso(kun, 7)),
      ]);
      setDarslar(kunlik.lessons);
      setIstisnolar(ist);
    } catch (err) {
      setXato(messageOf(err));
      setDarslar([]);
    }
  }, [classId, kun]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sana</span>
          <input
            type="date"
            value={kun}
            onChange={(e) => setKun(e.target.value)}
            className={inputClass}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf</span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={`${inputClass} min-w-[8rem]`}
          >
            {dir.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {xato && <ErrorState description={xato} />}

      {dir.loading || darslar === null ? (
        <ListSkeleton count={4} />
      ) : darslar.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="h-5 w-5" />}
          title="Bu kunda dars yoʻq"
          description="Dars jadvaldan generatsiya qilinadi. Kun taʼtil boʻlishi yoki darslar hali yaratilmagan boʻlishi mumkin."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {darslar.map((d) => (
            <ScheduleExceptionRow
              key={d.lesson_id}
              dars={d}
              staff={dir.staff}
              onChanged={() => void yukla()}
            />
          ))}
        </ul>
      )}

      {istisnolar.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Shu haftadagi istisnolar
          </h3>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="scroll-x">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-2.5">Sana</th>
                    <th className="px-3 py-2.5">Sinf · fan</th>
                    <th className="px-3 py-2.5">Ustoz</th>
                    <th className="px-3 py-2.5">Nima boʻldi</th>
                  </tr>
                </thead>
                <tbody>
                  {istisnolar.map((i) => (
                    <tr key={i.lesson_id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-muted">
                        {i.lesson_date} · {i.period}-para
                      </td>
                      <td className="px-3 py-2">
                        {i.class_name} · {i.subject_name}
                      </td>
                      <td className="px-3 py-2">{i.teacher_name}</td>
                      <td className="px-3 py-2">
                        {i.is_cancelled ? (
                          <span className="text-danger">
                            Bekor qilindi{i.cancel_reason ? ` — ${i.cancel_reason}` : ""}
                          </span>
                        ) : (
                          <span className="text-warning">
                            Ustoz almashtirildi
                            {i.exception_note ? ` — ${i.exception_note}` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
