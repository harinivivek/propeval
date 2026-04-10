import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    PropertyType,
    ReportCategory,
    ReportStatus,
    UserType,
)
from app.models.report import Report
from app.models.user import Organization
from app.models.vendor import Vendor
from app.services.ocr.base import ExtractionResult
from app.services.ocr.ocr_service import OcrService


async def _create_test_report(db: AsyncSession) -> tuple[Vendor, Report]:
    vendor_org = Organization(name="TestVendor", type=UserType.VENDOR, city="Mumbai")
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name="TestVendor")
    db.add(vendor)
    await db.flush()

    report = Report(
        vendor_id=vendor.id,
        report_category=ReportCategory.VALUATION,
        status=ReportStatus.UPLOADED,
        property_address="123 Main St",
        city="Mumbai",
        property_type=PropertyType.RESIDENTIAL,
        uploaded_file_path="reports/test/report.pdf",
    )
    db.add(report)
    await db.flush()
    return vendor, report


@pytest.mark.asyncio
async def test_ocr_service_process_success(db_session: AsyncSession):
    _, report = await _create_test_report(db_session)

    mock_result = ExtractionResult(
        anchor_fields={
            "property_address": {"value": "123 Main St", "confidence": 0.95, "type": "text"},
            "valuation_amount": {"value": 5000000, "confidence": 0.90, "type": "currency"},
        },
        additional_fields={"plot_number": {"value": "A-1", "confidence": 0.80, "type": "text"}},
        raw_text="extracted text",
        page_count=3,
        usage={"input_tokens": 5000, "output_tokens": 300},
    )

    mock_provider = AsyncMock()
    mock_provider.extract = AsyncMock(return_value=mock_result)

    service = OcrService(provider=mock_provider)
    await service.process_report(db_session, report)

    assert report.status == ReportStatus.READY_TO_PUBLISH
    assert report.content_json is not None
    assert report.content_json["anchor_fields"]["property_address"]["value"] == "123 Main St"
    assert report.content_json["extraction_version"] == 1
    assert report.content_json["provider"] == "claude"


@pytest.mark.asyncio
async def test_ocr_service_process_failure(db_session: AsyncSession):
    _, report = await _create_test_report(db_session)

    mock_provider = AsyncMock()
    mock_provider.extract = AsyncMock(side_effect=Exception("API error"))

    service = OcrService(provider=mock_provider)
    await service.process_report(db_session, report)

    assert report.status == ReportStatus.EXTRACTION_FAILED
    assert report.content_json is None
