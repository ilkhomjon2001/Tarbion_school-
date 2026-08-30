"""Login yasash (T-003).

Bu testlar bazaga tegmaydi — `naming.py` sof funksiyalar.
"""

import pytest

from app.core.naming import MAX_LOGIN_LENGTH, build_login, login_variant, transliterate


@pytest.mark.parametrize(
    ("kirish", "kutilgan"),
    [
        ("Aliyev", "aliyev"),
        # Oʻzbek apostroflari tashlab yuboriladi
        ("Gʻofurov", "gofurov"),
        ("Oʻrolov", "orolov"),
        ("Saʼdulla", "sadulla"),
        ("O'ktam", "oktam"),
        ("Sa'dullayev", "sadullayev"),
        # sh va ch allaqachon ASCII
        ("Shukurov", "shukurov"),
        ("Ochilov", "ochilov"),
        # Kirillcha
        ("Алиев", "aliev"),
        ("Ўролов", "orolov"),
        ("Ғофуров", "gofurov"),
        ("Қодиров", "qodirov"),
        # Boʻshliq, defis, nuqta tozalanadi
        ("Abdulla  Yusuf", "abdullayusuf"),
        ("Mirzo-Ulugʻbek", "mirzoulugbek"),
    ],
)
def test_transliteratsiya(kirish: str, kutilgan: str) -> None:
    assert transliterate(kirish) == kutilgan


def test_login_familiya_ism_shaklida() -> None:
    assert build_login("Aliyev", "Sardor") == "aliyev.sardor"


def test_login_ozbek_belgilari_bilan() -> None:
    assert build_login("Gʻofurov", "Oʻktam") == "gofurov.oktam"


def test_login_kirillcha_ism_bilan() -> None:
    assert build_login("Алиев", "Сардор") == "aliev.sardor"


def test_login_bosh_ism_bilan_ham_yasaladi() -> None:
    """Bir qismi boʻsh boʻlsa ikkinchisidan yasaladi — nuqta osilib qolmaydi."""
    assert build_login("Aliyev", "") == "aliyev"
    assert build_login("", "Sardor") == "sardor"


def test_ikkalasi_bosh_bolsa_xato() -> None:
    with pytest.raises(ValueError, match="login yasab"):
        build_login("", "")


def test_yozib_bolmaydigan_belgilar_ham_xato() -> None:
    """Faqat belgi kiritilsa login qolmaydi — jimgina boʻsh qaytmasin."""
    with pytest.raises(ValueError):
        build_login("---", "...")


def test_variant_raqam_qoshadi() -> None:
    assert login_variant("aliyev.sardor", 1) == "aliyev.sardor"
    assert login_variant("aliyev.sardor", 2) == "aliyev.sardor2"
    assert login_variant("aliyev.sardor", 17) == "aliyev.sardor17"


def test_uzun_login_kesiladi_lekin_raqam_qoladi() -> None:
    """Raqam kesilib ketsa loginlar bir xil boʻlib qolardi."""
    uzun = "a" * 100
    natija = login_variant(uzun, 42)
    assert len(natija) == MAX_LOGIN_LENGTH
    assert natija.endswith("42")


def test_asosiy_login_ham_chegaradan_oshmaydi() -> None:
    natija = build_login("f" * 80, "i" * 80)
    assert len(natija) <= MAX_LOGIN_LENGTH
