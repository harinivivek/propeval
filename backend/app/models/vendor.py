import uuid
from sqlalchemy import Enum as SQLEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
from app.models.enums import ServiceType, VendorRole


class Vendor(BaseModel):
    __tablename__ = "vendors"
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(255))
    office_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    office_area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    services: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    users: Mapped[list["VendorUser"]] = relationship(back_populates="vendor")
    service_areas: Mapped[list["ServiceArea"]] = relationship(back_populates="vendor")


class VendorUser(BaseModel):
    __tablename__ = "vendor_users"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    role: Mapped[VendorRole] = mapped_column(SQLEnum(VendorRole))
    vendor: Mapped[Vendor] = relationship(back_populates="users")


class ServiceArea(BaseModel):
    __tablename__ = "service_areas"
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    city: Mapped[str] = mapped_column(String(255))
    areas: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    service_type: Mapped[ServiceType] = mapped_column(SQLEnum(ServiceType))
    vendor: Mapped[Vendor] = relationship(back_populates="service_areas")
