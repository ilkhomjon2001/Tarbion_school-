# Git bilan ishlash — Tarbion

Ikki kishi ishlaymiz. Qoida bitta: **`main` hech qachon buzilmaydi.**
`main` ga to'g'ridan-to'g'ri push qilinmaydi — faqat PR orqali.

---

## 1. Bir marta sozlash (har bir kompyuterda)

```bash
git config --global user.name "Ism Familiya"
git config --global user.email "<GitHub noreply email>"
git config --global core.autocrlf false
git config --global core.longpaths true
```

Repo ichida (klon qilgandan keyin, bir marta):

```bash
git config pull.rebase true          # pull merge commit yasamaydi
git config fetch.prune true          # o'chirilgan branch'lar tozalanadi
git config push.autoSetupRemote true # yangi branch'ni -u siz push qilish
git config rerere.enabled true       # konflikt yechimini eslab qoladi
git config rerere.autoupdate true
git config merge.conflictstyle zdiff3 # konflikt belgilari tushunarli bo'ladi
git config diff.algorithm histogram   # diff aniqroq, soxta konflikt kam
git config rebase.autoStash true
```

GitHub noreply email'ingizni bilish uchun: `gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"'`
Repo ochiq, shuning uchun shaxsiy email commit tarixiga yozilmasin.

---

## 2. Kundalik oqim

### Yangi task boshlashda

```bash
git checkout main
git pull                    # rebase bilan tortadi
git checkout -b feat/T-013-attendance
```

**Har doim yangi branch main'dan olinadi.** Boshqa branch ustiga qurmang.

### Ish davomida

```bash
git add -p                  # nima qo'shayotganingizni ko'rib qo'shing
git commit -m "feat(attendance): DAV-01 davomat modeli"
git push
```

Kuniga kamida bir marta main'dagi yangilikni o'zingizga torting:

```bash
git fetch origin
git rebase origin/main
```

Bu muhim — kech qolgan branch qancha uzoq yashasa, konflikt shuncha og'ir bo'ladi.

### Tugaganda

```bash
git fetch origin && git rebase origin/main   # oxirgi marta
pytest -q                                    # testlar o'tishi shart
git push --force-with-lease                  # rebase'dan keyin
gh pr create --fill
```

PR'ni hamkasb ko'rib chiqadi (yoki shoshilinch bo'lsa o'zingiz):

```bash
gh pr merge --squash --delete-branch
```

Merge'dan keyin:

```bash
git checkout main && git pull
```

---

## 3. Branch nomlari

| Prefiks | Qachon | Misol |
|---|---|---|
| `feat/` | yangi funksiya | `feat/T-013-attendance` |
| `fix/` | xato tuzatish | `fix/T-013-timezone` |
| `chore/` | sozlama, hujjat | `chore/git-setup` |

Har doim task kodi bilan — `T-013`. Kim nima ustida ishlayotgani branch ro'yxatidan ko'rinadi:

```bash
git branch -r
```

---

## 4. Commit xabari

```
feat(attendance): DAV-01 davomat belgilash endpoint'i
^    ^            ^
tur  modul        TZ kodi + qisqa tavsif
```

Turlar: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
**Bitta commit = bitta mantiqiy o'zgarish.** Butun kunlik ishni bitta commitga tashlamang.

---

## 5. Konflikt chiqsa

Vahima yo'q. Rebase paytida:

```bash
git status                  # qaysi fayl konfliktda
# faylni ochib <<<<<<< ||||||| ======= >>>>>>> belgilarini yeching
git add <fayl>
git rebase --continue
```

`zdiff3` yoqilgani uchun konfliktda uch qism ko'rinadi:
`<<<<<<<` sizniki · `|||||||` **asl holat** · `=======` main'dagi · `>>>>>>>`
O'rtadagi asl holat kim nimani o'zgartirganini aniq ko'rsatadi.

Butunlay chalkashib ketsangiz — orqaga qaytish har doim mumkin:

```bash
git rebase --abort
```

**Lock fayl konflikti** (`pnpm-lock.yaml`, `uv.lock`) — qo'lda tuzatilmaydi:

```bash
git checkout --theirs pnpm-lock.yaml && pnpm install
git add pnpm-lock.yaml
```

---

## 6. Qilma

- ❌ `main` ga to'g'ridan-to'g'ri push
- ❌ `git push --force` (faqat `--force-with-lease`, faqat o'z branch'ingizga)
- ❌ Hamkasbning branch'iga push
- ❌ Bir haftadan uzoq yashagan branch — bo'lib tashlang
- ❌ `.env` ni commit qilish (`.gitignore` to'sadi, lekin `-f` bilan majburlamang)
- ❌ Migratsiyani tahrirlash — main'ga tushgan migratsiya o'zgarmaydi, yangisini yozing

---

## 7. Ikkalamiz bir faylga tegsak

Ish task bo'yicha bo'lingan, papka bo'yicha emas — demak kesishish bo'ladi.
Kesishuv ehtimoli yuqori fayllar:

| Fayl | Nima qilish |
|---|---|
| `TASKS.md` | Faqat **o'z** taskingiz katakchasini belgilang, qatorlarni ko'chirmang |
| `backend/app/main.py` | Router ulashni bitta qatorda qiling, tartibni o'zgartirmang |
| `alembic/versions/` | Ikkalangiz migratsiya yozsangiz `down_revision` to'qnashadi — main'ni tortib, keyin generatsiya qiling |
| `frontend/src/app/layout.tsx` | O'zgartirishdan oldin ayting |
| `.env.example` | Yangi kalitni **oxiriga** qo'shing |

Umumiy qoida: **katta refactor'dan oldin ayting.** 10 soniyalik xabar 2 soatlik konfliktdan arzon.
