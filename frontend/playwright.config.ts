import { defineConfig, devices } from "@playwright/test";

/**
 * Kritik oqim testlari (T-023).
 *
 * Faqat BITTA oqim: login → ustoz davomat belgilaydi → ota-ona koʻradi.
 * Bu zanjir uzilsa maktab platformadan foydalana olmaydi, qolgan
 * hamma narsa esa `pytest` va tip tekshiruvi bilan qoplangan. E2E
 * sekin va moʻrt — shuning uchun u yerda faqat pastdagi qatlamlar
 * ushlay olmaydigan narsa turadi.
 *
 * Baza va serverlar bu yerda koʻtarilmaydi: `webServer` faqat frontendni
 * ishga tushiradi, backend esa tashqaridan beriladi (CI da workflow,
 * lokalda `uvicorn`). Sabab — backend uchun baza, migratsiya va
 * `app.e2e_seed` kerak; ularni Playwright ichiga yashirish nosozlikni
 * tushunib boʻlmaydigan qiladi.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Bitta oqim — parallel ishlatishdan foyda yoʻq, zarari bor: ikkala
  // test bir xil oʻquvchining davomatini yozardi.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    // Yiqilganda sabab koʻrinsin: birinchi urinishdagi iz ham saqlanadi.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Tashqi manzil berilgan boʻlsa (masalan sinov serveri) — oʻzimiz
  // hech narsa koʻtarmaymiz.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
