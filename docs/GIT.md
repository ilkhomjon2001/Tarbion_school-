# Git tartibi — Tarbion

Ikki kishi ishlaydi. Tartib **robbitquiz** loyihasidagidek: ikkalamiz ham
toʻgʻridan-toʻgʻri `main` da ishlaymiz, branch va PR yoʻq. U yerda bu usul
muammosiz ishlagan, bu yerda ham shunday boʻladi — sharti bitta: **kunni
`git pull` bilan boshlash va push oldidan yana `pull` qilish.**

---

## 1. Bir marta sozlanadi

Yangi kompyuterda ishni boshlashdan oldin:

```bash
git config --global user.name  "Ism Familiya"
git config --global user.email "<id>+<login>@users.noreply.github.com"
```

Pochta **noreply** boʻlishi kerak — repo ochiq, shaxsiy pochta commit
tarixida abadiy qoladi.

Repo ichida (bir marta, `git clone` dan keyin):

```bash
cd Tarbion_school
git config pull.rebase false        # pull = merge, rebase emas
git config merge.autostash true     # tugallanmagan ish pull ga xalaqit bermasin
git config merge.conflictstyle zdiff3
git config rerere.enabled true      # bir marta yechilgan konflikt eslab qolinadi
git config rerere.autoupdate true
git config fetch.prune true
git config diff.algorithm histogram
```

Bular majburiy emas, lekin konfliktni ancha yengillashtiradi.

---

## 2. Kundalik ish

```bash
# 1. Kunni shu bilan boshla
git pull

# 2. Ishla, commit qil
git add -A
git commit -m "feat(attendance): DAV-01 davomat belgilash"

# 3. Push oldidan YANA pull
git pull
git push
```

Xolos. `force` **hech qachon kerak emas**.

`git pull` sherigingizning ishini sizniki ustiga qoʻshadi. Har xil fayllarga
tegilgan boʻlsa — oʻzi qoʻshib yuboradi, siz hech nima qilmaysiz.

---

## 3. Konflikt chiqsa

Bitta faylni ikkalangiz ham oʻzgartirgan boʻlsangiz `git pull` toʻxtaydi:

```
CONFLICT (content): Merge conflict in frontend/src/app/globals.css
```

Vahima yoʻq. Ish tartibi:

```bash
git status                    # qaysi fayl konfliktda
# faylni ochib, <<<<<<< va >>>>>>> orasidagi joyni toʻgʻrila
git add <fayl>
git commit                    # xabar tayyor turadi, shunchaki saqla
git push
```

**Muhim:** konfliktni yechayotganda **sherigingizning kodini oʻchirib
tashlamang.** Ikkalasi ham kerak boʻlsa — ikkalasini qoldiring. Tushunmasangiz
soʻrang, taxmin qilib oʻchirmang.

Chalkashib ketsangiz — orqaga qaytish mumkin:

```bash
git merge --abort             # pull dan oldingi holatga qaytadi
```

---

## 4. Bir-birimizni bosib ketmaslik uchun

Sozlama emas, kelishuv:

- **Ishni boshlashdan oldin `TASKS.md` da taskni `[~]` qiling va darhol push
  qiling.** Sherigingiz kimda nima ishda ekanini shundan koʻradi.
- Iloji boricha **har xil papkada** ishlang. Bir vaqtda bitta faylni
  ikkalangiz qayta yozmang.
- **Tez-tez push qiling.** Kuniga bir marta emas — har bir tugagan boʻlak
  push qilinsa, konflikt kichik boʻladi.
- Katta refactor (fayl koʻchirish, nom oʻzgartirish) qilishdan oldin
  sherigingizga ayting.

---

## 5. Commit xabari

```
feat(attendance): DAV-01 davomat belgilash
fix(auth): parolni tiklash havolasi muddati
style(ui): jadval qatorlari orasidagi masofa
docs(tasks): T-018 tayyor deb belgilandi
```

Tur, modul, TZ kodi. Bitta commit = bitta task.

---

## 6. Qilma

| Qilma | Sabab |
|---|---|
| `git push --force` / `--force-with-lease` | Sherigingizning commitini yoʻq qiladi. Bu tartibda umuman kerak emas. |
| `git reset --hard` push qilingan commitga | Yoʻqolgan ishni qaytarib boʻlmaydi. |
| Push qilingan commitni `rebase` qilish | Tarix oʻzgaradi, sherikda konflikt chiqadi. |
| `git commit -am` ni koʻr-koʻrona ishlatish | Nima qoʻshilayotganini bilmay qolasiz. `git status` ni koʻring. |
| Sekret, token, parolni commit qilish | Repo ochiq. Hammasi `.env` da, `.env.example` yangilanadi. |

---

## 7. Nimadir buzilsa

```bash
git log --oneline -20         # oxirgi commitlar
git reflog                    # BARCHA harakatlar, hatto "yoʻqolgan"lari ham
git checkout <hash>           # eski holatga qarab olish
```

`git reflog` deyarli hamma narsani qaytarishga imkon beradi. Biror narsa
yoʻqolgandek tuyulsa — avval shuni koʻring.
