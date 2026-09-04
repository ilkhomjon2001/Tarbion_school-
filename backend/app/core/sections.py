"""Boʻlimlar reyestri — kim nimani KOʻRADI (T-005).

Tizimdagi har bir boʻlim shu yerda roʻyxatga olinadi. Super administrator
foydalanuvchiga qaysi boʻlim koʻrinishini shu roʻyxatdan belgilaydi.

Model ikki qavatli, `frontend/src/lib/access.ts` bilan bir xil:

  1. **Rol boʻyicha standart** — yangi foydalanuvchi oʻz kabinetidagi
     hamma narsani oladi.
  2. **Foydalanuvchi darajasidagi istisno** — super admin bitta odam
     uchun boʻlimni yoqadi yoki oʻchiradi (`users.section_overrides`).

MUHIM farq: bu yerdagi roʻyxat HIMOYA. Frontenddagi nusxa faqat menyuni
chizadi (CLAUDE.md 7-qoida). Ikkalasi bir xil boʻlishi shart — biri
oʻzgarsa ikkinchisi ham oʻzgaradi.

Boʻlim koʻrinishi bilan AMAL bajarish boshqa narsa: "kim nima qila
oladi" — `models/identity.py` dagi `Permission`.
"""

from dataclasses import dataclass

from app.models import RoleName

#: Kabinetga ega rollar. Superadmin admin kabinetida ishlaydi.
CABINET_OF_ROLE: dict[str, str] = {
    RoleName.STUDENT.value: "student",
    RoleName.TEACHER.value: "teacher",
    RoleName.HOMEROOM_TEACHER.value: "teacher",
    RoleName.PARENT.value: "parent",
    RoleName.DIRECTOR.value: "director",
    RoleName.ACADEMIC.value: "academic",
    RoleName.ADMIN.value: "admin",
    RoleName.SUPERADMIN.value: "admin",
}


@dataclass(frozen=True, slots=True)
class Section:
    #: Manzilning oʻzi — barqaror va takrorlanmas.
    id: str
    label: str
    cabinet: str
    #: Kabinet boshi — oʻchirib boʻlmaydi, aks holda odam oʻz kabinetiga
    #: kira olmay qoladi.
    locked: bool = False
    #: Faqat super administrator koʻradi.
    superadmin_only: bool = False


SECTIONS: list[Section] = [
    # ── Oʻquvchi ──
    Section("/student", "Bosh sahifa", "student", locked=True),
    Section("/student/schedule", "Jadval", "student"),
    Section("/student/homework", "Uy vazifasi", "student"),
    Section("/student/tests", "Testlar", "student"),
    Section("/student/grades", "Baholar", "student"),
    Section("/student/ustozlar", "Ustozlar", "student"),
    Section("/student/reyting", "Reyting", "student"),
    Section("/student/announcements", "Eʼlonlar", "student"),
    # ── Ustoz ──
    Section("/teacher", "Bugungi darslar", "teacher", locked=True),
    Section("/teacher/jadval", "Dars jadvali", "teacher"),
    # DAV-02: sinf rahbari butun kunni bitta ekranda belgilaydi.
    Section("/teacher/davomat", "Kunlik davomat", "teacher"),
    Section("/teacher/vazifa", "Uy vazifasi", "teacher"),
    Section("/teacher/jurnal", "Sinf jurnali", "teacher"),
    Section("/teacher/reja", "Dars rejasi", "teacher"),
    Section("/teacher/test", "Testlar", "teacher"),
    Section("/teacher/elon", "Eʼlonlar", "teacher"),
    Section("/teacher/murojaat", "Murojaatlar", "teacher"),
    Section("/teacher/tarbiya", "Tarbiyaviy izoh", "teacher"),
    # ── Ota-ona ──
    Section("/ota-ona", "Bosh sahifa", "parent", locked=True),
    Section("/ota-ona/davomat", "Davomat", "parent"),
    Section("/ota-ona/baholar", "Baholar", "parent"),
    Section("/ota-ona/vazifalar", "Uy vazifasi", "parent"),
    Section("/ota-ona/tolov", "Toʻlov", "parent"),
    Section("/ota-ona/murojaat", "Murojaat", "parent"),
    Section("/ota-ona/tarbiya", "Tarbiya va psixologiya", "parent"),
    Section("/ota-ona/oshxona", "Oshxona menyusi", "parent"),
    Section("/ota-ona/elonlar", "Eʼlonlar", "parent"),
    Section("/ota-ona/sorovnoma", "Soʻrovnoma", "parent"),
    # ── Rahbariyat ──
    Section("/rahbar", "Bosh sahifa", "director", locked=True),
    Section("/rahbar/jadval", "Dars jadvali", "director"),
    Section("/rahbar/sinflar", "Sinflar", "director"),
    Section("/rahbar/murojaatlar", "Murojaatlar", "director"),
    Section("/rahbar/elonlar", "Eʼlonlar", "director"),
    Section("/rahbar/ustozlar", "Ustozlar", "director"),
    Section("/rahbar/tolovlar", "Toʻlovlar", "director"),
    Section("/rahbar/hisobotlar", "Hisobotlar", "director"),
    # ── Oʻquv boʻlimi ──
    Section("/oquv-bolim", "Bosh sahifa", "academic", locked=True),
    Section("/oquv-bolim/imtihonlar", "Imtihonlar", "academic"),
    Section("/oquv-bolim/natijalar", "Natijalar", "academic"),
    Section("/oquv-bolim/rejalar", "Reja tasdiqlash", "academic"),
    Section("/oquv-bolim/metodika", "Metodik baza", "academic"),
    Section("/oquv-bolim/elonlar", "Eʼlonlar", "academic"),
    Section("/oquv-bolim/sifat", "Sifat nazorati", "academic"),
    Section("/oquv-bolim/ustozlar", "Ustozlar faoliyati", "academic"),
    # ── Administrator ──
    Section("/admin", "Bosh sahifa", "admin", locked=True),
    Section("/admin/oquvchilar", "Oʻquvchilar", "admin"),
    Section("/admin/lidlar", "Lidlar", "admin"),
    Section("/admin/qabul", "Qabul", "admin"),
    Section("/admin/shartnomalar", "Shartnomalar", "admin"),
    Section("/admin/qongiroqlar", "Qoʻngʻiroqlar", "admin"),
    Section("/admin/tolovlar", "Toʻlovlar", "admin"),
    Section("/admin/kadrlar", "Kadrlar", "admin"),
    Section("/admin/malumotnomalar", "Maʼlumotnomalar", "admin"),
    Section("/admin/murojaatlar", "Murojaatlar", "admin"),
    Section("/admin/elonlar", "Eʼlonlar", "admin"),
    Section("/admin/sorovnomalar", "Soʻrovnomalar", "admin"),
    Section("/admin/baza", "Maʼlumot bazasi", "admin"),
    Section("/admin/audit", "Audit jurnali", "admin"),
    Section("/admin/sozlamalar", "Sozlamalar", "admin", locked=True, superadmin_only=True),
]

