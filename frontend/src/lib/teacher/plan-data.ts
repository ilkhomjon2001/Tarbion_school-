/**
 * Dars rejalari — Tarbion Dars Rejalar Bazasidan olingan
 * (http://169.58.130.201:8081, TREE_DATA + LESSON_CONTENT).
 *
 * Bazadagi tuzilma: yil -> sinf -> chorak -> dars (MET-01 bilan bir xil).
 * Bu yerda demo uchun 1-chorakning ikki guruhi saqlangan:
 *   7-A = "2-yil / 7-sinf"  (ESP32, Arduinodan keyingi bosqich)
 *   6-B = "1-yil / 6-sinf"  (elektr asoslari)
 *
 * "Dastur yili" sinfning oʻzida saqlanadi — 7-sinf oʻquvchisi ham 1-yilda,
 * ham 2-yilda boʻlishi mumkin (qachon boshlaganiga qarab), shuning uchun
 * sinf nomi bilan yil bogʻlanmaydi.
 *
 * To'liq baza 1550 ta kartochka (6.6 MB). Bu yerda chorakning barcha 21 ta
 * dars sarlavhasi va birinchi 8 tasining to'liq kartochkasi bor — qolganini
 * backend beradi (MET-01..MET-05, 2-bosqich).
 *
 * AVTOMATIK YARATILGAN — qo'lda tahrirlanmaydi.
 */

export interface PlanLessonTitle {
  i: number;
  title: string;
  model: string | null;
  type: string | null;
}

export interface PlanCard {
  maqsad?: string[];
  lugat?: string[];
  softSkill?: string;
  resurslar?: string[];
  nazariya?: { title: string; points: string[] }[];
  amaliy?: { title: string; points: string[] }[];
  uyga?: string[] | string;
  qollanma?: unknown;
}

export const PLAN_TITLES: Record<string, PlanLessonTitle[]> = {
 "7-A": [
  {
   "i": 0,
   "title": "Chorak kirish: ESP32: Arduino'dan keyingi qadam",
   "model": "ESP32 ni ulab, birinchi dasturni yuklash va imkoniyatlarini solishtirish",
   "type": "esp32"
  },
  {
   "i": 1,
   "title": "ESP32 arxitekturasi va Arduino'dan farqi",
   "model": "Ikki LEDni ulab, ularni ikki yadroga taqsimlangan alohida vazifalarda turli tezlikda miltillatish; Serial monitorda qaysi vazifa qaysi yadroda ishlayotganini kuzatish",
   "type": "esp32"
  },
  {
   "i": 2,
   "title": "Pinlar xaritasi va 3.3V mantiq",
   "model": "ESP32 ning har bir chiqish pinini LED bilan birma-bir sinab, ishlaydigan pinlar ro'yxatini tuzish va bandlarini (GPIO6-11) chetlab o'tishni amalda ko'rsatish",
   "type": "esp32"
  },
  {
   "i": 3,
   "title": "IDE'ga ESP32 qo'shish va birinchi yuklash",
   "model": "ESP32 ni ulab birinchi dasturni yuklash, Serial tezligini 115200 ga qo'yish va yuklash paytida BOOT/EN tugmalari tartibini amalda mashq qilish",
   "type": "esp32"
  },
  {
   "i": 4,
   "title": "5V va 3.3V mos kelmasligi muammosi",
   "model": "1 kOm va 2 kOm rezistorlardan bo'luvchi yasab, HC-SR04 ning ECHO signalini ESP32 ga xavfsiz ulash; bo'luvchi chiqishini multimetr bilan o'lchab, 3,3 V dan oshmasligini tasdiqlash",
   "type": "esp32"
  },
  {
   "i": 5,
   "title": "Raqamli kirish va chiqish",
   "model": "ESP32 ga tugma, LED va zummer ulab, tugma bosilganda holatni almashtiruvchi dastur yozish va 3,3 V mantiqda LED rezistorini qayta hisoblash",
   "type": "esp32"
  },
  {
   "i": 6,
   "title": "ADC: analog o'qish va uning xususiyatlari",
   "model": "ESP32 ga potensiometrni ulab, ADC qiymati va multimetr ko'rsatkichini 10 nuqtada yozib olib, grafik chizish va chetlaridagi chiziqsizlikni aniqlash",
   "type": "esp32"
  },
  {
   "i": 7,
   "title": "PWM (LEDC) kanallari",
   "model": "LEDC bilan bir necha mustaqil PWM kanalini sozlab ishlatish",
   "type": "esp32"
  },
  {
   "i": 8,
   "title": "Touch (sensorli) pinlar",
   "model": "GPIO4 ga folga yoki metall varaq ulab sensorli tugma yasash, tinch qiymatni kalibrlash va barmoq yaqinlashganda qiymat qanday tushishini Serial Plotter'da kuzatish",
   "type": "esp32"
  },
  {
   "i": 9,
   "title": "Hall datchigi (plata ichida)",
   "model": "Plata ichidagi Hall datchigini magnit bilan sinab, sezgirligini o'lchash",
   "type": "esp32"
  },
  {
   "i": 10,
   "title": "I2C: bir nechta qurilmani ulash",
   "model": "I2C skaner bilan bir necha modulni bir shinaga ulab, manzillarini aniqlash",
   "type": "esp32"
  },
  {
   "i": 11,
   "title": "OLED ekranni ulash",
   "model": "SSD1306 OLED ni ulab, ishga tushirish va birinchi matnni chiqarish",
   "type": "esp32"
  },
  {
   "i": 12,
   "title": "OLED'da matn va raqam",
   "model": "Turli o'lcham va joylashuvdagi matn bilan ma'lumot paneli yasash",
   "type": "esp32"
  },
  {
   "i": 13,
   "title": "OLED'da grafik va diagramma",
   "model": "Sensor qiymatlarining real vaqtli grafigini ekranda chizish",
   "type": "esp32"
  },
  {
   "i": 14,
   "title": "SPI protokoli haqida tushuncha",
   "model": "ESP32 ga SD kart (SPI) va OLED ekran (I2C) ni birga ulab, ikkala protokolni bir vaqtda ishlatish; sim sonini sanab, tezlikni o'lchab solishtirish jadvalini to'ldirish",
   "type": "esp32"
  },
  {
   "i": 15,
   "title": "microSD kart va ma'lumot yozish",
   "model": "SD kartga ma'lumot yozib, kompyuterda ochib tekshirish",
   "type": "esp32"
  },
  {
   "i": 16,
   "title": "RTC DS3231 va real vaqt",
   "model": "DS3231 ni sozlab, aniq vaqt bilan ma'lumot yozib borish",
   "type": "esp32"
  },
  {
   "i": 17,
   "title": "Deep sleep va quvvat tejash",
   "model": "ESP32 ni deep sleep rejimida ishlatib, INA219 bilan uyqu va ish rejimidagi tokni o'lchash; 2000 mAh batareya bilan qurilma necha kun ishlashini hisoblash",
   "type": "esp32"
  },
  {
   "i": 18,
   "title": "ESP32 xatolarini topish (boot muammolari)",
   "model": "ESP32 ga servo ulab, ishga tushganda kuchlanish cho'kib brownout qayta yuklanishini hosil qilish, keyin kondensator qo'yib muammoni bartaraf etish",
   "type": "esp32"
  },
  {
   "i": 19,
   "title": "Nazorat: ESP32'da sensor o'qib, OLED'da ko'rsatish",
   "model": "OledMonitor",
   "type": "nazorat"
  },
  {
   "i": 20,
   "title": "Loyiha: Ma'lumot yozib boruvchi qurilma (data logger)",
   "model": "Data logger",
   "type": "loyiha"
  }
 ],
 "6-B": [
  {
   "i": 0,
   "title": "Chorak kirish: Kurs bilan tanishuv, xavfsizlik va ish o'rni madaniyati",
   "model": "Ish o'rnini standart bo'yicha tashkil qilib, xavfsizlik testini bajarish",
   "type": "elektronika"
  },
  {
   "i": 1,
   "title": "Atom, elektron va zaryad",
   "model": "Atom modelini chizib, keyin uni tajribada ko'rish: ishqalangan shar bilan qog'oz parchalarini tortish, so'ng multimetr bilan mis sim va plastmassa qarshiligini o'lchab, o'tkazgichda elektronlar erkin, izolyatorda esa bog'langanini raqam bilan isbotlash",
   "type": "elektronika"
  },
  {
   "i": 2,
   "title": "Elektr toki: zaryadning yo'naltirilgan harakati",
   "model": "Turli kesimdagi simlarda bir xil kuchlanishda tokni o'lchab solishtirish",
   "type": "elektronika"
  },
  {
   "i": 3,
   "title": "Kuchlanish: zaryadni harakatlantiruvchi kuch",
   "model": "Bir necha manbaning kuchlanishini o'lchab, zanjirdagi kuchlanish taqsimotini kuzatish",
   "type": "elektronika"
  },
  {
   "i": 4,
   "title": "Tok manbalari: batareya, akkumulyator, adapter",
   "model": "Uch xil manbaning kuchlanishi va yuklamadagi cho'kishini o'lchab, jadval tuzish",
   "type": "elektronika"
  },
  {
   "i": 5,
   "title": "Zanjir elementlari va ularning shartli belgilari",
   "model": "15 ta shartli belgini o'rganib, keyin har biri uchun HAQIQIY komponentni to'plamdan topib yoniga qo'yish; so'ng o'qituvchi bergan sxema bo'yicha zanjirni breadboardda yig'ish va u ishlaganini LED bilan tasdiqlash",
   "type": "elektronika"
  },
  {
   "i": 6,
   "title": "Printsipial sxemani o'qish",
   "model": "Berilgan uch sxemani og'zaki tavsiflab, qanday ishlashini tushuntirish",
   "type": "elektronika"
  },
  {
   "i": 7,
   "title": "Sxemani chizish: o'z zanjiringni qog'ozda",
   "model": "Breadboardda yig'ilgan zanjirni sxemaga aylantirib chizish",
   "type": "elektronika"
  },
  {
   "i": 8,
   "title": "Breadboard: ichki ulanishlar xaritasi",
   "model": "Multimetr bilan breadboardni to'liq tekshirib, ichki ulanishlar xaritasini chizish",
   "type": "elektronika"
  },
  {
   "i": 9,
   "title": "Rezistor: vazifasi va rangli kodi",
   "model": "4 va 5 halqali rezistorlarni o'qib, o'lchov bilan tekshirish",
   "type": "elektronika"
  },
  {
   "i": 10,
   "title": "Rezistor nominalini hisoblash mashqlari",
   "model": "20 ta rangli kodni o'qib qiymatini aytish, keyin HAR BIRINI multimetr bilan o'lchab tekshirish; hisob va o'lchov farqini jadvalga yozib, rezistor bardoshi (5 %) chegarasidan chiqmaganini aniqlash",
   "type": "elektronika"
  },
  {
   "i": 11,
   "title": "LED: yarimo'tkazgichli yorug'lik manbai",
   "model": "Turli rangli LEDlarning tushish kuchlanishini o'lchab, rang bilan bog'liqligini aniqlash",
   "type": "elektronika"
  },
  {
   "i": 12,
   "title": "LED uchun rezistorni hisoblash",
   "model": "Uch xil manba kuchlanishi uchun bir xil LEDga rezistor hisoblab, jadval tuzish",
   "type": "elektronika"
  },
  {
   "i": 13,
   "title": "Ketma-ket ulanish qonuniyatlari",
   "model": "Uch rezistorli ketma-ket zanjirda barcha kattaliklarni hisoblab, o'lchov bilan solishtirish",
   "type": "elektronika"
  },
  {
   "i": 14,
   "title": "Parallel ulanish qonuniyatlari",
   "model": "Uch tarmoqli parallel zanjirni hisoblab, umumiy qarshilikni o'lchov bilan tekshirish",
   "type": "elektronika"
  },
  {
   "i": 15,
   "title": "Aralash (ketma-ket + parallel) ulanish",
   "model": "To'rt rezistorli aralash zanjirni bosqichma-bosqich soddalashtirib hisoblash",
   "type": "elektronika"
  },
  {
   "i": 16,
   "title": "Tugma, kalit va jamper: zanjirni boshqarish",
   "model": "Uch xil boshqarish elementini bir zanjirda ishlatib, farqlarini jadvalga yozish",
   "type": "elektronika"
  },
  {
   "i": 17,
   "title": "Montaj madaniyati: toza va tushunarli yig'ish",
   "model": "Chalkash yig'ilgan zanjirni qayta, toza qoidalar bo'yicha yig'ish va vaqtni solishtirish",
   "type": "elektronika"
  },
  {
   "i": 18,
   "title": "Nosozlik topish usullari: bosqichma-bosqich tekshirish",
   "model": "Uch xatoli zanjirni tizimli usul bilan tuzatib, har qadamni protokolga yozish",
   "type": "elektronika"
  },
  {
   "i": 19,
   "title": "Nazorat: Sxema bo'yicha aralash ulanishli zanjir yig'ish",
   "model": "MixedCircuit",
   "type": "nazorat"
  },
  {
   "i": 20,
   "title": "Loyiha: Uch rejimli chiroq: kuchsiz, o'rtacha, kuchli",
   "model": "Uch rejimli chiroq",
   "type": "loyiha"
  }
 ]
};

