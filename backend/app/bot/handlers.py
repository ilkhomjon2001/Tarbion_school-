"""Bot buyruqlari (T-017, BOT-01).

Bu fayl — QOBIQ. Hech qanday tekshiruv shu yerda qilinmaydi: telefonni
solishtirish, kodni tekshirish, huquq — hammasi
`telegram_link_service` va `access.py` da (X-8).

Bot foydalanuvchidan kelgan hech narsani ishonchli deb qabul qilmaydi.
U faqat bitta narsani biladi: soʻrov qaysi `telegram_id` dan keldi.
Uni Telegram oʻzi qoʻyadi, foydalanuvchi soxtalashtira olmaydi.
"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

from app.core.db import SessionFactory
from app.services import telegram_link_service as link_service

router = Router()


class Ulanish(StatesGroup):
    telefon = State()
    kod = State()


_TELEFON_TUGMA = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="Raqamimni yuborish", request_contact=True)]],
    resize_keyboard=True,
    one_time_keyboard=True,
)

_SALOM = (
    "Assalomu alaykum! Bu — Tarbion maktabining rasmiy boti.\n\n"
    "Bu yerga farzandingizning davomati, baholari va maktab eʼlonlari keladi.\n\n"
    "Ulanish uchun ikki narsa kerak:\n"
    "1. Telefon raqamingiz — pastdagi tugma orqali;\n"
    "2. Kabinetingizdagi bir martalik kod.\n\n"
    "Kodni olish: saytga kiring → «Profil» → «Telegramga ulash»."
)


@router.message(CommandStart())
async def start(message: Message, state: FSMContext) -> None:
    if message.from_user is None:
        return
    async with SessionFactory() as session:
        user = await link_service.linked_user(session, message.from_user.id)

    if user is not None:
        # Ulangan odam qayta roʻyxatdan oʻtmaydi (BOT-01 mezoni).
        await state.clear()
        await message.answer(
            f"Siz allaqachon ulangansiz: {user.full_name}.\n\n"
            "Bogʻlanishni uzish uchun /uzish yuboring.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    await state.set_state(Ulanish.telefon)
    await message.answer(_SALOM, reply_markup=_TELEFON_TUGMA)


@router.message(Ulanish.telefon, F.contact)
async def telefon_qabul(message: Message, state: FSMContext) -> None:
    """Contact tugmasi orqali kelgan raqam.

    `contact.user_id` tekshiriladi: Telegram boshqa odamning kontaktini
    yuborishga ham ruxsat beradi, va usiz istalgan kishi ota-onaning
    raqamini topib, uning nomidan ulanishga urinardi.
    """
    if message.contact is None or message.from_user is None:
        return
    if message.contact.user_id != message.from_user.id:
        await message.answer(
            "Iltimos, OʻZ raqamingizni yuboring — tugmani bosing, "
            "boshqa odamning kontaktini emas.",
            reply_markup=_TELEFON_TUGMA,
        )
        return

    await state.update_data(phone=message.contact.phone_number)
    await state.set_state(Ulanish.kod)
    await message.answer(
        "Rahmat. Endi kabinetingizdan olgan 6 raqamli kodni yuboring.\n\n"
        "Kod yoʻqmi? Saytga kiring → «Profil» → «Telegramga ulash».",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(Ulanish.telefon)
async def telefon_kutilmoqda(message: Message) -> None:
    """Raqamni qoʻlda yozishga urinish.

    Qoʻlda yozilgan raqam hech narsani isbotlamaydi — istalgan kishi
    istalgan raqamni yozishi mumkin. Faqat tugma qabul qilinadi.
    """
    await message.answer(
        "Raqamni qoʻlda yozib boʻlmaydi — pastdagi tugmani bosing. "
        "Shunda Telegram raqamingizni oʻzi tasdiqlaydi.",
        reply_markup=_TELEFON_TUGMA,
    )


@router.message(Ulanish.kod, F.text)
async def kod_qabul(message: Message, state: FSMContext) -> None:
    if message.from_user is None or message.text is None:
        return
    data = await state.get_data()
    telefon = data.get("phone")
    if not telefon:
        await state.clear()
        await message.answer("Boshidan boshlaymiz: /start")
        return

    async with SessionFactory() as session:
        try:
            user = await link_service.link(
                session,
                phone=telefon,
                code=message.text,
                telegram_id=message.from_user.id,
            )
        except link_service.LinkError as e:
            # Xato matni servisdan keladi: odam nima qilishi kerakligini
            # bilsin, «xatolik yuz berdi» deb qolmasin.
            await message.answer(str(e))
            return

    await state.clear()
    await message.answer(
        f"Tayyor, {user.full_name}!\n\n"
        "Endi farzandingiz darsga kelmasa, yangi baho qoʻyilsa yoki maktab "
        "eʼlon chiqarsa — shu yerga xabar keladi.\n\n"
        "Bogʻlanishni uzish: /uzish"
    )


@router.message(Command("uzish"))
async def uzish(message: Message, state: FSMContext) -> None:
    if message.from_user is None:
        return
    await state.clear()
    async with SessionFactory() as session:
        uzildi = await link_service.unlink(session, message.from_user.id)

    if uzildi:
        await message.answer(
            "Bogʻlanish uzildi. Endi bu yerga xabar kelmaydi.\n\nQayta ulanish: /start",
            reply_markup=ReplyKeyboardRemove(),
        )
    else:
        await message.answer("Sizda ulangan hisob yoʻq. Ulanish: /start")


@router.message(Command("yordam"))
async def yordam(message: Message) -> None:
    await message.answer(
        "Buyruqlar:\n"
        "/start — botga ulanish\n"
        "/uzish — bogʻlanishni uzish\n"
        "/yordam — shu roʻyxat\n\n"
        "Savol yoki muammo boʻlsa maktab administratoriga murojaat qiling."
    )


@router.message()
async def boshqa(message: Message) -> None:
    """Tanilmagan xabar.

    Bot hozircha soʻrovlarga javob bermaydi (BOT-03 — 2-bosqich),
    shuning uchun odamni kutdirmasdan darhol aytamiz.
    """
    if message.from_user is None:
        return
    async with SessionFactory() as session:
        user = await link_service.linked_user(session, message.from_user.id)

    if user is None:
        await message.answer("Ulanish uchun /start yuboring.")
        return
    await message.answer(
        "Bu bot hozircha faqat xabar yuboradi.\n\n"
        "Baho, davomat va toʻlovni saytdagi kabinetingizdan koʻrasiz.\n"
        "Buyruqlar roʻyxati: /yordam"
    )
