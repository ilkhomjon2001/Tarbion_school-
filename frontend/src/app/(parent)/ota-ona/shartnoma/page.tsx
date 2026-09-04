"use client";

/**
 * Shartnoma (ADM-11) — ota-ona kabinetida.
 *
 * Hujjat MATNI shu yerda, qiymatlari serverdan: oʻquvchi, vasiy,
 * maktab rekvizitlari va AMALDAGI oylik summa. Shuning uchun summa
 * oʻzgarsa hujjat ham oʻzi yangilanadi — qogʻozdagi nusxa esa
 * eskiligicha qoladi va shuning uchun sahifada shu haqda ogohlantirish
 * bor.
 *
 * PDF kutubxonasi ATAYLAB ishlatilmadi: brauzerning oʻz «chop etish»
 * oynasi PDF ga saqlay oladi va u har qurilmada ishlaydi. Yangi
 * bogʻliqlik qoʻshishdan koʻra shu yengilroq.
 */

import { useEffect, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { formatSom } from "@/lib/format";
import { useChild } from "@/lib/parent/useChild";
import { apiXato, fetchContract, type ContractOut } from "@/lib/school/api";

const RELATION_LABELS: Record<string, string> = {
  father: "otasi",
  mother: "onasi",
  guardian: "vasiysi",
};

export default function ParentContractPage() {
  const [child, selectChild] = useChild();
  const [data, setData] = useState<ContractOut | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    if (!child.id) return;
    let alive = true;
    setData(null);
    setXato(null);
    fetchContract(child.id)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setXato(apiXato(e, "Shartnomani olib boʻlmadi.")));
    return () => {
      alive = false;
    };
  }, [child.id]);

  return (
    <ParentShell title="Shartnoma" child={child} onChildChange={selectChild}>
      <div className="flex flex-col gap-4 p-4">
        {/* Chop etish tugmasi hujjatning oʻzida chiqmasin. */}
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-sm text-foreground-muted">
            Imzolangan qogʻoz nusxa asl hisoblanadi. Bu yerda shartnoma shartlari va
            sizning amaldagi summangiz koʻrsatilgan.
          </p>
          <button
            type="button"
            disabled={data === null}
            onClick={() => window.print()}
            className="focus-ring inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            Chop etish / PDF
          </button>
        </div>

        {xato !== null ? (
          <ErrorState />
        ) : data === null ? (
          <ListSkeleton count={5} />
        ) : (
          <ContractDocument d={data} />
        )}
      </div>
    </ParentShell>
  );
}

