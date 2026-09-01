"""Kadrlar sxemalari. Oylik shu javobda bor — modul `users.manage`
bilan yopiq va roʻyxat endpointi ochiq foydalanuvchiga chiqmaydi."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class EmployeeOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    login: str
    roles: list[str]
    phone: str | None
    position: str
    contract_type: str
    qualification: str
    hired_on: date | None
    base_salary: int | None
    note: str | None
    #: Bugun taʼtilda boʻlsa — turi.
    on_leave: str | None


class ProfileIn(BaseModel):
    position: str = Field(default="", max_length=80)
    contract_type: str = "toliq"
    qualification: str = "toifasiz"
    hired_on: date | None = None
    base_salary: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=300)


class LeaveOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    employee_name: str
    leave_type: str
    starts_on: date
    ends_on: date
    note: str | None
    created_at: datetime


class LeaveIn(BaseModel):
    user_id: uuid.UUID
    leave_type: str
    starts_on: date
    ends_on: date
    note: str | None = Field(default=None, max_length=200)