export const PLAN_CARDS: Record<string, PlanCard> = {
 "7-A|0": {
  "maqsad": [
   "O'quvchilar chorak davomida o'rganiladigan mavzular va kutilayotgan natijalar bilan tanishadilar.",
   "O'quvchilar ish o'rnini to'g'ri tashkil qilish va xavfsizlik qoidalarini o'zlashtiradilar.",
   "O'quvchilar kerakli jihoz va dasturiy vositalar bilan tanishadilar."
  ],
  "lugat": [
   "Arduino – dasturlanadigan mikrokontroller platasi va uning dasturiy muhiti",
   "ESP32 – WiFi va Bluetooth o'rnatilgan mikrokontroller platasi",
   "WiFi – simsiz tarmoqqa ulanish texnologiyasi",
   "IoT (Internet of Things) – internetga ulangan qurilmalar tizimi",
   "Dastur (Program) – qurilma bajaradigan buyruqlar ketma-ketligi"
  ],
  "softSkill": "Diqqat va aniqlik — elektronikada bitta noto'g'ri ulangan sim butun sxemani ishlamay qo'yadi, shuning uchun har qadamni tekshirib borish ko'nikmasi shakllanadi.",
  "resurslar": [
   "SET B — ESP32 va sensorlar to'plami",
   "Kompyuter (har juftlikka bitta) va USB kabel",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Chorak rejasi va maqsadlar (12 daqiqa)",
    "points": [
     "ESP32 — Arduino'dan 15 marta tez, 260 marta ko'p xotirali va WiFi bilan.",
     "Lekin u murakkabroq: 3.3 V mantiq, cheklangan pinlar, boot muammolari.",
     "Chorak davomida pinlar, ADC, PWM, touch, I2C, SPI, OLED, SD kart, RTC va deep sleep o'rganiladi.",
     "Chorak oxirida ma'lumot yozib boruvchi qurilma (data logger) yasaladi."
    ]
   },
   {
    "title": "5.2. Chorak davomida qanday ishlaymiz (5 daqiqa)",
    "points": [
     "Darslar tarmoq va IoT ustiga quriladi: har bir dars natijasi telefon yoki brauzerda ko'rinadi.",
     "Sinf WiFi tarmog'i oldindan sozlanadi, nom va parol hammaga beriladi.",
     "Har bir juftlikning qurilmasi tarmoqda o'z IP manzilini oladi va u yozib olinadi.",
     "Kod bo'laklari qayta ishlatiladi: WiFi ga ulanish qismi deyarli har darsda bir xil bo'ladi."
    ]
   },
   {
    "title": "5.3. ESP32 ning Arduino'dan farqlari (5 daqiqa)",
    "points": [
     "Mantiq darajasi 3,3 V — 5 V signal pinni SHIKASTLAYDI. Bu eng muhim farq.",
     "ADC 12 bitli: qiymat 0 dan 4095 gacha (Uno'da 0-1023).",
     "Serial tezligi odatda 115200 (Uno'da 9600).",
     "Pin nomlari GPIO bilan beriladi va ularning bir qismi band: GPIO6-11 flesh xotiraga tegishli, ishlatilmaydi.",
     "GPIO34-39 faqat KIRISH uchun, ular chiqish bo'la olmaydi va ichki tortuvchi rezistori yo'q.",
     "Ba'zi platalarda yuklash paytida BOOT tugmasini bosib turish kerak bo'ladi."
    ]
   },
   {
    "title": "5.4. Tarmoq bilan ishlash madaniyati (5 daqiqa)",
    "points": [
     "WiFi paroli kodga ochiq yoziladi — shuning uchun kodni ulashishdan oldin uni olib tashlash kerak.",
     "Ochiq MQTT brokerlardan foydalanganda mavzu nomi noyob bo'lishi kerak, aks holda boshqalar ham ko'radi.",
     "Boshqaruv sahifasi parolsiz bo'lsa, tarmoqdagi har kim qurilmani boshqara oladi.",
     "Bulut xizmatlarining bepul chegarasi bor: ThingSpeak 15 sekundda bir marta yozishga ruxsat beradi."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. ESP32 ni ulab, birinchi dasturni yuklash va imkoniyatlarini solishtirish (15 daqiqa)",
    "points": [
     "O'quvchilar berilgan vazifani juftlikda bajaradilar.",
     "Natija ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.2. Ish daftarini boshlash (7 daqiqa)",
    "points": [
     "Ish daftarining birinchi sahifasi to'ldiriladi.",
     "Daftarni qanday yuritish kerakligi namunada ko'rsatiladi."
    ]
   }
  ],
  "uyga": [
   "Ish daftarini rasmiylashtirib keling.",
   "To'plamdagi 5 ta komponent nomini yodlab keling."
  ],
  "qollanma": {
   "matn": "Kuch va murakkablik birga kelishini ayting — bu texnologiyada umumiy qonuniyat va uni oldindan bilish tayyorgarlik beradi."
  }
 },
 "7-A|1": {
  "maqsad": [
   "O'quvchilar \"ESP32 arxitekturasi va Arduino'dan farqi\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani ESP32 platasida qo'llay oladilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — ikki LEDni ulab, ularni ikki yadroga taqsimlangan alohida vazifalarda turli tezlikda miltillatish; Serial monitorda qaysi vazifa qaysi yadroda ishlayotganini kuzatish — mustaqil sozlay oladilar."
  ],
  "lugat": [
   "Arduino – dasturlanadigan mikrokontroller platasi va uning dasturiy muhiti",
   "ESP32 – WiFi va Bluetooth o'rnatilgan mikrokontroller platasi",
   "WiFi – simsiz tarmoqqa ulanish texnologiyasi",
   "IoT (Internet of Things) – internetga ulangan qurilmalar tizimi",
   "Dastur (Program) – qurilma bajaradigan buyruqlar ketma-ketligi"
  ],
  "softSkill": "Sabr-toqat — birinchi urinishda ishlamasligi normal holat; xatoni izlash jarayoni o'zi eng ko'p narsa o'rgatadi.",
  "resurslar": [
   "SET B — ESP32 va sensorlar to'plami",
   "Kompyuter (har juftlikka bitta) va USB kabel",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"ESP32 arxitekturasi va Arduino'dan farqi\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. ESP32 arxitekturasi va Arduino'dan farqi — asosiy tushuncha (8 daqiqa)",
    "points": [
     "ESP32: ikki yadroli 240 MHz protsessor, 520 KB SRAM, 4 MB flesh, WiFi va Bluetooth o'rnatilgan.",
     "Arduino Uno: bir yadroli 16 MHz, 2 KB SRAM, 32 KB flesh, simsiz aloqa yo'q.",
     "Ya'ni ESP32 protsessor tezligi bo'yicha 15 marta, xotira bo'yicha 260 marta kuchli.",
     "Asosiy farq esa mantiq darajasida: ESP32 3.3 V, Arduino 5 V. Bu barcha sxemalarga ta'sir qiladi."
    ]
   },
   {
    "title": "5.3. Kod namunasi nima qiladi (4 daqiqa)",
    "points": [
     "ESP32 ikki yadroli: bitta vazifa bir yadroda, boshqasi ikkinchisida ishlashi mumkin.",
     "Doskaga chiqariladigan namuna: \"Ikki yadro va xotira — o'lchab ko'rish\" (quyidagi \"Tayyor kod namunasi\" bo'limida to'liq berilgan).",
     "Kod qatorma-qator o'qiladi: har bir qator nima qilishi ovoz chiqarib aytiladi, keyin o'quvchilar takrorlaydi."
    ]
   },
   {
    "title": "5.4. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: ESP32 da qancha SRAM bor?  Javob: 520 kilobayt.",
     "Savol: Ikki plataning mantiq darajasi qanday farq qiladi?  Javob: ESP32 — 3.3 V, Arduino — 5 V."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: ikki LEDni ulab, ularni ikki yadroga taqsimlangan alohida vazifalarda turli tezlikda miltillatish; Serial monitorda qaysi vazifa qaysi yadroda ishlayotganini kuzatish.",
     "Natija Serial monitor yoki ekran orqali tekshiriladi va yozib olinadi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Arduino sxemalarini o'zgartirmasdan ESP32 ga ko'chirish.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"ESP32 arxitekturasi va Arduino'dan farqi\" bo'yicha bugungi sozlamalarni yozib, bitta savol tayyorlab keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Solishtirish jadvalini o'quvchilar to'ldirsin. Raqamlar farqni gapirishdan ko'ra ishonarli ko'rsatadi.",
   "xato": "Arduino sxemalarini o'zgartirmasdan ESP32 ga ko'chirish."
  }
 },
 "7-A|2": {
  "maqsad": [
   "O'quvchilar \"Pinlar xaritasi va 3.3V mantiq\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani ESP32 platasida qo'llay oladilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — eSP32 ning har bir chiqish pinini LED bilan birma-bir sinab, ishlaydigan pinlar ro'yxatini tuzish va bandlarini (GPIO6-11) chetlab o'tishni amalda ko'rsatish — mustaqil sozlay oladilar."
  ],
  "lugat": [
   "ESP32 – WiFi va Bluetooth o'rnatilgan mikrokontroller platasi",
   "WiFi – simsiz tarmoqqa ulanish texnologiyasi",
   "IoT (Internet of Things) – internetga ulangan qurilmalar tizimi",
   "Dastur (Program) – qurilma bajaradigan buyruqlar ketma-ketligi",
   "Sensor (Sensor) – fizik kattalikni elektr signalga aylantiruvchi qurilma"
  ],
  "softSkill": "Jamoada ishlash — juftlikda ishlashda vazifalarni bo'lish va bir-birini tekshirish.",
  "resurslar": [
   "SET B — ESP32 va sensorlar to'plami",
   "Kompyuter (har juftlikka bitta) va USB kabel",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Pinlar xaritasi va 3.3V mantiq\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Pinlar xaritasi va 3.3V mantiq — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Mantiq darajasi 3.3 V. 5 V signalni kirishga berish pinni shikastlaydi.",
     "Cheklangan pinlar: GPIO 6-11 ichki fleshga ulangan — umuman ishlatilmaydi.",
     "GPIO 34-39 faqat kirish: chiqish bo'la olmaydi va ichki tortuvchi rezistori yo'q.",
     "GPIO 0, 2, 12, 15 yuklash jarayoniga ta'sir qiladi — ularga komponent ulansa plata yuklanmasligi mumkin."
    ]
   },
   {
    "title": "5.3. Kod namunasi nima qiladi (4 daqiqa)",
    "points": [
     "Har bir GPIO ni sinab, ishlaydiganlar ro'yxatini tuzish.",
     "Doskaga chiqariladigan namuna: \"Xavfsiz pinlarni sinovdan o'tkazish\" (quyidagi \"Tayyor kod namunasi\" bo'limida to'liq berilgan).",
     "Kod qatorma-qator o'qiladi: har bir qator nima qilishi ovoz chiqarib aytiladi, keyin o'quvchilar takrorlaydi."
    ]
   },
   {
    "title": "5.4. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Qaysi pinlar faqat kirish uchun?  Javob: GPIO 34-39.",
     "Savol: GPIO 6-11 nima uchun ishlatilmaydi?  Javob: Ular ichki flesh xotiraga ulangan."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: eSP32 ning har bir chiqish pinini LED bilan birma-bir sinab, ishlaydigan pinlar ro'yxatini tuzish va bandlarini (GPIO6-11) chetlab o'tishni amalda ko'rsatish.",
     "Natija Serial monitor yoki ekran orqali tekshiriladi va yozib olinadi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Boot pinlariga komponent ulash — plata yuklanmaydi va sabab topilmaydi.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Pinlar xaritasi va 3.3V mantiq\" bo'yicha bugungi sozlamalarni yozib, bitta savol tayyorlab keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "\"Xavfsiz pinlar\" ro'yxatini tuzib tarqating (4, 5, 13, 14, 16-19, 21-23, 25-27, 32, 33). Bu chorak davomida eng ko'p ishlatiladigan qog'oz.",
   "xato": "Boot pinlariga komponent ulash — plata yuklanmaydi va sabab topilmaydi."
  }
 },
 "7-A|3": {
  "maqsad": [
   "O'quvchilar \"IDE'ga ESP32 qo'shish va birinchi yuklash\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani ESP32 platasida qo'llay oladilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — eSP32 ni ulab birinchi dasturni yuklash, Serial tezligini 115200 ga qo'yish va yuklash paytida BOOT/EN tugmalari tartibini amalda mashq qilish — mustaqil sozlay oladilar."
  ],
  "lugat": [
   "IDE (Integrated Development Environment) – dastur yozib, plataga yuklaydigan muhit",
   "ESP32 – WiFi va Bluetooth o'rnatilgan mikrokontroller platasi",
   "WiFi – simsiz tarmoqqa ulanish texnologiyasi",
   "IoT (Internet of Things) – internetga ulangan qurilmalar tizimi",
   "Dastur (Program) – qurilma bajaradigan buyruqlar ketma-ketligi"
  ],
  "softSkill": "Xavfsizlik madaniyati — o'z va boshqalarning xavfsizligi uchun javobgarlikni his qilish.",
  "resurslar": [
   "SET B — ESP32 va sensorlar to'plami",
   "Kompyuter (har juftlikka bitta) va USB kabel",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"IDE'ga ESP32 qo'shish va birinchi yuklash\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. IDE'ga ESP32 qo'shish va birinchi yuklash — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Preferences > Additional Board Manager URLs ga ESP32 paketi manzili qo'shiladi, keyin Boards Manager dan o'rnatiladi.",
     "Paket katta (~200 MB) — uni oldindan o'rnatib qo'yish kerak.",
     "Plata turi (ESP32 Dev Module) va port tanlanadi. Drayver: CP2102 yoki CH340.",
     "Ba'zi platalarda yuklash boshlanishi uchun BOOT tugmasini bosib turish kerak."
    ]
   },
   {
    "title": "5.3. Kod namunasi nima qiladi (4 daqiqa)",
    "points": [
     "Ba'zi platalarda yuklash boshlanganda BOOT tugmasini bosib turish kerak.",
     "Doskaga chiqariladigan namuna: \"ESP32 birinchi yuklash va BOOT tugmasi\" (quyidagi \"Tayyor kod namunasi\" bo'limida to'liq berilgan).",
     "Kod qatorma-qator o'qiladi: har bir qator nima qilishi ovoz chiqarib aytiladi, keyin o'quvchilar takrorlaydi."
    ]
   },
   {
    "title": "5.4. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: ESP32 paketi qanday o'rnatiladi?  Javob: Board Manager URL qo'shib, keyin Boards Manager orqali.",
     "Savol: Yuklash boshlanmasa nima qilinadi?  Javob: BOOT tugmasi bosib turiladi."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: eSP32 ni ulab birinchi dasturni yuklash, Serial tezligini 115200 ga qo'yish va yuklash paytida BOOT/EN tugmalari tartibini amalda mashq qilish.",
     "Natija Serial monitor yoki ekran orqali tekshiriladi va yozib olinadi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Paketni dars vaqtida yuklashga urinish.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"IDE'ga ESP32 qo'shish va birinchi yuklash\" bo'yicha bugungi sozlamalarni yozib, bitta savol tayyorlab keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Paketni oldindan barcha kompyuterlarga o'rnating. 200 MB yuklash sinf internetida butun darsni yeb qo'yadi.",
   "xato": "Paketni dars vaqtida yuklashga urinish."
  }
 },
 "7-A|4": {
  "maqsad": [
   "O'quvchilar \"5V va 3.3V mos kelmasligi muammosi\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani ESP32 platasida qo'llay oladilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — 1 kOm va 2 kOm rezistorlardan bo'luvchi yasab, HC-SR04 ning ECHO signalini ESP32 ga xavfsiz ulash; bo'luvchi chiqishini multimetr bilan o'lchab, 3,3 V dan oshmasligini tasdiqlash — mustaqil sozlay oladilar."
  ],
  "lugat": [
   "ESP32 – WiFi va Bluetooth o'rnatilgan mikrokontroller platasi",
   "WiFi – simsiz tarmoqqa ulanish texnologiyasi",
   "IoT (Internet of Things) – internetga ulangan qurilmalar tizimi",
   "Dastur (Program) – qurilma bajaradigan buyruqlar ketma-ketligi",
   "Sensor (Sensor) – fizik kattalikni elektr signalga aylantiruvchi qurilma"
  ],
  "softSkill": "Tanqidiy fikrlash — \"nega ishlamayapti?\" savoliga taxmin emas, tekshirish orqali javob izlash.",
  "resurslar": [
   "SET B — ESP32 va sensorlar to'plami",
   "Kompyuter (har juftlikka bitta) va USB kabel",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"5V va 3.3V mos kelmasligi muammosi\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. 5V va 3.3V mos kelmasligi muammosi — asosiy tushuncha (8 daqiqa)",
    "points": [
     "ESP32 kirishiga maksimal 3.3 V. 5 V signal pinni shikastlaydi.",
     "Yechim 1 — kuchlanish bo'luvchi: 1 kOm va 2 kOm. 5 x 2/3 = 3,3 V. Faqat sekin signallar uchun.",
     "Yechim 2 — daraja o'tkazgich moduli: tez signallar va ikki tomonlama aloqa uchun.",
     "Teskari yo'nalish (ESP32 dan 5 V qurilmaga) odatda muammosiz — ko'p 5 V kirishlar 3,3 V ni HIGH deb qabul qiladi."
    ]
   },
   {
    "title": "5.3. Kod namunasi nima qiladi (4 daqiqa)",
    "points": [
     "5 V signalni 3,3 V piniga berish pinni shikastlaydi. Ikki rezistor bu muammoni hal qiladi.",
     "Doskaga chiqariladigan namuna: \"Kuchlanish bo'luvchi bilan darajani moslash\" (quyidagi \"Tayyor kod namunasi\" bo'limida to'liq berilgan).",
     "Kod qatorma-qator o'qiladi: har bir qator nima qilishi ovoz chiqarib aytiladi, keyin o'quvchilar takrorlaydi."
    ]
   },
   {
    "title": "5.4. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Bo'luvchi uchun qanday rezistorlar olinadi?  Javob: Masalan 1 kOm va 2 kOm.",
     "Savol: Qaysi holatda daraja o'tkazgich kerak?  Javob: Tez signallar va ikki tomonlama aloqada."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: 1 kOm va 2 kOm rezistorlardan bo'luvchi yasab, HC-SR04 ning ECHO signalini ESP32 ga xavfsiz ulash; bo'luvchi chiqishini multimetr bilan o'lchab, 3,3 V dan oshmasligini tasdiqlash.",
     "Natija Serial monitor yoki ekran orqali tekshiriladi va yozib olinadi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: 5V sensorni to'g'ridan-to'g'ri ESP32 ga ulash.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"5V va 3.3V mos kelmasligi muammosi\" bo'yicha bugungi sozlamalarni yozib, bitta savol tayyorlab keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "HC-SR04 ning ECHO pinini namunali holat sifatida ko'rsating va bo'luvchini birgalikda hisoblang.",
   "xato": "5V sensorni to'g'ridan-to'g'ri ESP32 ga ulash."
  }
 },
 "7-A|5": {
  "maqsad": [
   "O'quvchilar \"Raqamli kirish va chiqish\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani ESP32 platasida qo'llay oladilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — eSP32 ga tugma, LED va zummer ulab, tugma bosilganda holatni almashtiruvchi dastur yozish va 3,3 V mantiqda LED rezistorini qayta hisoblash — mustaqil sozlay oladilar."
  ],
  "lugat": [
   "Raqamli signal (Digital) – faqat ikki holatga ega signal: 0 yoki 1",
   "ESP32 – WiFi va Bluetooth o'rnatilgan mikrokontroller platasi",
   "WiFi – simsiz tarmoqqa ulanish texnologiyasi",
   "IoT (Internet of Things) – internetga ulangan qurilmalar tizimi",
   "Dastur (Program) – qurilma bajaradigan buyruqlar ketma-ketligi"
  ],
  "softSkill": "Muammoni bo'laklarga bo'lish — katta vazifani kichik, tekshiriladigan qadamlarga ajratish.",
  "resurslar": [
   "SET B — ESP32 va sensorlar to'plami",
   "Kompyuter (har juftlikka bitta) va USB kabel",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Raqamli kirish va chiqish\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Raqamli kirish va chiqish — asosiy tushuncha (8 daqiqa)",
    "points": [
     "pinMode, digitalWrite, digitalRead buyruqlari Arduino bilan bir xil.",
     "Chiqish 3.3 V beradi. LED rezistori: (3,3-2)/0,015 = 87 Om, ya'ni 100 Om.",
     "Ko'k va oq LED (3,2 V) 3.3 V da juda xira yonadi — kuchlanish deyarli yetmaydi.",
     "Pin toki: xavfsiz 12 mA, mutlaq chegara 40 mA — Arduino'dagidan kamroq."
    ]
   },
   {
    "title": "5.3. Kod namunasi nima qiladi (4 daqiqa)",
    "points": [
     "Uno bilan bir xil, faqat pin nomlari GPIO va mantiq 3,3 V.",
     "Doskaga chiqariladigan namuna: \"ESP32 da tugma va LED\" (quyidagi \"Tayyor kod namunasi\" bo'limida to'liq berilgan).",
     "Kod qatorma-qator o'qiladi: har bir qator nima qilishi ovoz chiqarib aytiladi, keyin o'quvchilar takrorlaydi."
    ]
   },
   {
    "title": "5.4. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: ESP32 chiqishi qancha kuchlanish beradi?  Javob: 3.3 V.",
     "Savol: Pindan xavfsiz qancha tok olinadi?  Javob: Taxminan 12 mA."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: eSP32 ga tugma, LED va zummer ulab, tugma bosilganda holatni almashtiruvchi dastur yozish va 3,3 V mantiqda LED rezistorini qayta hisoblash.",
     "Natija Serial monitor yoki ekran orqali tekshiriladi va yozib olinadi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Arduino uchun hisoblangan rezistorlarni o'zgartirmasdan ishlatish.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Raqamli kirish va chiqish\" bo'yicha bugungi sozlamalarni yozib, bitta savol tayyorlab keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Ko'k LED muammosini ko'rsating — bu tushish kuchlanishi mavzusining amaliy oqibati va bog'lanishni yaqqol ko'rsatadi.",
   "xato": "Arduino uchun hisoblangan rezistorlarni o'zgartirmasdan ishlatish."
  }
 },
 "7-A|6": {
  "maqsad": [
   "O'quvchilar \"ADC: analog o'qish va uning xususiyatlari\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani ESP32 platasida qo'llay oladilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — eSP32 ga potensiometrni ulab, ADC qiymati va multimetr ko'rsatkichini 10 nuqtada yozib olib, grafik chizish va chetlaridagi chiziqsizlikni aniqlash — mustaqil sozlay oladilar."
  ],
  "lugat": [
   "Analog signal – uzluksiz o'zgaruvchi qiymatga ega signal",
   "ADC – analog kuchlanishni raqamli qiymatga aylantiruvchi qism",
   "ESP32 – WiFi va Bluetooth o'rnatilgan mikrokontroller platasi",
   "WiFi – simsiz tarmoqqa ulanish texnologiyasi",
   "IoT (Internet of Things) – internetga ulangan qurilmalar tizimi"
  ],
  "softSkill": "Hujjatlashtirish odati — qilingan ishni yozib borish, keyin qayta tiklay olish.",
  "resurslar": [
   "SET B — ESP32 va sensorlar to'plami",
   "Kompyuter (har juftlikka bitta) va USB kabel",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"ADC: analog o'qish va uning xususiyatlari\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. ADC: analog o'qish va uning xususiyatlari — asosiy tushuncha (8 daqiqa)",
    "points": [
     "ESP32 ADC 12 razryadli: 0-4095 (Arduino da 0-1023).",
     "Kirish diapazoni 0-3.3 V, lekin standart sozlamada ishonchli o'lchov 0,15-2,45 V oralig'ida.",
     "ADC CHIZIQSIZ, ayniqsa chekka qiymatlarda. Aniq o'lchov uchun kalibrlash yoki tuzatish jadvali kerak.",
     "ADC2 kanallari (GPIO 0, 2, 4, 12-15, 25-27) WiFi yoqilganda ISHLAMAYDI. WiFi bilan faqat ADC1 (GPIO 32-39)."
    ]
   },
   {
    "title": "5.3. Kod namunasi nima qiladi (4 daqiqa)",
    "points": [
     "ESP32 ADC si Uno nikidan aniqroq (12 bit), lekin chetlarida CHIZIQSIZ — buni o'lchab ko'rish kerak.",
     "Doskaga chiqariladigan namuna: \"ESP32 ADC ning chiziqsizligi\" (quyidagi \"Tayyor kod namunasi\" bo'limida to'liq berilgan).",
     "Kod qatorma-qator o'qiladi: har bir qator nima qilishi ovoz chiqarib aytiladi, keyin o'quvchilar takrorlaydi."
    ]
   },
   {
    "title": "5.4. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: ESP32 ADC qanday oraliq beradi?  Javob: 0 dan 4095 gacha.",
     "Savol: WiFi yoqilganda qaysi kanallar ishlamaydi?  Javob: ADC2 kanallari."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: eSP32 ga potensiometrni ulab, ADC qiymati va multimetr ko'rsatkichini 10 nuqtada yozib olib, grafik chizish va chetlaridagi chiziqsizlikni aniqlash.",
     "Natija Serial monitor yoki ekran orqali tekshiriladi va yozib olinadi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: WiFi bilan birga ADC2 pinini ishlatish — qiymat doim 0 chiqadi.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"ADC: analog o'qish va uning xususiyatlari\" bo'yicha bugungi sozlamalarni yozib, bitta savol tayyorlab keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "ADC2 va WiFi to'qnashuvi — bu chorakning eng ko'p vaqt yeydigan sirli nosozligi. Xavfsiz pinlar ro'yxatiga yozib qo'ying.",
   "xato": "WiFi bilan birga ADC2 pinini ishlatish — qiymat doim 0 chiqadi."
  }
 },
 "7-A|7": {
  "maqsad": [
   "O'quvchilar \"PWM (LEDC) kanallari\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani ESP32 platasida qo'llay oladilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — lEDC bilan bir necha mustaqil PWM kanalini sozlab ishlatish — mustaqil sozlay oladilar."
  ],
  "lugat": [
   "LED (Light Emitting Diode) – tok o'tganda yorug'lik chiqaradigan yarimo'tkazgich",
   "PWM (Pulse Width Modulation) – impuls kengligi orqali o'rtacha quvvatni boshqarish",
   "LEDC – ESP32 platasining PWM signal hosil qiluvchi qismi",
   "ESP32 – WiFi va Bluetooth o'rnatilgan mikrokontroller platasi",
   "WiFi – simsiz tarmoqqa ulanish texnologiyasi"
  ],
  "softSkill": "Mustaqillik — yordam so'rashdan oldin o'zi tekshirib ko'rish tartibiga rioya qilish.",
  "resurslar": [
   "SET B — ESP32 va sensorlar to'plami",
   "Kompyuter (har juftlikka bitta) va USB kabel",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"PWM (LEDC) kanallari\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. PWM (LEDC) kanallari — asosiy tushuncha (8 daqiqa)",
    "points": [
     "ESP32 da 16 ta mustaqil LEDC kanali bor, har biriga o'z chastotasi va razryadi beriladi.",
     "Sozlash: ledcSetup(kanal, chastota, razryad); ledcAttachPin(pin, kanal); ledcWrite(kanal, qiymat);",
     "Razryad 8 bo'lsa 0-255, 10 bo'lsa 0-1023, 12 bo'lsa 0-4095. Yuqori razryad silliqroq boshqaruv.",
     "Chastota va razryad o'zaro bog'liq: yuqori chastotada yuqori razryadga imkon bo'lmasligi mumkin."
    ]
   },
   {
    "title": "5.3. LED — texnik tasnif (4 daqiqa)",
    "points": [
     "To'liq nomi: Light Emitting Diode — yorug'lik chiqaruvchi diod.",
     "Ishchi kuchlanishi (tushish kuchlanishi Uf): qizil 1,8-2,2 V; sariq va yashil 2,0-2,4 V; ko'k va oq 3,0-3,4 V.",
     "Nominal tok: 20 mA. 5 mA da ham yaxshi ko'rinadi, 30 mA dan oshsa umri qisqaradi.",
     "Qutbliligi bor: uzun oyoq — anod (+), kalta oyoq va korpusning yassi qirrasi — katod (-).",
     "Arduino pinining chegarasi: bitta pindan 40 mA (xavfsizi 20 mA), butun platadan 200 mA."
    ]
   },
   {
    "title": "5.4. LED — ichida nima sodir bo'ladi (4 daqiqa)",
    "points": [
     "LED ichida ikki xil yarimo'tkazgich qatlami tutashadi. Tok o'tganda elektron energiyasini yo'qotib, o'sha energiya YORUG'LIK sifatida chiqadi.",
     "Chiqadigan rang materialga bog'liq, kuchlanishga emas: ko'proq kuchlanish bersangiz rang o'zgarmaydi, LED kuyadi.",
     "Diod bo'lgani uchun tokni faqat bir tomonga o'tkazadi. Teskari ulansa yonmaydi (lekin buzilmaydi)."
    ]
   },
   {
    "title": "5.5. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: ESP32 da nechta PWM kanali bor?  Javob: 16 ta.",
     "Savol: 12 razryadli PWM da qiymat oralig'i qanday?  Javob: 0 dan 4095 gacha."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: lEDC bilan bir necha mustaqil PWM kanalini sozlab ishlatish.",
     "Natija Serial monitor yoki ekran orqali tekshiriladi va yozib olinadi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Bir kanalni bir necha pinga bog'lab, mustaqil boshqarmoqchi bo'lish.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"PWM (LEDC) kanallari\" bo'yicha bugungi sozlamalarni yozib, bitta savol tayyorlab keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Chastota va razryad bog'liqligini sinab ko'rsating — juda yuqori chastotada razryad avtomatik kamayadi. Bu apparat cheklovi.",
   "xato": "Bir kanalni bir necha pinga bog'lab, mustaqil boshqarmoqchi bo'lish."
  }
 },
 "6-B|0": {
  "maqsad": [
   "O'quvchilar chorak davomida o'rganiladigan mavzular va kutilayotgan natijalar bilan tanishadilar.",
   "O'quvchilar ish o'rnini to'g'ri tashkil qilish va xavfsizlik qoidalarini o'zlashtiradilar.",
   "O'quvchilar kerakli jihoz va dasturiy vositalar bilan tanishadilar."
  ],
  "lugat": [
   "Elektr zanjiri (Circuit) – tok aylanib yuradigan yopiq yo'l",
   "Kuchlanish (Voltage) – zaryadni harakatlantiruvchi elektr bosimi, voltda o'lchanadi",
   "Elektr toki (Current) – zaryadlangan zarrachalarning yo'naltirilgan harakati, amperda o'lchanadi",
   "Rezistor (Resistor) – tokni cheklovchi komponent, qiymati omda",
   "Printsipial sxema (Schematic) – zanjirning shartli belgilar bilan chizilgan tasviri"
  ],
  "softSkill": "Diqqat va aniqlik — elektronikada bitta noto'g'ri ulangan sim butun sxemani ishlamay qo'yadi, shuning uchun har qadamni tekshirib borish ko'nikmasi shakllanadi.",
  "resurslar": [
   "SET A — elektronika to'plami (breadboard, multimetr, komponentlar)",
   "Multimetr (har juftlikka bitta)",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Chorak rejasi va maqsadlar (12 daqiqa)",
    "points": [
     "6-sinf kursi 5-sinfdan chuqurroq: formulalar, hisoblash va datasheet bilan ishlash qo'shiladi.",
     "Xavfsizlik qoidalari o'zgarmaydi, lekin ularga sabab qo'shiladi: nima uchun aynan shunday.",
     "Ish o'rni madaniyati: toza montaj, komponentlarni tartibda saqlash, protokol yuritish.",
     "Chorak oxirida uch rejimli chiroq yasaladi — bu aralash ulanishni amalda talab qiladi."
    ]
   },
   {
    "title": "5.2. Chorak davomida qanday ishlaymiz (5 daqiqa)",
    "points": [
     "Har bir dars bir xil tartibda o'tadi: takrorlash, yangi mavzu, sxema yig'ish, o'lchash, natijani yozish.",
     "Ish juftlikda bajariladi: bittasi yig'adi, ikkinchisi sxema bo'yicha tekshiradi, keyin almashadilar.",
     "Har dars oxirida ish daftariga yoziladi: nima yig'ildi, qanday qiymat o'lchandi, qanday xato bo'ldi.",
     "Chorak oxirida nazorat musobaqasi va loyiha bo'ladi — ularning mezonlari oldindan e'lon qilinadi."
    ]
   },
   {
    "title": "5.3. Elektr xavfsizligi — asosiy qoidalar (5 daqiqa)",
    "points": [
     "Darsda ishlatiladigan kuchlanish 3,3-9 V — bu inson uchun xavfsiz oraliq.",
     "220 V bilan ishlash faqat o'qituvchi nazoratida va faqat namoyish tarzida bo'ladi.",
     "Zanjirni o'zgartirishdan oldin quvvat UZILADI. Ulangan holatda sim ulash — eng ko'p uchraydigan xato.",
     "Batareyaning ikki qutbini bevosita ulash mumkin emas: bu qisqa tutashuv, batareya qiziydi.",
     "Qizigan komponentni ushlamaslik: rezistor va stabilizator 80 darajagacha qizishi mumkin.",
     "Ishdan keyin quvvat uziladi va komponentlar joyiga qaytariladi."
    ]
   },
   {
    "title": "5.4. Ish o'rni va jihoz (5 daqiqa)",
    "points": [
     "Stol toza va quruq bo'lishi kerak — suv va elektronika birga bo'lmaydi.",
     "Komponentlar qutichada saralab saqlanadi: rezistorlar alohida, LEDlar alohida.",
     "Breadboard, multimetr va simlar to'plami har juftlikda alohida bo'ladi.",
     "Jihoz buzilsa yashirilmaydi — darhol aytiladi. Buzilgan jihoz bilan ishlash xavfli.",
     "To'plam to'liqligi dars boshida va oxirida ro'yxat bo'yicha tekshiriladi."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Ish o'rnini standart bo'yicha tashkil qilib, xavfsizlik testini bajarish (15 daqiqa)",
    "points": [
     "O'quvchilar berilgan vazifani juftlikda bajaradilar.",
     "Natija ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.2. Ish daftarini boshlash (7 daqiqa)",
    "points": [
     "Ish daftarining birinchi sahifasi to'ldiriladi.",
     "Daftarni qanday yuritish kerakligi namunada ko'rsatiladi."
    ]
   }
  ],
  "uyga": [
   "Ish daftarini rasmiylashtirib keling.",
   "To'plamdagi 5 ta komponent nomini yodlab keling."
  ],
  "qollanma": {
   "matn": "6-sinfda qoidalarga sabab qo'shing: \"mumkin emas\" emas, \"chunki tok shu yo'ldan o'tadi va sim qiziydi\". Bu yoshda sabab bilan tushuntirish ancha samarali."
  }
 },
 "6-B|1": {
  "maqsad": [
   "O'quvchilar \"Atom, elektron va zaryad\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani zanjirda amalda ko'radilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — atom modelini chizib, keyin uni tajribada ko'rish: ishqalangan shar bilan qog'oz parchalarini tortish, so'ng multimetr bilan mis sim va plastmassa qarshiligini o'lchab, o'tkazgichda elektronlar erkin, izolyatorda esa bog'langanini raqam bilan isbotlash — mustaqil yig'a oladilar."
  ],
  "lugat": [
   "Elektr zanjiri (Circuit) – tok aylanib yuradigan yopiq yo'l",
   "Kuchlanish (Voltage) – zaryadni harakatlantiruvchi elektr bosimi, voltda o'lchanadi",
   "Elektr toki (Current) – zaryadlangan zarrachalarning yo'naltirilgan harakati, amperda o'lchanadi",
   "Rezistor (Resistor) – tokni cheklovchi komponent, qiymati omda",
   "Printsipial sxema (Schematic) – zanjirning shartli belgilar bilan chizilgan tasviri"
  ],
  "softSkill": "Sabr-toqat — birinchi urinishda ishlamasligi normal holat; xatoni izlash jarayoni o'zi eng ko'p narsa o'rgatadi.",
  "resurslar": [
   "SET A — elektronika to'plami (breadboard, multimetr, komponentlar)",
   "Multimetr (har juftlikka bitta)",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Atom, elektron va zaryad\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Atom, elektron va zaryad — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Atom yadro (proton va neytron) va uning atrofidagi elektronlardan iborat. Proton musbat, elektron manfiy, neytron zaryadsiz.",
     "Neytral atomda proton va elektron soni teng. Elektron qo'shilsa manfiy ion, ajralsa musbat ion hosil bo'ladi.",
     "Metallda tashqi elektronlar atomga kuchsiz bog'langan — ular kristall panjara ichida erkin harakatlanadi. Bu \"elektron gaz\" deb ataladi.",
     "Zaryad birligi — kulon (Kl). Bitta elektronning zaryadi 1,6 x 10 daraja -19 Kl, ya'ni 1 kulonda 6 kvintillion elektron bor."
    ]
   },
   {
    "title": "5.3. Atom tuzilishi (4 daqiqa)",
    "points": [
     "Atom markazida yadro: musbat zaryadli protonlar va zaryadsiz neytronlar.",
     "Yadro atrofida manfiy zaryadli elektronlar qatlamlar bo'ylab joylashgan.",
     "Oddiy holatda proton va elektron soni teng, shuning uchun atom umumiy zaryadsiz (neytral).",
     "Elektron yo'qotgan atom musbat, ortiqcha elektron olgan atom manfiy ion bo'ladi."
    ]
   },
   {
    "title": "5.4. Nima uchun metall tokni o'tkazadi (4 daqiqa)",
    "points": [
     "Metall atomlarining eng tashqi elektronlari yadroga kuchsiz bog'langan.",
     "Kristall panjarada bu elektronlar o'z atomini tashlab, umumiy \"elektron bulut\" hosil qiladi.",
     "Shuning uchun metallda erkin zaryad tashuvchilar juda ko'p va u tokni yaxshi o'tkazadi.",
     "Rezinada esa elektronlar atomga mahkam bog'langan va deyarli erkin zaryad yo'q — shuning uchun u izolyator.",
     "Yarimo'tkazgichda (kremniy) erkin elektron kam, lekin qo'shimcha ta'sir (harorat, yorug'lik, kuchlanish) bilan ularning sonini boshqarish mumkin."
    ]
   },
   {
    "title": "5.5. Statik zaryad (4 daqiqa)",
    "points": [
     "Ikki jism ishqalanganda birining elektronlari ikkinchisiga o'tadi va ular qarama-qarshi zaryadlanadi.",
     "Zaryadlangan shar qog'oz parchalarini tortadi, chunki u qog'ozdagi zaryadlarni siljitadi.",
     "Statik zaryad minglab volt bo'lishi mumkin, lekin zaryad miqdori juda kichik — shuning uchun u odam uchun xavfli emas.",
     "Lekin mikrosxemalar uchun xavfli: statik razryad ichkarisidagi yupqa qatlamni teshib yuborishi mumkin. Shuning uchun platani chetlaridan ushlash kerak."
    ]
   },
   {
    "title": "5.6. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Neytral atomda nima teng bo'ladi?  Javob: Proton va elektron soni.",
     "Savol: Metallda elektronlar nima uchun erkin?  Javob: Tashqi elektronlar atomga kuchsiz bog'langan."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: atom modelini chizib, keyin uni tajribada ko'rish: ishqalangan shar bilan qog'oz parchalarini tortish, so'ng multimetr bilan mis sim va plastmassa qarshiligini o'lchab, o'tkazgichda elektronlar erkin, izolyatorda esa bog'langanini raqam bilan isbotlash.",
     "Natija multimetr bilan tekshiriladi va qiymatlar ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Zaryadni \"modda\" deb tasavvur qilish — zaryad moddaning xossasi, alohida modda emas.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Atom, elektron va zaryad\" mavzusi bo'yicha bugungi sxemani daftarga chizib keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Kimyo darsidagi atom tuzilishi bilan bevosita bog'lang. Elektronika fizika va kimyoning davomi ekanini o'quvchilar shu darsda ko'rishi kerak.",
   "xato": "Zaryadni \"modda\" deb tasavvur qilish — zaryad moddaning xossasi, alohida modda emas."
  }
 },
 "6-B|2": {
  "maqsad": [
   "O'quvchilar \"Elektr toki: zaryadning yo'naltirilgan harakati\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani zanjirda amalda ko'radilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — turli kesimdagi simlarda bir xil kuchlanishda tokni o'lchab solishtirish — mustaqil yig'a oladilar."
  ],
  "lugat": [
   "Elektr toki (Current) – zaryadlangan zarrachalarning yo'naltirilgan harakati, amperda o'lchanadi",
   "Elektr zanjiri (Circuit) – tok aylanib yuradigan yopiq yo'l",
   "Kuchlanish (Voltage) – zaryadni harakatlantiruvchi elektr bosimi, voltda o'lchanadi",
   "Rezistor (Resistor) – tokni cheklovchi komponent, qiymati omda",
   "Printsipial sxema (Schematic) – zanjirning shartli belgilar bilan chizilgan tasviri"
  ],
  "softSkill": "Jamoada ishlash — juftlikda ishlashda vazifalarni bo'lish va bir-birini tekshirish.",
  "resurslar": [
   "SET A — elektronika to'plami (breadboard, multimetr, komponentlar)",
   "Multimetr (har juftlikka bitta)",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Elektr toki: zaryadning yo'naltirilgan harakati\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Elektr toki: zaryadning yo'naltirilgan harakati — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Quvvat berilmagan metallda elektronlar tartibsiz harakatlanadi — umumiy siljish nolga teng.",
     "Kuchlanish berilganda ular tartibsiz harakatni saqlagan holda bir tomonga sekin siljiydi. Bu siljish tezligi juda kichik — soatiga bir necha santimetr.",
     "Lekin chiroq darhol yonadi, chunki elektr maydoni deyarli yorug'lik tezligida tarqaladi va hamma elektronlar bir vaqtda siljiy boshlaydi.",
     "Tok kuchi I = q / t: bir sekundda kesim orqali o'tgan zaryad miqdori. 1 A = 1 sekundda 1 kulon."
    ]
   },
   {
    "title": "5.3. Tokning shartli va haqiqiy yo'nalishi (4 daqiqa)",
    "points": [
     "Shartli (texnik) yo'nalish: tok PLYUSDAN MINUSGA oqadi deb qabul qilingan. Hamma sxemalarda shunday chiziladi.",
     "Haqiqiy yo'nalish: elektronlar manfiy zaryadli, shuning uchun ular MINUSDAN PLYUSGA harakatlanadi.",
     "Bu qarama-qarshilik tarixiy: shartli yo'nalish elektron kashf qilinishidan oldin belgilangan va o'zgartirilmagan.",
     "Amalda bu hech narsani buzmaydi: hisob va sxemalar shartli yo'nalish bo'yicha to'g'ri chiqadi."
    ]
   },
   {
    "title": "5.4. Tok turlari (4 daqiqa)",
    "points": [
     "O'zgarmas tok (DC) — yo'nalishi doim bir xil. Batareya, akkumulyator, USB shunday tok beradi.",
     "O'zgaruvchan tok (AC) — yo'nalishi sekundiga 50 marta almashadi. Rozetkadagi tok shunday.",
     "Elektronika deyarli har doim DC bilan ishlaydi, shuning uchun adapter AC ni DC ga aylantirib beradi.",
     "Sxemada DC to'g'ri chiziq bilan, AC esa to'lqinsimon chiziq bilan belgilanadi."
    ]
   },
   {
    "title": "5.5. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Elektronlarning siljish tezligi qanaqa?  Javob: Juda kichik, soatiga bir necha santimetr.",
     "Savol: Nega chiroq darhol yonadi?  Javob: Elektr maydoni deyarli yorug'lik tezligida tarqaladi."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: turli kesimdagi simlarda bir xil kuchlanishda tokni o'lchab solishtirish.",
     "Natija multimetr bilan tekshiriladi va qiymatlar ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Elektronlar simda yorug'lik tezligida uchadi deb o'ylash.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Elektr toki: zaryadning yo'naltirilgan harakati\" mavzusi bo'yicha bugungi sxemani daftarga chizib keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "\"Elektron sekin, signal tez\" paradoksini albatta ayting — quvurdagi suv o'xshatishi bilan tushuntirsa bo'ladi: kranni ochsangiz suv darhol chiqadi, garchi quvur boshidagi tomchi hali yetib kelmagan bo'lsa ham.",
   "xato": "Elektronlar simda yorug'lik tezligida uchadi deb o'ylash."
  }
 },
 "6-B|3": {
  "maqsad": [
   "O'quvchilar \"Kuchlanish: zaryadni harakatlantiruvchi kuch\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani zanjirda amalda ko'radilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — bir necha manbaning kuchlanishini o'lchab, zanjirdagi kuchlanish taqsimotini kuzatish — mustaqil yig'a oladilar."
  ],
  "lugat": [
   "Kuchlanish (Voltage) – zaryadni harakatlantiruvchi elektr bosimi, voltda o'lchanadi",
   "Elektr zanjiri (Circuit) – tok aylanib yuradigan yopiq yo'l",
   "Elektr toki (Current) – zaryadlangan zarrachalarning yo'naltirilgan harakati, amperda o'lchanadi",
   "Rezistor (Resistor) – tokni cheklovchi komponent, qiymati omda",
   "Printsipial sxema (Schematic) – zanjirning shartli belgilar bilan chizilgan tasviri"
  ],
  "softSkill": "Xavfsizlik madaniyati — o'z va boshqalarning xavfsizligi uchun javobgarlikni his qilish.",
  "resurslar": [
   "SET A — elektronika to'plami (breadboard, multimetr, komponentlar)",
   "Multimetr (har juftlikka bitta)",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Kuchlanish: zaryadni harakatlantiruvchi kuch\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Kuchlanish: zaryadni harakatlantiruvchi kuch — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Kuchlanish — bir kulon zaryadni bir nuqtadan ikkinchisiga ko'chirishda bajarilgan ish: U = A / q. Birligi volt.",
     "Kuchlanish har doim IKKI nuqta orasida. \"Shu nuqtada 5 V\" degani aslida \"shu nuqta bilan GND orasida 5 V\" degani.",
     "Manba kuchlanishi (EYuK) va zanjirdagi kuchlanish farq qiladi: manbaning ichki qarshiligida ham bir qismi yo'qoladi.",
     "Kuchlanishning boshqa nomlari: potensiallar farqi, taranglik. Sxemada V yoki U harfi bilan belgilanadi."
    ]
   },
   {
    "title": "5.3. Kuchlanishning fizik ma'nosi (4 daqiqa)",
    "points": [
     "Kuchlanish (U) — zanjirning ikki nuqtasi orasidagi zaryadlar farqi natijasida hosil bo'lgan itaruvchi kuch.",
     "1 volt — 1 kulon zaryadni ko'chirishda 1 joul energiya sarflanishini bildiradi.",
     "Kuchlanish DOIM IKKI NUQTA ORASIDA o'lchanadi. \"Shu simda 5 volt\" degan gap to'liq emas — nimaga nisbatan degan savol qoladi.",
     "Shuning uchun sxemada GND (yer) nuqtasi tanlanadi va hamma kuchlanish shunga nisbatan sanaladi."
    ]
   },
   {
    "title": "5.4. Amaldagi kuchlanishlar (4 daqiqa)",
    "points": [
     "AA batareya — 1,5 V. To'rttasi ketma-ket ulansa 6 V.",
     "Kron batareya — 9 V. Li-ion akkumulyator — 3,7 V (to'la zaryadda 4,2 V).",
     "USB port — 5 V. Arduino Uno mantiq darajasi — 5 V, ESP32 — 3,3 V.",
     "Rozetka — 220 V. Bu maktab darslarida ISHLATILMAYDI.",
     "Statik zaryad esa minglab volt bo'lishi mumkin, lekin toki juda kichik — shuning uchun u xavfli emas, faqat mikrosxemalarni shikastlashi mumkin."
    ]
   },
   {
    "title": "5.5. Suv analogiyasi va uning chegarasi (4 daqiqa)",
    "points": [
     "Kuchlanish — bosim, tok — oqim tezligi, qarshilik — quvurning torayishi.",
     "Bak baland turgan bo'lsa bosim katta (kuchlanish), quvur keng bo'lsa oqim ko'p (tok).",
     "Analogiyaning chegarasi: suv quvurdan chiqib ketishi mumkin, elektronlar esa zanjirdan chiqmaydi — ular yopiq halqa bo'ylab aylanadi.",
     "Shuning uchun zanjir albatta YOPIQ bo'lishi kerak, aks holda tok umuman oqmaydi."
    ]
   },
   {
    "title": "5.6. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Kuchlanish formulasi qanday?  Javob: U = A / q, ya'ni ish bo'linadi zaryadga.",
     "Savol: \"Shu nuqtada 5 V\" iborasi to'liq qanday aytiladi?  Javob: Shu nuqta bilan GND orasida 5 V."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: bir necha manbaning kuchlanishini o'lchab, zanjirdagi kuchlanish taqsimotini kuzatish.",
     "Natija multimetr bilan tekshiriladi va qiymatlar ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Kuchlanishni tok bilan chalkashtirish: \"5 voltlik tok\" degan ifoda noto'g'ri.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Kuchlanish: zaryadni harakatlantiruvchi kuch\" mavzusi bo'yicha bugungi sxemani daftarga chizib keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "\"Nuqtadagi kuchlanish\" iborasi noto'g'ri ekanini bir necha marta takrorlang. Bu tushuncha 5-sinfda ham berilgan, 6-sinfda uni formula darajasida mustahkamlash kerak.",
   "xato": "Kuchlanishni tok bilan chalkashtirish: \"5 voltlik tok\" degan ifoda noto'g'ri."
  }
 },
 "6-B|4": {
  "maqsad": [
   "O'quvchilar \"Tok manbalari: batareya, akkumulyator, adapter\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani zanjirda amalda ko'radilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — uch xil manbaning kuchlanishi va yuklamadagi cho'kishini o'lchab, jadval tuzish — mustaqil yig'a oladilar."
  ],
  "lugat": [
   "Elektr toki (Current) – zaryadlangan zarrachalarning yo'naltirilgan harakati, amperda o'lchanadi",
   "Batareya (Battery) – kimyoviy energiyani elektr energiyaga aylantiruvchi manba",
   "Elektr zanjiri (Circuit) – tok aylanib yuradigan yopiq yo'l",
   "Kuchlanish (Voltage) – zaryadni harakatlantiruvchi elektr bosimi, voltda o'lchanadi",
   "Rezistor (Resistor) – tokni cheklovchi komponent, qiymati omda"
  ],
  "softSkill": "Tanqidiy fikrlash — \"nega ishlamayapti?\" savoliga taxmin emas, tekshirish orqali javob izlash.",
  "resurslar": [
   "SET A — elektronika to'plami (breadboard, multimetr, komponentlar)",
   "Multimetr (har juftlikka bitta)",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Tok manbalari: batareya, akkumulyator, adapter\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Tok manbalari: batareya, akkumulyator, adapter — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Batareya (bir marta ishlatiladigan) — kimyoviy reaksiya qaytmas, tugagach tashlanadi. AA, AAA, krona.",
     "Akkumulyator qayta zaryadlanadi: Li-ion 3,7 V, NiMH 1,2 V. Zaryadlash uchun maxsus kontroller kerak, aks holda yong'in xavfi bor.",
     "Adapter (blok pitaniya) 220 V ni past kuchlanishga aylantiradi. Uning quvvati amper bilan yozilgan: 5V 2A = 10 vatt.",
     "Har manbaning ichki qarshiligi bor: batareyada katta (bir necha om), adapterda juda kichik. Shuning uchun motorli qurilmalar adapterdan barqarorroq ishlaydi."
    ]
   },
   {
    "title": "5.3. Manbalarni solishtirish (4 daqiqa)",
    "points": [
     "Alkalin batareya: arzon, uzoq saqlanadi, lekin bir martalik. AA — 1,5 V, 2000 mAh.",
     "NiMH akkumulyator: 1000 martagacha zaryadlanadi, lekin kuchlanishi 1,2 V va o'zi asta bo'shaydi.",
     "Li-ion akkumulyator: sig'imi katta, kuchlanishi 3,7 V, lekin himoya sxemasi SHART — aks holda yong'in xavfi bor.",
     "Adapter: barqaror, cheksiz, lekin qurilma ko'chma bo'lmaydi va rozetkaga bog'liq.",
     "Powerbank: 5 V beradi, qulay, lekin tok kam bo'lsa o'zi o'chib qoladi."
    ]
   },
   {
    "title": "5.4. Manbani to'g'ri tanlash (4 daqiqa)",
    "points": [
     "Avval qurilmaning eng katta tokini hisoblang: hamma element bir vaqtda ishlaganda qancha tortadi.",
     "Keyin manba shu tokdan kamida 1,5 barobar ko'proq bera olishi kerak.",
     "Ishlash muddatini hisoblang: sig'im (mAh) / o'rtacha tok (mA) = soat.",
     "Motor va servo bor bo'lsa ular ALOHIDA manbadan quvvatlanadi, plata bilan faqat GND birlashtiriladi.",
     "Yig'ilgan qurilmada manba kuchlanishini yuk ostida multimetr bilan tekshirish odat bo'lishi kerak."
    ]
   },
   {
    "title": "5.5. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Li-ion akkumulyatorning nominal kuchlanishi qancha?  Javob: 3,7 V.",
     "Savol: Adapterdagi 5V 2A nimani bildiradi?  Javob: 5 volt kuchlanish, 2 ampergacha tok bera oladi."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: uch xil manbaning kuchlanishi va yuklamadagi cho'kishini o'lchab, jadval tuzish.",
     "Natija multimetr bilan tekshiriladi va qiymatlar ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Akkumulyatorni oddiy batareya deb hisoblab, uni to'g'ridan-to'g'ri manbaga ulash.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Tok manbalari: batareya, akkumulyator, adapter\" mavzusi bo'yicha bugungi sxemani daftarga chizib keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Li-ion akkumulyatorlarni sinfda o'quvchilarga bermang — noto'g'ri ishlatilsa yonish xavfi bor. Ular haqida faqat gapiring va tayyor korpusdagi power bankni ko'rsating.",
   "xato": "Akkumulyatorni oddiy batareya deb hisoblab, uni to'g'ridan-to'g'ri manbaga ulash."
  }
 },
 "6-B|5": {
  "maqsad": [
   "O'quvchilar \"Zanjir elementlari va ularning shartli belgilari\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani zanjirda amalda ko'radilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — 15 ta shartli belgini o'rganib, keyin har biri uchun HAQIQIY komponentni to'plamdan topib yoniga qo'yish; so'ng o'qituvchi bergan sxema bo'yicha zanjirni breadboardda yig'ish va u ishlaganini LED bilan tasdiqlash — mustaqil yig'a oladilar."
  ],
  "lugat": [
   "Elektr zanjiri (Circuit) – tok aylanib yuradigan yopiq yo'l",
   "Shart (Condition) – rost yoki yolg'on bo'lishiga qarab yo'l tanlash",
   "Belgi (Feature) – ma'lumotdan ajratilgan va model uchun muhim bo'lgan xususiyat",
   "Kuchlanish (Voltage) – zaryadni harakatlantiruvchi elektr bosimi, voltda o'lchanadi",
   "Elektr toki (Current) – zaryadlangan zarrachalarning yo'naltirilgan harakati, amperda o'lchanadi"
  ],
  "softSkill": "Muammoni bo'laklarga bo'lish — katta vazifani kichik, tekshiriladigan qadamlarga ajratish.",
  "resurslar": [
   "SET A — elektronika to'plami (breadboard, multimetr, komponentlar)",
   "Multimetr (har juftlikka bitta)",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Zanjir elementlari va ularning shartli belgilari\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Zanjir elementlari va ularning shartli belgilari — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Har bir komponentning xalqaro standart belgisi bor (IEC 60617). Bu belgilar tilga bog'liq emas.",
     "Asosiylari: rezistor — to'rtburchak; kondensator — ikki parallel chiziq (qutbli bo'lsa biri egri); diod — uchburchak va chiziq; tranzistor — doira ichida uch chiziq; kalit — uzilgan chiziq.",
     "Manba: uzun va kalta chiziq (uzun = musbat). Yer (GND) — uch pog'onali qisqaruvchi chiziqlar.",
     "Belgilarni yodlash shart, chunki sxemani o'qish kurs davomida har darsda kerak bo'ladi."
    ]
   },
   {
    "title": "5.3. Belgilarni guruhlab yodlash (4 daqiqa)",
    "points": [
     "MANBALAR: batareya, akkumulyator, quvvat manbai, GND.",
     "PASSIV ELEMENTLAR: rezistor, kondensator, g'altak, potensiometr.",
     "YARIMO'TKAZGICHLAR: diod, LED, stabilitron, tranzistor, fotorezistor.",
     "BOSHQARUV: kalit, tugma, rele.",
     "ISTE'MOLCHILAR: lampochka, motor, zummer.",
     "Guruhlab yodlash alohida-alohida yodlashdan ancha samarali."
    ]
   },
   {
    "title": "5.4. Belgilarni tanish mashqi (4 daqiqa)",
    "points": [
     "Kartochkalar tayyorlang: bir tomonda belgi, ikkinchisida nom.",
     "Juftlikda ishlang: bittasi belgini ko'rsatadi, ikkinchisi nomini aytadi.",
     "Keyin teskari: nom aytiladi, belgi chiziladi.",
     "Vaqt bilan sinov: 15 belgini necha soniyada tanib olish mumkin.",
     "Eng foydali mashq: tayyor sxemadagi hamma belgini nomlab chiqish."
    ]
   },
   {
    "title": "5.5. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Sxemada uzun chiziq manbaning qaysi qutbi?  Javob: Musbat.",
     "Savol: Nega belgilar xalqaro standartlashtirilgan?  Javob: Har mamlakat muhandisi bir-birining sxemasini tarjimasiz o'qishi uchun."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: 15 ta shartli belgini o'rganib, keyin har biri uchun HAQIQIY komponentni to'plamdan topib yoniga qo'yish; so'ng o'qituvchi bergan sxema bo'yicha zanjirni breadboardda yig'ish va u ishlaganini LED bilan tasdiqlash.",
     "Natija multimetr bilan tekshiriladi va qiymatlar ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Belgilarni o'zicha o'ylab chiqarish yoki kitobdagidan boshqacha chizish.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Zanjir elementlari va ularning shartli belgilari\" mavzusi bo'yicha bugungi sxemani daftarga chizib keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Belgilar kartochkasini tayyorlang va har darsning boshida 2 daqiqalik tez so'rov o'tkazing. Yodlash bir necha takrorlash bilan avtomatlashadi.",
   "xato": "Belgilarni o'zicha o'ylab chiqarish yoki kitobdagidan boshqacha chizish."
  }
 },
 "6-B|6": {
  "maqsad": [
   "O'quvchilar \"Printsipial sxemani o'qish\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani zanjirda amalda ko'radilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — berilgan uch sxemani og'zaki tavsiflab, qanday ishlashini tushuntirish — mustaqil yig'a oladilar."
  ],
  "lugat": [
   "Printsipial sxema (Schematic) – zanjirning shartli belgilar bilan chizilgan tasviri",
   "IP manzil – tarmoqdagi qurilmaning raqamli manzili",
   "Elektr zanjiri (Circuit) – tok aylanib yuradigan yopiq yo'l",
   "Kuchlanish (Voltage) – zaryadni harakatlantiruvchi elektr bosimi, voltda o'lchanadi",
   "Elektr toki (Current) – zaryadlangan zarrachalarning yo'naltirilgan harakati, amperda o'lchanadi"
  ],
  "softSkill": "Hujjatlashtirish odati — qilingan ishni yozib borish, keyin qayta tiklay olish.",
  "resurslar": [
   "SET A — elektronika to'plami (breadboard, multimetr, komponentlar)",
   "Multimetr (har juftlikka bitta)",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Printsipial sxemani o'qish\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Printsipial sxemani o'qish — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Sxemani o'qish tartibi: 1) manbani topish, 2) tokning yo'lini kuzatish, 3) har tarmoqni alohida ko'rib chiqish, 4) boshqaruv elementlarini aniqlash.",
     "Sxemada tok yo'nalishi odatda yuqoridan pastga, chapdan o'ngga chiziladi. Bu o'qishni osonlashtiradigan kelishuv.",
     "Nuqta bilan kesishgan simlar ulangan, nuqtasiz kesishganlari ulanmagan. Zamonaviy sxemalarda ulanmagan simlar ko'pincha umuman kesishtirilmaydi.",
     "Sxemani \"gapirib\" o'qish foydali: \"manbadan tok R1 orqali tranzistor bazasiga boradi...\""
    ]
   },
   {
    "title": "5.3. O'qish tartibi (4 daqiqa)",
    "points": [
     "1) Manbani toping: kuchlanishi qancha, plyus va GND qayerda.",
     "2) Signal yo'lini kuzating: kirishdan chiqishgacha.",
     "3) Har bir komponentning vazifasini aniqlang.",
     "4) Qiymatlarni yozib oling: rezistorlar, kondensatorlar.",
     "5) Kritik joylarni belgilang: qutbli komponentlar, mos kelmaydigan kuchlanishlar."
    ]
   },
   {
    "title": "5.4. Sxemadan breadboardga o'tish (4 daqiqa)",
    "points": [
     "Sxema joylashuvni ko'rsatmaydi — uni o'zingiz o'ylab topasiz.",
     "Avval sxemadagi har bir tugunga (bog'langan nuqtalar guruhiga) breadboardda bitta qator ajrating.",
     "Keyin komponentlarni shu qatorlarga ulang.",
     "Har bir ulanishni sxemada belgilab boring — shunda hech biri qolib ketmaydi.",
     "Yig'ilgach, sxema bo'yicha qaytadan tekshirib chiqing."
    ]
   },
   {
    "title": "5.5. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Sxema o'qishni nimadan boshlash kerak?  Javob: Manbani topishdan.",
     "Savol: Kesishgan simlarda nuqta bo'lsa nima degani?  Javob: Ular o'zaro ulangan."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: berilgan uch sxemani og'zaki tavsiflab, qanday ishlashini tushuntirish.",
     "Natija multimetr bilan tekshiriladi va qiymatlar ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Sxemani rasm sifatida ko'rib, joylashuvni ulanish deb tushunish.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Printsipial sxemani o'qish\" mavzusi bo'yicha bugungi sxemani daftarga chizib keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Har bir o'quvchi sxemani OVOZ CHIQARIB o'qib bersin. Ovoz chiqarib o'qish tushunmagan joyni darhol ochib beradi.",
   "xato": "Sxemani rasm sifatida ko'rib, joylashuvni ulanish deb tushunish."
  }
 },
 "6-B|7": {
  "maqsad": [
   "O'quvchilar \"Sxemani chizish: o'z zanjiringni qog'ozda\" mavzusining asosiy tushunchalarini tushunadilar.",
   "O'quvchilar bu tushunchani zanjirda amalda ko'radilar va natijani izohlay oladilar.",
   "O'quvchilar amaliy ishni — breadboardda yig'ilgan zanjirni sxemaga aylantirib chizish — mustaqil yig'a oladilar."
  ],
  "lugat": [
   "Elektr zanjiri (Circuit) – tok aylanib yuradigan yopiq yo'l",
   "Printsipial sxema (Schematic) – zanjirning shartli belgilar bilan chizilgan tasviri",
   "Kuchlanish (Voltage) – zaryadni harakatlantiruvchi elektr bosimi, voltda o'lchanadi",
   "Elektr toki (Current) – zaryadlangan zarrachalarning yo'naltirilgan harakati, amperda o'lchanadi",
   "Rezistor (Resistor) – tokni cheklovchi komponent, qiymati omda"
  ],
  "softSkill": "Mustaqillik — yordam so'rashdan oldin o'zi tekshirib ko'rish tartibiga rioya qilish.",
  "resurslar": [
   "SET A — elektronika to'plami (breadboard, multimetr, komponentlar)",
   "Multimetr (har juftlikka bitta)",
   "Proyektor va taqdimot slaydlari",
   "Doska va marker (sxema chizish uchun)",
   "O'quvchilar uchun ish daftari (logbook)"
  ],
  "nazariya": [
   {
    "title": "5.1. Takrorlash va bugungi savol (4 daqiqa)",
    "points": [
     "O'tgan darsdagi asosiy natija qisqa takrorlanadi.",
     "Bugungi mavzu — \"Sxemani chizish: o'z zanjiringni qog'ozda\" — nima uchun kerakligi hayotiy misol bilan bog'lanadi."
    ]
   },
   {
    "title": "5.2. Sxemani chizish: o'z zanjiringni qog'ozda — asosiy tushuncha (8 daqiqa)",
    "points": [
     "Yig'ilgan zanjirdan sxema chizish tartibi: har bir ulanishni topib, komponentlar orasidagi bog'lanishlar ro'yxatini tuzish, keyin uni tartibli chizmaga aylantirish.",
     "Chizmada joylashuv erkin: komponentni istalgan joyga qo'yish mumkin, faqat ulanishlar to'g'ri bo'lsin.",
     "Yaxshi sxemada simlar kam kesishadi va o'qish yo'nalishi (chapdan o'ngga) saqlanadi.",
     "Har komponentga belgi va nominal yoziladi: R1 220 Om, D1 LED qizil, Q1 BC547."
    ]
   },
   {
    "title": "5.3. Chizmadan yig'ishga (4 daqiqa)",
    "points": [
     "Chizma tugagach, uni boshqa o'quvchiga berib tekshirtiring — u tushuna oladimi.",
     "Keyin chizma bo'yicha zanjirni yig'ing va CHIZMANI o'zgartirmasdan ishlating.",
     "Yig'ishda muammo chiqsa — bu chizmada kamchilik borligini bildiradi, uni chizmada tuzating.",
     "Yakuniy chizma ish daftariga tozalab ko'chiriladi."
    ]
   },
   {
    "title": "5.4. Chizmani hujjat sifatida saqlash (4 daqiqa)",
    "points": [
     "Sana, muallif va qurilma nomi yoziladi.",
     "Komponentlar ro'yxati alohida jadvalda beriladi.",
     "O'lchangan qiymatlar chizma yoniga yoziladi.",
     "Keyingi versiyada nima o'zgargani belgilanadi.",
     "Bu odat chorak loyihasini hujjatlashtirishda katta vaqt tejaydi."
    ]
   },
   {
    "title": "5.5. Tushunganini tekshirish (4 daqiqa)",
    "points": [
     "Savol: Sxemada komponentlar joylashuvi muhimmi?  Javob: Yo'q, faqat ulanishlar to'g'ri bo'lishi kerak.",
     "Savol: Q1 belgisi odatda nimani bildiradi?  Javob: Tranzistorni."
    ]
   }
  ],
  "amaliy": [
   {
    "title": "6.1. Tayyorgarlik (5 daqiqa)",
    "points": [
     "Kerakli komponentlar tanlanadi va ish o'rni tayyorlanadi.",
     "Juftliklar vazifani o'zaro bo'lib oladilar."
    ]
   },
   {
    "title": "6.2. Amaliy ish (15 daqiqa)",
    "points": [
     "Bajariladigan ish: breadboardda yig'ilgan zanjirni sxemaga aylantirib chizish.",
     "Natija multimetr bilan tekshiriladi va qiymatlar ish daftariga yoziladi."
    ]
   },
   {
    "title": "6.3. Tekshirish va tuzatish (8 daqiqa)",
    "points": [
     "Ko'p uchraydigan xato: Sxemani breadboarddagi joylashuvni aynan takrorlab chizish.",
     "Natija ish daftariga yoziladi: nima qilindi, nima chiqdi."
    ]
   }
  ],
  "uyga": [
   "\"Sxemani chizish: o'z zanjiringni qog'ozda\" mavzusi bo'yicha bugungi sxemani daftarga chizib keling.",
   "Bugungi darsda tushunilmagan bitta savolni yozib keling."
  ],
  "qollanma": {
   "matn": "Bir xil zanjirni ikki o'quvchi chizib, sxemalarini solishtirsin. Turli ko'rinishdagi ikki sxema bir xil zanjirni ifodalashi mumkinligi muhim kashfiyot bo'ladi.",
   "xato": "Sxemani breadboarddagi joylashuvni aynan takrorlab chizish."
  }
 }
};
