from decimal import Decimal

from sqlalchemy import Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Locality(BaseModel):
    __tablename__ = "localities"
    __table_args__ = (
        UniqueConstraint("name", "pin_code", name="uq_locality_name_pin_code"),
    )

    name: Mapped[str] = mapped_column(String(255))
    pin_code: Mapped[str] = mapped_column(String(10), index=True)
    city: Mapped[str] = mapped_column(String(255), index=True)
    state: Mapped[str] = mapped_column(String(255))
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    lng: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
