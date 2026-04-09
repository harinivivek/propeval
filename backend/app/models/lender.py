import uuid
from sqlalchemy import Enum as SQLEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
from app.models.enums import LenderRole


class Lender(BaseModel):
    __tablename__ = "lenders"
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    branches: Mapped[list["LenderBranch"]] = relationship(back_populates="lender")
    users: Mapped[list["LenderUser"]] = relationship(back_populates="lender")


class LenderBranch(BaseModel):
    __tablename__ = "lender_branches"
    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    name: Mapped[str] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lender: Mapped[Lender] = relationship(back_populates="branches")


class LenderUser(BaseModel):
    __tablename__ = "lender_users"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    branch_ids: Mapped[list[str] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    role: Mapped[LenderRole] = mapped_column(SQLEnum(LenderRole))
    lender: Mapped[Lender] = relationship(back_populates="users")