function ContractDocument({ d }: { d: ContractOut }) {
  const asosiy = d.guardians[0] ?? null;
  const yillik = Math.round((d.monthly_fee * (100 - d.prepay_year_percent)) / 100);
  const yarim = Math.round((d.monthly_fee * (100 - d.prepay_half_year_percent)) / 100);

  return (
    // `print-doc` — globals.css dagi chop etish qoidasi: bosilganda
    // faqat shu blok koʻrinadi, qolgan interfeys yashiriladi.
    <article className="print-doc rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-foreground md:p-6">
      <header className="mb-5 text-center">
        <h1 className="text-base font-bold uppercase leading-snug">
          Oʻquvchini maktabga qabul qilish va taʼlim xizmatlarini koʻrsatish
          toʻgʻrisida shartnoma
        </h1>
        <p className="mt-2 text-foreground-muted">
          {d.school_name}
          {d.school_address && ` · ${d.school_address}`}
        </p>
      </header>

      {/* Amaldagi holat — hujjatning eng koʻp qaraladigan qismi, shuning
          uchun tepada va ajratilgan. */}
      <section className="mb-5 rounded-lg bg-surface-muted p-3">
        <Qator nom="Oʻquvchi" qiymat={d.student_name} kuchli />
        <Qator nom="Sinf" qiymat={d.class_name ?? "—"} />
        <Qator nom="Tugʻilgan sana" qiymat={d.birth_date ?? "—"} />
        {asosiy && (
          <Qator
            nom="Ota-ona / qonuniy vakil"
            qiymat={`${asosiy.full_name} (${RELATION_LABELS[asosiy.relation] ?? asosiy.relation})`}
          />
        )}
        {asosiy?.phone && <Qator nom="Telefon" qiymat={asosiy.phone} />}
        {asosiy?.address && <Qator nom="Manzil" qiymat={asosiy.address} />}
        <Qator nom="Oylik toʻlov" qiymat={formatSom(d.monthly_fee)} kuchli />
        {!d.has_contract && (
          <p className="mt-2 rounded bg-warning-tint px-2.5 py-1.5 text-xs text-foreground">
            Shartnoma tizimda hali ochilmagan — summa standart tarifdan
            koʻrsatilyapti. Aniqlashtirish uchun maktabga murojaat qiling.
          </p>
        )}
      </section>

      <Band nomer="1" sarlavha="Shartnoma predmeti">
        <p>
          1.1. Maktab Ota-onaning arizasiga koʻra, voyaga yetmagan oʻquvchi{" "}
          <strong>{d.student_name}</strong> ni Maktabning{" "}
          <strong>{d.class_name ?? "___"}</strong> sinfiga qabul qiladi va davlat
          taʼlim standartlari hamda Maktab dasturiga muvofiq unga umumiy oʻrta
          taʼlim xizmatlarini koʻrsatish majburiyatini oladi.
        </p>
        <p>
          1.2. Ota-ona oʻqish muddati davomida belgilangan taʼlim toʻlovlarini oʻz
          vaqtida amalga oshirish va Maktabning ichki tartib-qoidalariga rioya
          qilish majburiyatini oladi.
        </p>
      </Band>

      <Band nomer="2" sarlavha="Tomonlarning huquq va majburiyatlari">
        <h4 className="mt-2 font-semibold">2.1. Maktabning majburiyatlari</h4>
        <Royxat
          bandlar={[
            "Taʼlim sifati: oʻquv jarayonini «Taʼlim toʻgʻrisida»gi qonun va davlat taʼlim standartlariga muvofiq tashkil etish.",
            "Xavfsizlik: oʻquvchining Maktab hududida boʻlgan vaqtida hayoti, sogʻligʻi va xavfsizligini taʼminlash.",
            "Sharoitlar: oʻquv xonalarini zamonaviy texnik jihozlar va uslubiy materiallar bilan taʼminlash.",
            "Axborot berish: ota-onani oʻquvchining oʻzlashtirishi, xulq-atvori va darslarga qatnashishi haqida muntazam xabardor qilib borish.",
          ]}
        />
        <h4 className="mt-3 font-semibold">2.2. Ota-onaning majburiyatlari</h4>
        <Royxat
          bandlar={[
            "Toʻlovlarni belgilangan muddatlarda kechiktirmasdan amalga oshirish.",
            "Oʻquvchining darslarga oʻz vaqtida, sababsiz qoldirmasdan kelishini, maktab kiyim shakli va oʻquv qurollari bilan toʻliq taʼminlanishini va ichki intizom qoidalariga rioya qilishini taʼminlash.",
            "Ota-onalar majlislarida ishtirok etish, farzandining taʼlim-tarbiyasi masalalarida pedagoglar bilan hamkorlik qilish.",
            "Oʻquvchi tomonidan Maktab mulkiga yetkazilgan moddiy zararni qoplab berish.",
          ]}
        />
        <h4 className="mt-3 font-semibold">2.3. Maktabning huquqlari</h4>
        <Royxat
          bandlar={[
            "Oʻquv jarayonini, dars jadvalini, baholash tizimini va qoʻshimcha toʻgaraklar dasturini mustaqil belgilash.",
            "Ota-ona shartnoma shartlarini (ayniqsa toʻlov muddatlarini) muntazam buzganda yoki oʻquvchi maktab qoidalariga rioya qilmaganda, shartnomani bir tomonlama bekor qilish va oʻquvchini Maktab safidan chetlashtirish.",
            "Oʻquvchilarning rasm va videolaridan maktabning marketing reklamasi masalalarida foydalanish.",
          ]}
        />
        <h4 className="mt-3 font-semibold">2.4. Ota-onaning huquqlari</h4>
        <Royxat
          bandlar={[
            "Maktabdan davlat standartlariga mos yuqori sifatli taʼlim va tarbiya berishni talab qilish.",
            "Farzandining oʻzlashtirish koʻrsatkichlari, psixologik holati va maktabdagi faoliyati haqida toʻliq maʼlumot olish.",
          ]}
        />
      </Band>

      <Band nomer="3" sarlavha="Toʻlovlar va hisob-kitob tartibi">
        <p>
          3.1. Bir oʻquv oyi uchun taʼlim toʻlovi summasi{" "}
          <strong>{formatSom(d.monthly_fee)}</strong>ni tashkil etadi. Shartnoma
          tuzish vaqtida oldindan <strong>{formatSom(d.advance)}</strong> miqdorida
          toʻlov qilinishi shart etib belgilanadi.
        </p>
        <p>3.2. Toʻlov quyidagi tartibda amalga oshiriladi:</p>
        <Royxat
          bandlar={[
            `Variant A: har oyning ${d.due_day}-sanasidan kechiktirmasdan oylik toʻlovni ${formatSom(d.monthly_fee)} miqdorida toʻlash.`,
            `Variant B: toʻlovni butun yil uchun oldindan toʻlagan ota-ona yoki vasiylarga ${d.prepay_year_percent}% chegirma beriladi — oyiga ${formatSom(yillik)}.`,
            `Variant S: toʻlovni oldindan 6 (olti) oylik qilib toʻlagan ota-ona yoki vasiylarga ${d.prepay_half_year_percent}% chegirma beriladi — oyiga ${formatSom(yarim)}.`,
          ]}
        />
        <p>
          3.3. Toʻlovlar naqd pul, bank plastik kartochkalari yoki Maktabning
          hisob-raqamiga pul oʻtkazish yoʻli bilan amalga oshiriladi.
        </p>
        <p>
          3.4. Oʻquvchi darslarni sababsiz qoldirgan davr uchun toʻlov qaytarilmaydi
          va qayta hisob-kitob qilinmaydi. Kasallik tufayli (tibbiy maʼlumotnoma
          taqdim etilganda) uzoq muddat dars qoldirilgan holatlar maktab rahbariyati
          bilan kelishilgan holda koʻrib chiqilishi mumkin.
        </p>
      </Band>

      <Band nomer="4" sarlavha="Shartnomani bekor qilish tartibi">
        <p>4.1. Shartnoma tomonlarning oʻzaro kelishuviga muvofiq bekor qilinishi mumkin.</p>
        <p>
          4.2. Ota-ona shartnomani bekor qilmoqchi boʻlsa, bu haqda Maktab
          rahbariyatini kamida <strong>30 kun oldin</strong> yozma ravishda (ariza
          orqali) ogohlantirishi shart.
        </p>
        <p>4.3. Maktab quyidagi holatlarda shartnomani bir tomonlama bekor qilish huquqiga ega:</p>
        <Royxat
          bandlar={[
            "toʻlov belgilangan muddatdan 3 kundan ortiq kechiktirilganda;",
            "oʻquvchi yoki Ota-ona Maktabning ichki tartib-qoidalari va Ustavini qoʻpol ravishda buzganda.",
          ]}
        />
      </Band>

      <Band nomer="5" sarlavha="Rekvizitlar">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-semibold">«Ijrochi»</p>
            <p>{d.school_name}</p>
            {d.school_address && <p>{d.school_address}</p>}
            {d.tax_id && <p className="num">STIR: {d.tax_id}</p>}
            {d.bank_account && <p className="num">h/r: {d.bank_account}</p>}
            {d.bank_code && <p className="num">MFO: {d.bank_code}</p>}
            {d.bank_name && <p>{d.bank_name}</p>}
            {d.school_phone && <p className="num">Tel.: {d.school_phone}</p>}
            {d.director_name && <p className="mt-1">Rahbar: {d.director_name}</p>}
          </div>
          <div>
            <p className="font-semibold">«Ota-ona / qonuniy vakil»</p>
            {asosiy ? (
              <>
                <p>{asosiy.full_name}</p>
                {asosiy.address && <p>{asosiy.address}</p>}
                {asosiy.phone && <p className="num">Tel.: {asosiy.phone}</p>}
              </>
            ) : (
              <p className="text-foreground-muted">Vasiy biriktirilmagan.</p>
            )}
            <p className="mt-1">Oʻquvchi: {d.student_name}</p>
          </div>
        </div>
      </Band>

      <p className="mt-5 border-t border-border pt-3 text-xs text-foreground-muted">
        Shartnoma bir xil yuridik kuchga ega boʻlgan 2 (ikki) nusxada tuzilgan va
        tomonlarning har biriga bittadan nusxa berilgan. Bu sahifa qulaylik uchun —
        yuridik kuchga ega nusxa imzolangan qogʻoz hujjatdir.
      </p>
    </article>
  );
}

function Band({
  nomer,
  sarlavha,
  children,
}: {
  nomer: string;
  sarlavha: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h3 className="mb-1.5 font-bold">
        {nomer}. {sarlavha.toUpperCase()}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function Royxat({ bandlar }: { bandlar: string[] }) {
  return (
    <ul className="ml-4 list-disc space-y-1">
      {bandlar.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}

function Qator({
  nom,
  qiymat,
  kuchli,
}: {
  nom: string;
  qiymat: string;
  kuchli?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-1 last:border-0">
      <span className="text-foreground-muted">{nom}</span>
      <span className={kuchli ? "font-semibold" : ""}>{qiymat}</span>
    </div>
  );
}
