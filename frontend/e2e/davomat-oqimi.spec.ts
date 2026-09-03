import { expect, test, type Page } from "@playwright/test";

/**
 * 1-bosqichning kritik oqimi (T-023):
 *
 *     ustoz kiradi → davomat belgilaydi → ota-ona buni koʻradi
 *
 * Nega aynan shu: bu zanjir maktabning platformadan foydalanish
 * sababining oʻzi. Uzilsa qolgan hamma narsa maʼnosiz boʻlib qoladi,
 * va uzilishi mumkin boʻlgan joylar toʻrtta qatlamga tarqalgan —
 * autentifikatsiya, ustoz kabineti, `access.py`, ota-ona kabineti.
 * Bitta ham unit test bu zanjirni butunligicha tekshira olmaydi.
 *
 * Maʼlumot `backend/app/e2e_seed.py` dan: bitta sinf, bitta ustoz,
 * bitta oʻquvchi, bitta vasiy va BUGUNGI dars.
 */

const PAROL = process.env.E2E_PASSWORD ?? "";
const USTOZ = "e2e.ustoz";
const OTAONA = "e2e.otaona";
const OQUVCHI = "Sinovov Oʻquvchi";

// Bir xil holat ikki kabinetda boshqacha atalgan: ustoz jurnalida
// «Kelmadi» (`contracts.ts`), ota-ona kalendarida «Sababsiz». Ikkalasi
// ham `absent` — atayin, chunki ota-onaga sababning YOʻQLIGI muhim.
const USTOZ_HOLATI = "Kelmadi";
const OTAONA_HOLATI = "Sababsiz";

// Parolsiz ishga tushirilsa testlar OʻTIB KETADI, yiqilmaydi: E2E
// muhitsiz `pnpm e2e` chaqirilishi mumkin va uzun stek izidan koʻra
// aniq sabab yaxshiroq.
test.beforeEach(() => {
  test.skip(PAROL.length < 8, "E2E_PASSWORD yoʻq — `app.e2e_seed` bilan bir xil boʻlsin.");
});

async function kir(page: Page, login: string, home: string) {
  await page.goto("/login");
  await page.locator("#login").fill(login);
  await page.locator("#password").fill(PAROL);
  await page.getByRole("button", { name: "Tizimga kirish" }).click();

  // Parol almashtirishga yoʻnaltirilsa — seed `must_change_password`
  // ni oʻchirmagan. Bu jimgina «sahifa topilmadi» ga aylanmasin.
  await expect(page).not.toHaveURL(/\/parol$/, { timeout: 15_000 });
  await page.waitForURL(new RegExp(`${home}(/|$)`), { timeout: 20_000 });
}

test("ustoz davomat belgilaydi, ota-ona koʻradi", async ({ page }) => {
  // ── 1. Ustoz kiradi ──
  await kir(page, USTOZ, "/teacher");

  // ── 2. Bugungi davomat ekrani ──
  await page.goto("/teacher/davomat");
  await page.getByRole("button", { name: "Bugun" }).click();

  // Katakning yorligʻi: «F.I.Sh. · N-dars · holat». Boshlangʻich holat
  // «belgilanmagan» — seed dars yaratadi, lekin davomat yozmaydi.
  const katak = page.getByRole("button", { name: new RegExp(`^${OQUVCHI} · 1-dars`) });
  await expect(katak).toBeVisible({ timeout: 20_000 });

  // Katak aylanadi: boʻsh → Kelmadi → Sababli → Kechikdi → Keldi → boʻsh.
  // Test qayta ishga tushirilganda katak allaqachon boshqa holatda
  // boʻlishi mumkin, shuning uchun kerakligiga YETGUNCHA bosiladi
  // (aylana 5 qadam, 6 urinish kifoya).
  //
  // Har bosishdan keyin yorligʻning OʻZGARISHI kutiladi: React holatni
  // asinxron chizadi va darhol oʻqilsa eski qiymat qaytadi — natijada
  // sikl kerakli holatdan oʻtib ketardi (bir marta tushilgan).
  for (let i = 0; i < 6; i += 1) {
    const yorliq = (await katak.getAttribute("aria-label")) ?? "";
    if (yorliq.endsWith(USTOZ_HOLATI)) break;
    await katak.click();
    await expect(katak).not.toHaveAttribute("aria-label", yorliq, { timeout: 10_000 });
  }
  await expect(katak).toHaveAttribute("aria-label", new RegExp(`${USTOZ_HOLATI}$`));

  // ── 3. Saqlash ──
  // Shartsiz: `app.e2e_seed` har yugurishda davomatni tozalaydi, yaʼni
  // tugma HAR DOIM faol boʻlishi kerak. Ilgari bu `if` ichida edi va
  // test saqlash yoʻlini bosib oʻtmasdan «oʻtdi» deb chiqib ketardi.
  const saqla = page.getByRole("button", { name: /^Saqlash/ });
  await expect(saqla).toBeEnabled();
  await saqla.click();
  await expect(page.getByText(/^Saqlandi:/)).toBeVisible({ timeout: 20_000 });

  // Sahifa qayta yuklanganda ham «Sababsiz» qolsin — yaʼni SERVERGA
  // yozilgan, brauzer holatida emas.
  await page.reload();
  const qayta = page.getByRole("button", { name: new RegExp(`^${OQUVCHI} · 1-dars`) });
  await expect(qayta).toHaveAttribute("aria-label", new RegExp(`${USTOZ_HOLATI}$`), {
    timeout: 20_000,
  });

  // ── 4. Ota-ona oʻsha kelmaganlikni koʻradi ──
  // Chiqish: access token XOTIRADA (DECISIONS.md), refresh esa
  // httpOnly cookie'da. Cookie'ni tozalab yangi sahifaga oʻtish —
  // haqiqiy chiqishga teng.
  await page.context().clearCookies();

  await kir(page, OTAONA, "/ota-ona");
  await page.goto("/ota-ona/davomat");

  // Kalendar katagi: «3-sentabr: Sababsiz».
  const bugun = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date()) +
      "T00:00:00",
  );
  const kunKatagi = page.getByRole("button", {
    name: new RegExp(`^${bugun.getDate()}-\\S+: ${OTAONA_HOLATI}$`),
  });
  await expect(kunKatagi).toBeVisible({ timeout: 20_000 });
});

test("ota-ona ustoz boʻlimiga kira olmaydi", async ({ page }) => {
  // X-2 ning brauzerdagi tasdigʻi: rol tekshiruvi serverda, lekin
  // foydalanuvchi manzilni qoʻlda tersa ham ustoz ekrani ochilmasligi
  // kerak.
  await kir(page, OTAONA, "/ota-ona");
  await page.goto("/teacher/davomat");

  // `AuthGuard` oʻz kabinetiga qaytaradi.
  await page.waitForURL(/\/ota-ona(\/|$)/, { timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/teacher\/davomat$/);
});
