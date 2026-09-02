"""Fon vazifalari.

Redis va Celery ishlatilmaydi (CLAUDE.md): navbat `notification_outbox`
jadvalida, ishchi esa oddiy sikl. Maktab hajmida (500 foydalanuvchi,
kuniga bir necha ming xabar) bu yetarli va bitta bogʻliqlik kamayadi.
"""