BY_ID: dict[str, Section] = {s.id: s for s in SECTIONS}


def cabinet_of(roles: set[str]) -> str:
    """Foydalanuvchi qaysi kabinetni ochadi.

    Tartib ataylab: sinf rahbari ham ustoz, super administrator ham
    administrator kabinetida ishlaydi. Eng keng huquqli rol birinchi
    tekshiriladi — aks holda superadmin oʻquvchi kabinetiga tushib
    qolardi.
    """
    for rol in (
        RoleName.SUPERADMIN.value,
        RoleName.ADMIN.value,
        RoleName.DIRECTOR.value,
        RoleName.ACADEMIC.value,
        RoleName.TEACHER.value,
        RoleName.HOMEROOM_TEACHER.value,
        RoleName.PARENT.value,
        RoleName.STUDENT.value,
    ):
        if rol in roles:
            return CABINET_OF_ROLE[rol]
    return "student"


def role_default_sections(roles: set[str]) -> list[str]:
    """Rol boʻyicha standart boʻlimlar — oʻz kabinetidagi hamma narsa.

    Super administrator BARCHA kabinetlarni koʻradi: u tizimni
    sozlaydi va har bir kabinet qanday koʻrinishini tekshira olishi
    kerak.
    """
    if RoleName.SUPERADMIN.value in roles:
        return [s.id for s in SECTIONS]

    kabinet = cabinet_of(roles)
    return [s.id for s in SECTIONS if s.cabinet == kabinet and not s.superadmin_only]


def effective_sections(roles: set[str], overrides: list[str] | None) -> list[str]:
    """Foydalanuvchi HAQIQATDA koʻradigan boʻlimlar.

    `overrides is None` — rol standarti. Roʻyxat berilgan boʻlsa u
    ishlatiladi, lekin ikkita qatʼiy qoida bilan:

      · kabinet boshi (`locked`) HAR DOIM qoʻshiladi — aks holda odam
        oʻz kabinetiga kira olmay qoladi;
      · `superadmin_only` boʻlim boshqa rolga OʻTMAYDI, hatto super
        admin uni qoʻlda yoqib qoʻysa ham.
    """
    ruxsat = set(overrides if overrides is not None else role_default_sections(roles))

    kabinet = cabinet_of(roles)
    for s in SECTIONS:
        if s.locked and s.cabinet == kabinet:
            if s.superadmin_only and RoleName.SUPERADMIN.value not in roles:
                continue
            ruxsat.add(s.id)

    if RoleName.SUPERADMIN.value not in roles:
        for s in SECTIONS:
            if s.superadmin_only:
                ruxsat.discard(s.id)

    # Nomaʼlum id (eski override, boʻlim oʻchirilgan) tashlab yuboriladi.
    return [s.id for s in SECTIONS if s.id in ruxsat]


def unknown_sections(ids: list[str]) -> list[str]:
    """Reyestrda yoʻq boʻlim id lari."""
    return sorted(set(ids) - set(BY_ID))
