# Phase 4: OCR & Report Processing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uploaded PDF reports are processed via Claude API to extract structured data, which vendors can review/edit before publishing.

**Architecture:** Service abstraction layer (`OcrProvider` base → `ClaudeOcrProvider` implementation) called by Celery tasks. Single-report OCR triggered on upload, bulk upload creates `BulkUploadJob` with batched processing. Extracted data stored in `Report.content_json` (JSONB). Vendor UI shows key-value edit form with confidence indicators and "View Original" PDF viewer.

**Tech Stack:** Python (anthropic SDK, PyMuPDF/fitz, pikepdf), Celery, FastAPI, Next.js/React, Tailwind/shadcn

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/bulk_upload.py` | BulkUploadJob model |
| `backend/app/services/ocr/__init__.py` | Package init |
| `backend/app/services/ocr/base.py` | OcrProvider ABC + ExtractionResult dataclass |
| `backend/app/services/ocr/claude_provider.py` | Claude API vision extraction |
| `backend/app/services/ocr/ocr_service.py` | Orchestrator: calls provider, saves results |
| `backend/app/jobs/ocr_tasks.py` | Celery tasks: single + batch OCR |
| `backend/app/api/vendor/reports.py` | Vendor report endpoints (bulk upload, edit, publish, retry) |
| `backend/app/schemas/bulk_upload.py` | BulkUploadJob Pydantic schemas |
| `backend/tests/services/test_ocr_service.py` | OCR service tests |
| `backend/tests/services/test_ocr_provider.py` | Claude provider tests (mocked API) |
| `backend/tests/api/test_vendor_reports.py` | Vendor report API tests |

### Backend — Modified Files
| File | Changes |
|------|---------|
| `backend/app/models/enums.py` | Add `EXTRACTION_FAILED` to ReportStatus, add `BulkUploadStatus` enum |
| `backend/app/models/__init__.py` | Register BulkUploadJob + new enums |
| `backend/app/core/config.py` | Add OCR settings (ANTHROPIC_API_KEY, OCR_MODEL, etc.) |
| `backend/app/core/constants.py` | Add OCR + validation constants |
| `backend/app/schemas/report.py` | Add content_json to ReportResponse, add ExtractedDataUpdate schema |
| `backend/app/services/report_service.py` | Add `validate_for_publish()`, `update_extracted_data()` |
| `backend/app/api/vendor/requests.py` | Dispatch OCR Celery task after upload |
| `backend/app/main.py` | Register vendor reports router |
| `backend/app/jobs/celery_app.py` | (No beat schedule change — OCR is event-driven, not scheduled) |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/types/bulk-upload.ts` | BulkUploadJob types |
| `frontend/src/app/vendor/requests/[id]/_components/extraction-review.tsx` | Extracted data edit form with confidence indicators |
| `frontend/src/app/vendor/requests/[id]/_components/pdf-viewer-modal.tsx` | "View Original" PDF modal |
| `frontend/src/app/vendor/reports/bulk-upload/page.tsx` | Bulk upload page |
| `frontend/src/app/vendor/reports/bulk-upload/_components/file-picker.tsx` | Multi-file picker + upload |
| `frontend/src/app/vendor/reports/bulk-jobs/[id]/page.tsx` | Batch status page |

### Frontend — Modified Files
| File | Changes |
|------|---------|
| `frontend/src/types/report.ts` | Add `EXTRACTION_FAILED` to ReportStatus, add content_json fields |
| `frontend/src/app/vendor/requests/[id]/page.tsx` | Add PROCESSING/EXTRACTION_FAILED/READY_TO_PUBLISH states |
| `frontend/src/app/vendor/layout.tsx` | Add "Reports" nav link |

---

## Task 1: Add Enums and Constants

**Files:**
- Modify: `backend/app/models/enums.py:69-74`
- Modify: `backend/app/core/constants.py`
- Modify: `backend/app/core/config.py:1-67`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Add EXTRACTION_FAILED to ReportStatus and add BulkUploadStatus enum**

In `backend/app/models/enums.py`, add `EXTRACTION_FAILED` to `ReportStatus` and add the new `BulkUploadStatus` enum:

```python
# Update ReportStatus (line 69-74)
class ReportStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    READY_TO_PUBLISH = "READY_TO_PUBLISH"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


# Add after BroadcastStatus (after line 116)
class BulkUploadStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    PARTIALLY_FAILED = "PARTIALLY_FAILED"
```

- [ ] **Step 2: Register BulkUploadStatus in models __init__.py**

In `backend/app/models/__init__.py`, add the import and export:

```python
# Add to enums import (line 4)
from app.models.enums import (
    AdminRole,
    BroadcastStatus,
    BulkUploadStatus,  # ADD THIS
    EarningType,
    # ... rest unchanged
)

# Add to __all__ list, in the "Phase 2 enums" section
    "BulkUploadStatus",
```

- [ ] **Step 3: Add OCR constants**

Append to `backend/app/core/constants.py`:

```python
# OCR & extraction
REQUIRED_REPORT_FIELDS = ["property_address", "property_type", "valuation_amount"]
OCR_BATCH_DELAY_SECONDS = 2
MAX_BULK_UPLOAD_FILES = 50
```

- [ ] **Step 4: Add OCR settings to config**

In `backend/app/core/config.py`, add OCR settings inside the `Settings` class (before `model_config`):

```python
    # OCR
    ANTHROPIC_API_KEY: str = ""
    OCR_MODEL: str = "claude-sonnet-4-6"
    OCR_MAX_PAGES: int = 20
    OCR_BATCH_SIZE: int = 5
    OCR_TASK_TIMEOUT: int = 300
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/enums.py backend/app/models/__init__.py backend/app/core/constants.py backend/app/core/config.py
git commit -m "feat(phase4): add OCR enums, constants, and config settings"
```

---

## Task 2: BulkUploadJob Model + Migration

**Files:**
- Create: `backend/app/models/bulk_upload.py`
- Modify: `backend/app/models/__init__.py`
- Create: Alembic migration (auto-generated)

- [ ] **Step 1: Create BulkUploadJob model**

Create `backend/app/models/bulk_upload.py`:

```python
import uuid

from sqlalchemy import Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import BulkUploadStatus


class BulkUploadJob(BaseModel):
    __tablename__ = "bulk_upload_jobs"

    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    total_reports: Mapped[int] = mapped_column(Integer, default=0)
    processed_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[BulkUploadStatus] = mapped_column(
        SQLEnum(BulkUploadStatus), default=BulkUploadStatus.PENDING
    )
```

- [ ] **Step 2: Register in models __init__.py**

Add to `backend/app/models/__init__.py`:

```python
# Add import (after billing import)
from app.models.bulk_upload import BulkUploadJob

# Add to __all__
    "BulkUploadJob",
```

- [ ] **Step 3: Add bulk_upload_job_id to Report model**

In `backend/app/models/report.py`, add a nullable FK so bulk-uploaded reports link back to their job:

```python
# Add import at top
from app.models.enums import PropertyType, ReportCategory, ReportStatus

# Add field after is_active (line 56)
    bulk_upload_job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("bulk_upload_jobs.id"), nullable=True
    )
```

- [ ] **Step 4: Generate and run migration**

```bash
make migration msg="add bulk_upload_jobs table and extraction_failed status"
make migrate
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/bulk_upload.py backend/app/models/__init__.py backend/app/models/report.py backend/alembic/versions/
git commit -m "feat(phase4): add BulkUploadJob model and migration"
```

---

## Task 3: OCR Provider Abstraction (base + dataclass)

**Files:**
- Create: `backend/app/services/ocr/__init__.py`
- Create: `backend/app/services/ocr/base.py`
- Create: `backend/tests/services/test_ocr_provider.py`

- [ ] **Step 1: Write the test for ExtractionResult and OcrProvider interface**

Create `backend/tests/services/test_ocr_provider.py`:

```python
import pytest

from app.services.ocr.base import ExtractionResult, OcrProvider


def test_extraction_result_creation():
    result = ExtractionResult(
        anchor_fields={
            "property_address": {"value": "123 Main St", "confidence": 0.95, "type": "text"},
        },
        additional_fields={
            "plot_number": {"value": "A-1", "confidence": 0.80, "type": "text"},
        },
        raw_text="Sample text",
        page_count=3,
        usage={"input_tokens": 1000, "output_tokens": 200},
    )
    assert result.anchor_fields["property_address"]["value"] == "123 Main St"
    assert result.page_count == 3
    assert result.usage["input_tokens"] == 1000


def test_extraction_result_to_content_json():
    result = ExtractionResult(
        anchor_fields={
            "property_address": {"value": "123 Main St", "confidence": 0.95, "type": "text"},
        },
        additional_fields={},
        raw_text="text",
        page_count=1,
        usage={"input_tokens": 500, "output_tokens": 100},
    )
    content = result.to_content_json(provider="claude", model="claude-sonnet-4-6")
    assert content["extraction_version"] == 1
    assert content["provider"] == "claude"
    assert content["model"] == "claude-sonnet-4-6"
    assert content["anchor_fields"]["property_address"]["value"] == "123 Main St"
    assert "extracted_at" in content
    assert content["page_count"] == 1


def test_ocr_provider_is_abstract():
    with pytest.raises(TypeError):
        OcrProvider()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose -f docker-compose.local.yml exec backend python -m pytest tests/services/test_ocr_provider.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ocr'`

- [ ] **Step 3: Create the OCR package and base module**

Create `backend/app/services/ocr/__init__.py`:

```python
from app.services.ocr.base import ExtractionResult, OcrProvider

__all__ = ["ExtractionResult", "OcrProvider"]
```

Create `backend/app/services/ocr/base.py`:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class ExtractionResult:
    anchor_fields: dict[str, dict]
    additional_fields: dict[str, dict]
    raw_text: str
    page_count: int
    usage: dict = field(default_factory=dict)

    def to_content_json(self, provider: str, model: str) -> dict:
        return {
            "extraction_version": 1,
            "provider": provider,
            "model": model,
            "anchor_fields": self.anchor_fields,
            "additional_fields": self.additional_fields,
            "raw_text": self.raw_text,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "page_count": self.page_count,
            "usage": self.usage,
        }


class OcrProvider(ABC):
    @abstractmethod
    async def extract(self, pdf_path: str) -> ExtractionResult:
        """Extract structured data from a PDF file."""
        ...
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker compose -f docker-compose.local.yml exec backend python -m pytest tests/services/test_ocr_provider.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ocr/ backend/tests/services/test_ocr_provider.py
git commit -m "feat(phase4): add OcrProvider abstraction and ExtractionResult dataclass"
```

---

## Task 4: Claude OCR Provider Implementation

**Files:**
- Create: `backend/app/services/ocr/claude_provider.py`
- Modify: `backend/app/services/ocr/__init__.py`
- Modify: `backend/tests/services/test_ocr_provider.py`

- [ ] **Step 1: Write tests for ClaudeOcrProvider (mocked API)**

Append to `backend/tests/services/test_ocr_provider.py`:

```python
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.ocr.claude_provider import ClaudeOcrProvider


@pytest.mark.asyncio
async def test_claude_provider_extract_success():
    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(text='{"anchor_fields": {"property_address": {"value": "42 MG Road", "confidence": 0.95, "type": "text"}, "property_type": {"value": "residential", "confidence": 0.99, "type": "text"}, "valuation_amount": {"value": 5500000, "confidence": 0.88, "type": "currency"}}, "additional_fields": {"construction_year": {"value": "2015", "confidence": 0.82, "type": "text"}}}')
    ]
    mock_response.usage = MagicMock(input_tokens=5000, output_tokens=300)

    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    provider = ClaudeOcrProvider(client=mock_client, model="claude-sonnet-4-6")

    with patch.object(provider, "_pdf_to_images", return_value=[b"fake_image_bytes"]):
        result = await provider.extract("/fake/path.pdf")

    assert result.anchor_fields["property_address"]["value"] == "42 MG Road"
    assert result.additional_fields["construction_year"]["value"] == "2015"
    assert result.usage["input_tokens"] == 5000
    assert result.page_count == 1


@pytest.mark.asyncio
async def test_claude_provider_handles_api_error():
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(side_effect=Exception("API rate limit"))

    provider = ClaudeOcrProvider(client=mock_client, model="claude-sonnet-4-6")

    with patch.object(provider, "_pdf_to_images", return_value=[b"fake_image_bytes"]):
        with pytest.raises(Exception, match="API rate limit"):
            await provider.extract("/fake/path.pdf")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.local.yml exec backend python -m pytest tests/services/test_ocr_provider.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ocr.claude_provider'`

- [ ] **Step 3: Implement ClaudeOcrProvider**

Create `backend/app/services/ocr/claude_provider.py`:

```python
import base64
import json

import fitz  # PyMuPDF

from app.services.ocr.base import ExtractionResult, OcrProvider

EXTRACTION_PROMPT = """You are analyzing a property valuation or legal due diligence report from India. 
Extract all relevant structured data from this document.

You MUST return a JSON object with exactly two keys:
- "anchor_fields": Always try to extract these fields:
  - property_address (text): Full property address
  - property_type (text): residential, commercial, industrial, or agricultural
  - valuation_amount (currency): Market/fair value amount in INR
  - built_up_area (text): Built-up area with unit
  - owner_name (text): Property owner or loan applicant name
- "additional_fields": Any other relevant fields you find (boundaries, plot number, construction year, encumbrances, occupation status, survey number, etc.)

For each field, provide:
- "value": The extracted value
- "confidence": Your confidence score from 0.0 to 1.0
- "type": One of "text", "number", "currency", "date"

If a field is not found in the document, omit it from the output.
Return ONLY valid JSON, no other text."""


class ClaudeOcrProvider(OcrProvider):
    def __init__(self, client, model: str = "claude-sonnet-4-6"):
        self._client = client
        self._model = model

    def _pdf_to_images(self, pdf_path: str, max_pages: int = 20) -> list[bytes]:
        """Convert PDF pages to PNG images."""
        doc = fitz.open(pdf_path)
        images = []
        for page_num in range(min(len(doc), max_pages)):
            page = doc[page_num]
            # 150 DPI for good quality without excessive size
            pix = page.get_pixmap(dpi=150)
            images.append(pix.tobytes("png"))
        doc.close()
        return images

    async def extract(self, pdf_path: str) -> ExtractionResult:
        """Extract structured data from PDF using Claude vision."""
        images = self._pdf_to_images(pdf_path)
        page_count = len(images)

        # Build message content with all pages as images
        content = []
        for i, img_bytes in enumerate(images):
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": b64,
                },
            })
            if i == 0:
                content.append({"type": "text", "text": EXTRACTION_PROMPT})

        response = await self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            messages=[{"role": "user", "content": content}],
        )

        raw_text = response.content[0].text
        parsed = json.loads(raw_text)

        return ExtractionResult(
            anchor_fields=parsed.get("anchor_fields", {}),
            additional_fields=parsed.get("additional_fields", {}),
            raw_text=raw_text,
            page_count=page_count,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )
```

- [ ] **Step 4: Update __init__.py exports**

Update `backend/app/services/ocr/__init__.py`:

```python
from app.services.ocr.base import ExtractionResult, OcrProvider
from app.services.ocr.claude_provider import ClaudeOcrProvider

__all__ = ["ExtractionResult", "OcrProvider", "ClaudeOcrProvider"]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
docker compose -f docker-compose.local.yml exec backend python -m pytest tests/services/test_ocr_provider.py -v
```

Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ocr/ backend/tests/services/test_ocr_provider.py
git commit -m "feat(phase4): implement ClaudeOcrProvider with PDF-to-image extraction"
```

---

## Task 5: OCR Service (Orchestrator)

**Files:**
- Create: `backend/app/services/ocr/ocr_service.py`
- Create: `backend/tests/services/test_ocr_service.py`

- [ ] **Step 1: Write tests for OcrService**

Create `backend/tests/services/test_ocr_service.py`:

```python
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    ReportStatus,
    RequestType,
    UserType,
    VendorRequestStatus,
)
from app.models.lender import Lender
from app.models.report import Report
from app.models.request import ReportRequest
from app.models.user import Organization
from app.models.vendor import Vendor
from app.services.ocr.base import ExtractionResult
from app.services.ocr.ocr_service import OcrService


async def _create_test_report(db: AsyncSession) -> tuple[Vendor, Report]:
    """Create a vendor + report for testing."""
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
        additional_fields={
            "plot_number": {"value": "A-1", "confidence": 0.80, "type": "text"},
        },
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose -f docker-compose.local.yml exec backend python -m pytest tests/services/test_ocr_service.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ocr.ocr_service'`

- [ ] **Step 3: Implement OcrService**

Create `backend/app/services/ocr/ocr_service.py`:

```python
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import MEDIA_ROOT
from app.models.enums import ReportStatus
from app.models.report import Report
from app.services.ocr.base import OcrProvider

logger = logging.getLogger(__name__)


class OcrService:
    def __init__(self, provider: OcrProvider):
        self._provider = provider

    async def process_report(self, db: AsyncSession, report: Report) -> None:
        """Run OCR extraction on a report and store results."""
        report.status = ReportStatus.PROCESSING
        await db.flush()

        try:
            full_path = f"{MEDIA_ROOT}/{report.uploaded_file_path}"
            result = await self._provider.extract(full_path)

            report.content_json = result.to_content_json(
                provider="claude",
                model=settings.OCR_MODEL,
            )
            report.status = ReportStatus.READY_TO_PUBLISH
            logger.info(
                "OCR extraction succeeded for report %s (%d pages)",
                report.id, result.page_count,
            )
        except Exception:
            logger.exception("OCR extraction failed for report %s", report.id)
            report.status = ReportStatus.EXTRACTION_FAILED

        await db.flush()
```

- [ ] **Step 4: Update __init__.py exports**

Update `backend/app/services/ocr/__init__.py`:

```python
from app.services.ocr.base import ExtractionResult, OcrProvider
from app.services.ocr.claude_provider import ClaudeOcrProvider
from app.services.ocr.ocr_service import OcrService

__all__ = ["ExtractionResult", "OcrProvider", "ClaudeOcrProvider", "OcrService"]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
docker compose -f docker-compose.local.yml exec backend python -m pytest tests/services/test_ocr_service.py -v
```

Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ocr/ backend/tests/services/test_ocr_service.py
git commit -m "feat(phase4): implement OcrService orchestrator"
```

---

## Task 6: Celery OCR Tasks

**Files:**
- Create: `backend/app/jobs/ocr_tasks.py`

- [ ] **Step 1: Create OCR Celery tasks**

Create `backend/app/jobs/ocr_tasks.py`:

```python
import logging
import time

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import OCR_BATCH_DELAY_SECONDS
from app.core.database import sync_session_factory
from app.models.bulk_upload import BulkUploadJob
from app.models.enums import BulkUploadStatus, ReportStatus
from app.models.report import Report

logger = logging.getLogger(__name__)


def _get_ocr_service():
    """Create OCR service with Claude provider (lazy init)."""
    import anthropic
    from app.services.ocr import ClaudeOcrProvider, OcrService

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    provider = ClaudeOcrProvider(client=client, model=settings.OCR_MODEL)
    return OcrService(provider=provider)


@shared_task(
    name="app.jobs.ocr_tasks.process_report_ocr",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    soft_time_limit=settings.OCR_TASK_TIMEOUT,
)
def process_report_ocr(self, report_id: str):
    """Process a single report through OCR extraction."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory

        service = _get_ocr_service()
        async with async_session_factory() as db:
            result = await db.execute(
                select(Report).where(Report.id == report_id)
            )
            report = result.scalar_one_or_none()
            if not report:
                logger.error("Report %s not found", report_id)
                return

            if report.status not in (ReportStatus.UPLOADED, ReportStatus.EXTRACTION_FAILED):
                logger.info("Report %s status is %s, skipping", report_id, report.status)
                return

            try:
                await service.process_report(db, report)
                await db.commit()
                logger.info("OCR complete for report %s: %s", report_id, report.status)
            except Exception as exc:
                await db.rollback()
                logger.exception("OCR task failed for report %s", report_id)
                raise self.retry(exc=exc)

    asyncio.run(_run())


@shared_task(name="app.jobs.ocr_tasks.process_bulk_upload")
def process_bulk_upload(job_id: str, report_ids: list[str]):
    """Process a batch of reports for bulk upload."""
    import asyncio

    async def _run():
        from app.core.database import async_session_factory

        service = _get_ocr_service()
        batch_size = settings.OCR_BATCH_SIZE

        async with async_session_factory() as db:
            # Mark job as in progress
            result = await db.execute(
                select(BulkUploadJob).where(BulkUploadJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                logger.error("BulkUploadJob %s not found", job_id)
                return

            job.status = BulkUploadStatus.IN_PROGRESS
            await db.commit()

            processed = 0
            failed = 0

            for i in range(0, len(report_ids), batch_size):
                batch = report_ids[i : i + batch_size]

                for rid in batch:
                    result = await db.execute(
                        select(Report).where(Report.id == rid)
                    )
                    report = result.scalar_one_or_none()
                    if not report:
                        failed += 1
                        continue

                    try:
                        await service.process_report(db, report)
                        await db.commit()
                        processed += 1
                    except Exception:
                        await db.rollback()
                        logger.exception("Bulk OCR failed for report %s", rid)
                        failed += 1

                # Update job progress
                result = await db.execute(
                    select(BulkUploadJob).where(BulkUploadJob.id == job_id)
                )
                job = result.scalar_one_or_none()
                if job:
                    job.processed_count = processed
                    job.failed_count = failed
                    await db.commit()

                # Delay between batches for rate limiting
                if i + batch_size < len(report_ids):
                    await asyncio.sleep(OCR_BATCH_DELAY_SECONDS)

            # Final status
            result = await db.execute(
                select(BulkUploadJob).where(BulkUploadJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            if job:
                job.processed_count = processed
                job.failed_count = failed
                job.status = (
                    BulkUploadStatus.COMPLETED if failed == 0
                    else BulkUploadStatus.PARTIALLY_FAILED
                )
                await db.commit()

    asyncio.run(_run())
```

- [ ] **Step 2: Verify task auto-discovery works**

The existing `celery_app.py` already has `celery_app.autodiscover_tasks(["app.jobs"])`, so `ocr_tasks.py` will be auto-discovered. No changes needed to `celery_app.py`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/jobs/ocr_tasks.py
git commit -m "feat(phase4): add Celery tasks for single and bulk OCR processing"
```

---

## Task 7: Update Report Schemas and Service

**Files:**
- Modify: `backend/app/schemas/report.py`
- Modify: `backend/app/services/report_service.py`
- Create: `backend/app/schemas/bulk_upload.py`

- [ ] **Step 1: Add content_json to ReportResponse and new schemas**

Update `backend/app/schemas/report.py` — add `content_json` to `ReportResponse` and add `ExtractedDataUpdate` schema:

```python
# Add to ReportResponse class (after longitude field, before listing_approved):
    content_json: dict | None = None

# Add at end of file:
class ExtractedFieldUpdate(BaseModel):
    value: str | int | float | None = None
    confidence: float | None = None
    type: str = "text"
    original: str | int | float | None = None
    edited: bool = False


class ExtractedDataUpdate(BaseModel):
    """Payload for updating extracted report data."""
    anchor_fields: dict[str, ExtractedFieldUpdate] = {}
    additional_fields: dict[str, ExtractedFieldUpdate] = {}
```

Also add `content_json` to `ReportDetail`:
```python
class ReportDetail(ReportResponse):
    """Extended response with revision history."""
    revisions: list[RevisionSummary] = []
    # content_json inherited from ReportResponse
```

- [ ] **Step 2: Create bulk upload schemas**

Create `backend/app/schemas/bulk_upload.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BulkUploadJobResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    total_reports: int
    processed_count: int
    failed_count: int
    status: str
    created_at: datetime
    updated_at: datetime


class BulkUploadReportStatus(BaseModel):
    """Per-report status within a bulk job."""
    report_id: UUID
    status: str
    property_address: str | None = None
```

- [ ] **Step 3: Add validate_for_publish and update_extracted_data to report_service**

Append to `backend/app/services/report_service.py`:

```python
from app.core.constants import REQUIRED_REPORT_FIELDS


def validate_for_publish(content_json: dict | None) -> list[str]:
    """Return list of missing required fields. Empty list = valid."""
    if not content_json:
        return REQUIRED_REPORT_FIELDS[:]

    anchor = content_json.get("anchor_fields", {})
    missing = []
    for field_name in REQUIRED_REPORT_FIELDS:
        field_data = anchor.get(field_name)
        if not field_data or not field_data.get("value"):
            missing.append(field_name)
    return missing


async def update_extracted_data(
    db: AsyncSession,
    report: Report,
    anchor_fields: dict,
    additional_fields: dict,
) -> Report:
    """Update report's content_json with edited extraction data."""
    if not report.content_json:
        report.content_json = {
            "extraction_version": 1,
            "provider": "manual",
            "anchor_fields": {},
            "additional_fields": {},
        }

    # Merge edited fields, preserving originals
    content = dict(report.content_json)  # shallow copy for mutation
    content["anchor_fields"] = anchor_fields
    content["additional_fields"] = additional_fields
    report.content_json = content
    await db.flush()
    return report


async def publish_report(db: AsyncSession, report: Report) -> Report:
    """Validate and transition report to PUBLISHED status."""
    missing = validate_for_publish(report.content_json)
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    report.status = ReportStatus.PUBLISHED
    await db.flush()
    return report
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/report.py backend/app/schemas/bulk_upload.py backend/app/services/report_service.py
git commit -m "feat(phase4): add extraction schemas, validation, and publish service"
```

---

## Task 8: Vendor Reports API Router

**Files:**
- Create: `backend/app/api/vendor/reports.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/vendor/requests.py:141-177`

- [ ] **Step 1: Create vendor reports router**

Create `backend/app/api/vendor/reports.py`:

```python
import uuid as uuid_mod
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MAX_BULK_UPLOAD_FILES
from app.core.database import get_db
from app.core.deps import require_role
from app.models.bulk_upload import BulkUploadJob
from app.models.enums import BulkUploadStatus, ReportCategory, ReportStatus
from app.models.report import Report
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.bulk_upload import BulkUploadJobResponse, BulkUploadReportStatus
from app.schemas.report import ExtractedDataUpdate, ReportResponse
from app.services import report_service
from app.services.report_service import InvalidFileError

router = APIRouter(prefix="/api/vendor/reports", tags=["vendor-reports"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser).where(VendorUser.user_id == user_id)
    )
    vu = result.scalar_one_or_none()
    if not vu:
        raise HTTPException(status_code=400, detail="User not associated with a vendor")
    return vu.vendor_id


@router.post("/bulk-upload", response_model=BulkUploadJobResponse)
async def bulk_upload(
    files: list[UploadFile] = File(...),
    report_category: str = "VALUATION",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Upload multiple PDF reports for bulk processing."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    if len(files) > MAX_BULK_UPLOAD_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_BULK_UPLOAD_FILES} files per batch",
        )

    category = ReportCategory(report_category)

    # Create bulk upload job
    job = BulkUploadJob(
        vendor_id=vendor_id,
        total_reports=len(files),
        status=BulkUploadStatus.PENDING,
    )
    db.add(job)
    await db.flush()

    report_ids = []
    for upload_file in files:
        try:
            content = await upload_file.read()
            report_service.validate_upload(upload_file.content_type, len(content))
        except InvalidFileError as e:
            raise HTTPException(status_code=400, detail=f"{upload_file.filename}: {e}")

        report_id = uuid_mod.uuid4()
        relative_path = report_service.generate_report_path(vendor_id, report_id)
        await report_service.save_file(relative_path, content)

        report = Report(
            id=report_id,
            vendor_id=vendor_id,
            report_category=category,
            status=ReportStatus.UPLOADED,
            uploaded_file_path=relative_path,
            bulk_upload_job_id=job.id,
        )
        db.add(report)
        report_ids.append(str(report_id))

    await db.flush()

    # Dispatch batch processing
    from app.jobs.ocr_tasks import process_bulk_upload
    process_bulk_upload.delay(str(job.id), report_ids)

    return job


@router.get("/bulk-jobs", response_model=list[BulkUploadJobResponse])
async def list_bulk_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """List vendor's bulk upload jobs."""
    vendor_id = await _get_vendor_id(db, current_user.id)
    result = await db.execute(
        select(BulkUploadJob)
        .where(BulkUploadJob.vendor_id == vendor_id)
        .order_by(BulkUploadJob.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/bulk-jobs/{job_id}", response_model=BulkUploadJobResponse)
async def get_bulk_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("VENDOR")),
):
    """Get bulk upload job status."""
    result = await db.execute(
        select(BulkUploadJob).where(BulkUploadJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Bulk job not found")
    return job


@router.get("/bulk-jobs/{job_id}/reports", response_model=list[BulkUploadReportStatus])
async def get_bulk_job_reports(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("VENDOR")),
):
    """Get per-report status for a bulk job."""
    result = await db.execute(
        select(Report)
        .where(Report.bulk_upload_job_id == job_id)
        .order_by(Report.created_at)
    )
    reports = result.scalars().all()
    return [
        BulkUploadReportStatus(
            report_id=r.id,
            status=r.status.value,
            property_address=r.property_address,
        )
        for r in reports
    ]


@router.post("/{report_id}/retry-extraction", response_model=ReportResponse)
async def retry_extraction(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Retry failed OCR extraction."""
    vendor_id = await _get_vendor_id(db, current_user.id)
    report = await report_service.get_report(db, report_id)
    if not report or report.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != ReportStatus.EXTRACTION_FAILED:
        raise HTTPException(status_code=400, detail="Report is not in failed state")

    report.status = ReportStatus.UPLOADED
    await db.flush()

    from app.jobs.ocr_tasks import process_report_ocr
    process_report_ocr.delay(str(report_id))

    return report


@router.put("/{report_id}/extracted-data", response_model=ReportResponse)
async def update_extracted_data(
    report_id: UUID,
    payload: ExtractedDataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Save edited extraction data."""
    vendor_id = await _get_vendor_id(db, current_user.id)
    report = await report_service.get_report(db, report_id)
    if not report or report.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Report not found")

    anchor = {k: v.model_dump() for k, v in payload.anchor_fields.items()}
    additional = {k: v.model_dump() for k, v in payload.additional_fields.items()}

    await report_service.update_extracted_data(db, report, anchor, additional)
    return report


@router.post("/{report_id}/publish", response_model=ReportResponse)
async def publish_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Validate required fields and publish report."""
    vendor_id = await _get_vendor_id(db, current_user.id)
    report = await report_service.get_report(db, report_id)
    if not report or report.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        await report_service.publish_report(db, report)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return report


@router.get("/{report_id}/pdf")
async def get_report_pdf(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("VENDOR")),
):
    """Serve report PDF for viewing."""
    report = await report_service.get_report(db, report_id)
    if not report or not report.uploaded_file_path:
        raise HTTPException(status_code=404, detail="Report not found")

    full_path = report_service.get_full_path(report.uploaded_file_path)

    from fastapi.responses import FileResponse
    return FileResponse(full_path, media_type="application/pdf")
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add the import and registration:

```python
# Add import (after vendor_settings_router)
from app.api.vendor.reports import router as vendor_reports_router

# Add registration (after vendor_settings_router)
app.include_router(vendor_reports_router)
```

- [ ] **Step 3: Dispatch OCR task after upload in vendor requests**

In `backend/app/api/vendor/requests.py`, modify the `upload_report` endpoint (after line 176, before `return report`):

```python
    # Dispatch OCR extraction
    from app.jobs.ocr_tasks import process_report_ocr
    process_report_ocr.delay(str(report.id))

    return report
```

Also update the `revise_report` endpoint similarly — after `submit_revision` call (after line 218, before `return report`):

```python
    # Dispatch OCR extraction on revised report
    from app.jobs.ocr_tasks import process_report_ocr
    process_report_ocr.delay(str(report.id))

    return report
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/vendor/reports.py backend/app/main.py backend/app/api/vendor/requests.py
git commit -m "feat(phase4): add vendor reports API and wire OCR dispatch on upload"
```

---

## Task 9: Frontend Types and API Updates

**Files:**
- Modify: `frontend/src/types/report.ts`
- Create: `frontend/src/types/bulk-upload.ts`

- [ ] **Step 1: Update report types with extraction fields**

Replace `frontend/src/types/report.ts`:

```typescript
export type ReportStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "EXTRACTION_FAILED"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "ARCHIVED";

export interface ExtractedField {
  value: string | number | null;
  confidence: number;
  type: "text" | "number" | "currency" | "date";
  original?: string | number | null;
  edited?: boolean;
}

export interface ContentJson {
  extraction_version: number;
  provider: string;
  model: string;
  anchor_fields: Record<string, ExtractedField>;
  additional_fields: Record<string, ExtractedField>;
  raw_text: string;
  extracted_at: string;
  page_count: number;
  usage: { input_tokens: number; output_tokens: number };
}

export interface Report {
  id: string;
  vendor_id: string;
  report_category: "VALUATION" | "LEGAL";
  status: ReportStatus;
  property_address: string | null;
  macro_location: string | null;
  city: string | null;
  pin_code: string | null;
  property_type: string | null;
  plot_extent_sqft: string | null;
  built_up_sqft: string | null;
  valuation_amount: string | null;
  loan_applicant_name: string | null;
  report_date: string | null;
  expiry_date: string | null;
  uploaded_file_path: string | null;
  content_json: ContentJson | null;
  listing_approved: boolean;
  is_active: boolean;
}

export interface ReportRevision {
  revision_number: number;
  comments: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Create bulk upload types**

Create `frontend/src/types/bulk-upload.ts`:

```typescript
export type BulkUploadStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PARTIALLY_FAILED";

export interface BulkUploadJob {
  id: string;
  vendor_id: string;
  total_reports: number;
  processed_count: number;
  failed_count: number;
  status: BulkUploadStatus;
  created_at: string;
  updated_at: string;
}

export interface BulkUploadReportStatus {
  report_id: string;
  status: string;
  property_address: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/report.ts frontend/src/types/bulk-upload.ts
git commit -m "feat(phase4): add frontend types for OCR extraction and bulk upload"
```

---

## Task 10: Extraction Review Component

**Files:**
- Create: `frontend/src/app/vendor/requests/[id]/_components/extraction-review.tsx`

- [ ] **Step 1: Create the extraction review component**

Create `frontend/src/app/vendor/requests/[id]/_components/extraction-review.tsx`:

```tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ContentJson, ExtractedField, Report } from "@/types/report";

type Props = {
  report: Report;
  onUpdated: () => void;
};

const FIELD_LABELS: Record<string, string> = {
  property_address: "Property Address",
  property_type: "Property Type",
  valuation_amount: "Valuation Amount",
  built_up_area: "Built-up Area",
  owner_name: "Owner Name",
};

const REQUIRED_FIELDS = ["property_address", "property_type", "valuation_amount"];

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "bg-green-100 text-green-800";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
}

type FieldEntry = {
  key: string;
  value: string | number | null;
  confidence: number;
  type: string;
  original?: string | number | null;
  edited?: boolean;
  isAnchor: boolean;
};

function flattenFields(content: ContentJson): FieldEntry[] {
  const entries: FieldEntry[] = [];
  for (const [key, field] of Object.entries(content.anchor_fields)) {
    entries.push({ key, ...field, isAnchor: true });
  }
  for (const [key, field] of Object.entries(content.additional_fields)) {
    entries.push({ key, ...field, isAnchor: false });
  }
  return entries;
}

export function ExtractionReview({ report, onUpdated }: Props) {
  const content = report.content_json;
  const [fields, setFields] = useState<FieldEntry[]>(
    content ? flattenFields(content) : []
  );
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [showPdf, setShowPdf] = useState(false);

  const updateFieldValue = (index: number, newValue: string) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const original = f.original ?? f.value;
        return {
          ...f,
          value: newValue,
          original: f.edited ? f.original : original,
          edited: true,
        };
      })
    );
  };

  const addField = () => {
    if (!newFieldKey.trim()) return;
    setFields((prev) => [
      ...prev,
      {
        key: newFieldKey.trim().toLowerCase().replace(/\s+/g, "_"),
        value: newFieldValue,
        confidence: 1.0,
        type: "text",
        edited: false,
        isAnchor: false,
      },
    ]);
    setNewFieldKey("");
    setNewFieldValue("");
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => {
    const anchor: Record<string, object> = {};
    const additional: Record<string, object> = {};

    for (const f of fields) {
      const data = {
        value: f.value,
        confidence: f.confidence,
        type: f.type,
        original: f.original ?? null,
        edited: f.edited ?? false,
      };
      if (f.isAnchor || f.key in (content?.anchor_fields ?? {})) {
        anchor[f.key] = data;
      } else {
        additional[f.key] = data;
      }
    }
    return { anchor_fields: anchor, additional_fields: additional };
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/vendor/reports/${report.id}/extracted-data`, buildPayload());
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError("");
    try {
      // Save first, then publish
      await api.put(`/api/vendor/reports/${report.id}/extracted-data`, buildPayload());
      await api.post(`/api/vendor/reports/${report.id}/publish`, {});
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const missingRequired = REQUIRED_FIELDS.filter((f) => {
    const field = fields.find((entry) => entry.key === f);
    return !field || !field.value;
  });

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm";

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Extracted Report Data</h3>
        <button
          onClick={() => setShowPdf(true)}
          className="text-sm text-blue-600 hover:underline"
        >
          View Original PDF
        </button>
      </div>

      {content && (
        <p className="text-xs text-gray-500">
          Extracted from {content.page_count} page(s) on{" "}
          {new Date(content.extracted_at).toLocaleDateString()}
        </p>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}

      {/* Anchor fields */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Key Fields</h4>
        <div className="space-y-3">
          {fields
            .filter((f) => f.isAnchor)
            .map((f, i) => {
              const globalIndex = fields.indexOf(f);
              const isRequired = REQUIRED_FIELDS.includes(f.key);
              return (
                <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-sm text-gray-600 sm:w-40 flex-shrink-0">
                    {FIELD_LABELS[f.key] || f.key}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={f.type === "number" || f.type === "currency" ? "number" : "text"}
                    className={inputClass}
                    value={f.value ?? ""}
                    onChange={(e) => updateFieldValue(globalIndex, e.target.value)}
                  />
                  <span
                    className={`text-xs px-2 py-1 rounded whitespace-nowrap ${confidenceColor(f.confidence)}`}
                  >
                    {confidenceLabel(f.confidence)} ({Math.round(f.confidence * 100)}%)
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Additional fields */}
      {fields.some((f) => !f.isAnchor) && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Fields</h4>
          <div className="space-y-3">
            {fields
              .filter((f) => !f.isAnchor)
              .map((f) => {
                const globalIndex = fields.indexOf(f);
                return (
                  <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-sm text-gray-600 sm:w-40 flex-shrink-0">
                      {FIELD_LABELS[f.key] || f.key.replace(/_/g, " ")}
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      value={f.value ?? ""}
                      onChange={(e) => updateFieldValue(globalIndex, e.target.value)}
                    />
                    <span
                      className={`text-xs px-2 py-1 rounded whitespace-nowrap ${confidenceColor(f.confidence)}`}
                    >
                      {confidenceLabel(f.confidence)} ({Math.round(f.confidence * 100)}%)
                    </span>
                    <button
                      onClick={() => removeField(globalIndex)}
                      className="text-red-400 hover:text-red-600 text-sm"
                      title="Remove field"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Add field */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Add Field</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Field name"
            className={`${inputClass} sm:w-40`}
            value={newFieldKey}
            onChange={(e) => setNewFieldKey(e.target.value)}
          />
          <input
            type="text"
            placeholder="Value"
            className={inputClass}
            value={newFieldValue}
            onChange={(e) => setNewFieldValue(e.target.value)}
          />
          <button
            onClick={addField}
            disabled={!newFieldKey.trim()}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing || missingRequired.length > 0}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          title={
            missingRequired.length > 0
              ? `Missing: ${missingRequired.join(", ")}`
              : "Publish report"
          }
        >
          {publishing ? "Publishing..." : "Publish"}
        </button>
        {missingRequired.length > 0 && (
          <p className="text-xs text-red-500 self-center">
            Missing required: {missingRequired.join(", ")}
          </p>
        )}
      </div>

      {/* PDF Modal */}
      {showPdf && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] mx-4 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Original Report PDF</h3>
              <button
                onClick={() => setShowPdf(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                &times;
              </button>
            </div>
            <iframe
              src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8020"}/api/vendor/reports/${report.id}/pdf`}
              className="flex-1 w-full"
              title="Report PDF"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/vendor/requests/[id]/_components/extraction-review.tsx
git commit -m "feat(phase4): add ExtractionReview component with confidence indicators"
```

---

## Task 11: Update Vendor Request Detail Page

**Files:**
- Modify: `frontend/src/app/vendor/requests/[id]/page.tsx`

- [ ] **Step 1: Add extraction states to vendor request detail page**

Update `frontend/src/app/vendor/requests/[id]/page.tsx` to handle PROCESSING, EXTRACTION_FAILED, and READY_TO_PUBLISH report states.

Add import at top:

```typescript
import type { Report } from "@/types/report";
import { ExtractionReview } from "./_components/extraction-review";
```

Add report state after existing state declarations (after line 23):

```typescript
  const [report, setReport] = useState<Report | null>(null);
```

Add a report fetch function (after `fetchRequest`):

```typescript
  const fetchReport = () => {
    if (!request) return;
    // The report is returned as part of polling or we fetch separately
    // For now, report data comes from the request detail endpoint
  };
```

Replace the `{/* Pending: Upload */}` section and `{/* Completed */}` section (lines 119-140) with:

```tsx
      {/* Pending: Upload */}
      {isPending && (
        <UploadSection requestId={id} onUploaded={fetchRequest} />
      )}

      {/* Report Processing State */}
      {(request.vendor_status === "SENT" || request.vendor_status === "ACCEPTED") && request.report && (
        <>
          {request.report.status === "PROCESSING" && (
            <div className="border rounded-lg p-4 mb-4 bg-blue-50">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                <div>
                  <p className="font-medium text-blue-800">Extracting report data...</p>
                  <p className="text-sm text-blue-600">This usually takes 30-60 seconds.</p>
                </div>
              </div>
            </div>
          )}

          {request.report.status === "EXTRACTION_FAILED" && (
            <div className="border rounded-lg p-4 mb-4 bg-red-50">
              <h3 className="font-semibold text-red-800 mb-2">Extraction Failed</h3>
              <p className="text-sm text-red-700 mb-3">
                We couldn't extract data from this report. You can retry or fill in the fields manually.
              </p>
              <button
                onClick={async () => {
                  await api.post(`/api/vendor/reports/${request.report!.id}/retry-extraction`, {});
                  fetchRequest();
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
              >
                Retry Extraction
              </button>
            </div>
          )}

          {(request.report.status === "READY_TO_PUBLISH" || request.report.status === "PUBLISHED") && (
            <ExtractionReview report={request.report} onUpdated={fetchRequest} />
          )}

          {request.report.status === "PUBLISHED" && (
            <div className="border rounded-lg p-4 mt-4 bg-emerald-50">
              <p className="text-emerald-800 font-medium">Report published successfully.</p>
            </div>
          )}
        </>
      )}

      {/* Completed (no report or accepted) */}
      {isCompleted && !request.report && (
        <div className="border rounded-lg p-4 mb-4 bg-emerald-50">
          <p className="text-emerald-800 font-medium">
            {request.vendor_status === "ACCEPTED" ? "Report accepted by lender." : "Report submitted."}
          </p>
        </div>
      )}
```

- [ ] **Step 2: Update ReportRequest type to include report**

In `frontend/src/types/request.ts`, add the report field to `ReportRequest` interface:

```typescript
import type { Report } from "./report";

// Add to ReportRequest interface:
  report: Report | null;
```

- [ ] **Step 3: Update backend ReportRequestResponse to include report**

In `backend/app/schemas/request.py`, add report to the response schema so the request detail endpoint returns the associated report. (Check existing schema and add the relationship if not present.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/vendor/requests/[id]/page.tsx frontend/src/types/request.ts
git commit -m "feat(phase4): add extraction states to vendor request detail page"
```

---

## Task 12: Bulk Upload Page

**Files:**
- Create: `frontend/src/app/vendor/reports/bulk-upload/page.tsx`
- Create: `frontend/src/app/vendor/reports/bulk-upload/_components/file-picker.tsx`

- [ ] **Step 1: Create file picker component**

Create `frontend/src/app/vendor/reports/bulk-upload/_components/file-picker.tsx`:

```tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { BulkUploadJob } from "@/types/bulk-upload";

type Props = {
  onJobCreated: (job: BulkUploadJob) => void;
};

export function FilePicker({ onJobCreated }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<"VALUATION" | "LEGAL">("VALUATION");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const pdfs = selected.filter((f) => f.type === "application/pdf");
    if (pdfs.length !== selected.length) {
      setError("Some files were skipped — only PDFs are accepted.");
    }
    if (pdfs.length > 50) {
      setError("Maximum 50 files per batch. Please select fewer files.");
      return;
    }
    setFiles(pdfs);
    if (pdfs.length === selected.length) setError("");
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setProgress(0);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("report_category", category);

    try {
      const job = await api.upload<BulkUploadJob>(
        "/api/vendor/reports/bulk-upload",
        formData
      );
      onJobCreated(job);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Report Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "VALUATION" | "LEGAL")}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
          id="bulk-file-input"
        />
        <label
          htmlFor="bulk-file-input"
          className="cursor-pointer text-blue-600 hover:underline text-sm"
        >
          Click to select PDF files
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Max 50 files per batch, 20MB each
        </p>
      </div>

      {files.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            {files.length} file(s) selected
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm"
              >
                <span className="truncate">{f.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-400 text-xs">
                    {(f.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-red-400 hover:text-red-600"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : `Upload ${files.length} File(s)`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create bulk upload page**

Create `frontend/src/app/vendor/reports/bulk-upload/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BulkUploadJob } from "@/types/bulk-upload";
import { FilePicker } from "./_components/file-picker";

export default function BulkUploadPage() {
  const router = useRouter();
  const [job, setJob] = useState<BulkUploadJob | null>(null);

  const handleJobCreated = (newJob: BulkUploadJob) => {
    setJob(newJob);
    router.push(`/vendor/reports/bulk-jobs/${newJob.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/vendor/requests")}
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        &larr; Back
      </button>

      <h1 className="text-2xl font-bold mb-2">Bulk Upload Reports</h1>
      <p className="text-sm text-gray-600 mb-6">
        Upload multiple PDF reports at once. Each report will be automatically processed
        to extract property details.
      </p>

      <FilePicker onJobCreated={handleJobCreated} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/vendor/reports/
git commit -m "feat(phase4): add bulk upload page with multi-file picker"
```

---

## Task 13: Bulk Job Status Page

**Files:**
- Create: `frontend/src/app/vendor/reports/bulk-jobs/[id]/page.tsx`

- [ ] **Step 1: Create bulk job status page**

Create `frontend/src/app/vendor/reports/bulk-jobs/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { BulkUploadJob, BulkUploadReportStatus } from "@/types/bulk-upload";

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  EXTRACTION_FAILED: "bg-red-100 text-red-700",
  READY_TO_PUBLISH: "bg-green-100 text-green-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
};

export default function BulkJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<BulkUploadJob | null>(null);
  const [reports, setReports] = useState<BulkUploadReportStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [jobData, reportData] = await Promise.all([
        api.get<BulkUploadJob>(`/api/vendor/reports/bulk-jobs/${id}`),
        api.get<BulkUploadReportStatus[]>(`/api/vendor/reports/bulk-jobs/${id}/reports`),
      ]);
      setJob(jobData);
      setReports(reportData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Poll while job is in progress
  useEffect(() => {
    if (!job || job.status === "COMPLETED" || job.status === "PARTIALLY_FAILED") return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [job?.status]);

  if (loading) return <p className="text-gray-500 py-8">Loading...</p>;
  if (!job) return <p className="text-red-500 py-8">Job not found</p>;

  const progress =
    job.total_reports > 0
      ? Math.round(((job.processed_count + job.failed_count) / job.total_reports) * 100)
      : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => router.push("/vendor/reports/bulk-upload")}
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        &larr; Back to Bulk Upload
      </button>

      <h1 className="text-2xl font-bold mb-4">Bulk Upload Progress</h1>

      {/* Summary */}
      <div className="border rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{job.total_reports}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{job.processed_count}</p>
            <p className="text-xs text-gray-500">Processed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{job.failed_count}</p>
            <p className="text-xs text-gray-500">Failed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{progress}%</p>
            <p className="text-xs text-gray-500">Complete</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {(job.status === "IN_PROGRESS" || job.status === "PENDING") && (
          <p className="text-sm text-blue-600 mt-2 text-center">Processing...</p>
        )}
        {job.status === "COMPLETED" && (
          <p className="text-sm text-green-600 mt-2 text-center">All reports processed.</p>
        )}
        {job.status === "PARTIALLY_FAILED" && (
          <p className="text-sm text-amber-600 mt-2 text-center">
            Completed with {job.failed_count} failure(s).
          </p>
        )}
      </div>

      {/* Per-report status */}
      <div className="border rounded-lg divide-y">
        <div className="px-4 py-3 bg-gray-50">
          <h3 className="font-semibold text-sm">Reports</h3>
        </div>
        {reports.map((r) => (
          <div key={r.report_id} className="px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm truncate">
                {r.property_address || r.report_id}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded flex-shrink-0 ${STATUS_COLORS[r.status] || "bg-gray-100"}`}
            >
              {r.status.replace(/_/g, " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/vendor/reports/bulk-jobs/
git commit -m "feat(phase4): add bulk job status page with progress tracking"
```

---

## Task 14: Update Vendor Layout Navigation

**Files:**
- Modify: `frontend/src/app/vendor/layout.tsx`

- [ ] **Step 1: Add Reports nav link to vendor sidebar**

In `frontend/src/app/vendor/layout.tsx`, add a "Reports" link after "Requests" in both the desktop sidebar and mobile drawer nav sections:

Desktop sidebar (after `<a href="/vendor/requests"...>`):
```tsx
          <a href="/vendor/reports/bulk-upload" className="block px-2 py-3 rounded hover:bg-gray-100">Reports</a>
```

Mobile drawer (same location in the mobile nav):
```tsx
              <a href="/vendor/reports/bulk-upload" className="block px-2 py-3 rounded hover:bg-gray-100">Reports</a>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/vendor/layout.tsx
git commit -m "feat(phase4): add Reports nav link to vendor sidebar"
```

---

## Task 15: Add async_session_factory to database.py

**Files:**
- Modify: `backend/app/core/database.py`

- [ ] **Step 1: Check database.py for existing session factory**

Read `backend/app/core/database.py` and verify whether `async_session_factory` is already exported. The Celery tasks need a standalone async session factory (not the FastAPI dependency).

If not present, add:

```python
from sqlalchemy.ext.asyncio import async_sessionmaker

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
```

- [ ] **Step 2: Commit if changed**

```bash
git add backend/app/core/database.py
git commit -m "feat(phase4): export async_session_factory for Celery task usage"
```

---

## Task 16: PDF Compression Task (Pre-OCR Optimization)

**Files:**
- Create: `backend/app/jobs/pdf_optimize.py`
- Modify: `backend/app/jobs/ocr_tasks.py`

- [ ] **Step 1: Create PDF optimization task**

Create `backend/app/jobs/pdf_optimize.py`:

```python
import logging
import os
import shutil

import pikepdf

from app.core.constants import MEDIA_ROOT

logger = logging.getLogger(__name__)


def optimize_pdf(relative_path: str) -> str:
    """Losslessly optimize a PDF file. Preserves original with _original suffix.

    Returns the relative path to the optimized file (same as input — original is renamed).
    """
    full_path = os.path.join(MEDIA_ROOT, relative_path)
    if not os.path.exists(full_path):
        logger.warning("PDF not found for optimization: %s", full_path)
        return relative_path

    # Preserve original
    base, ext = os.path.splitext(full_path)
    original_path = f"{base}_original{ext}"
    shutil.copy2(full_path, original_path)

    try:
        with pikepdf.open(original_path) as pdf:
            pdf.save(
                full_path,
                linearize=True,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
            )
        original_size = os.path.getsize(original_path)
        optimized_size = os.path.getsize(full_path)
        logger.info(
            "PDF optimized: %s (%.1fKB → %.1fKB, %.0f%% reduction)",
            relative_path,
            original_size / 1024,
            optimized_size / 1024,
            (1 - optimized_size / original_size) * 100 if original_size > 0 else 0,
        )
    except Exception:
        logger.exception("PDF optimization failed for %s, keeping original", relative_path)
        # Restore original on failure
        shutil.copy2(original_path, full_path)

    return relative_path
```

- [ ] **Step 2: Call optimization before OCR in the Celery task**

In `backend/app/jobs/ocr_tasks.py`, modify `process_report_ocr` to optimize before extracting. Add inside the `_run()` async function, after loading the report and before calling `service.process_report`:

```python
            # Optimize PDF before OCR
            from app.jobs.pdf_optimize import optimize_pdf
            if report.uploaded_file_path:
                optimize_pdf(report.uploaded_file_path)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/jobs/pdf_optimize.py backend/app/jobs/ocr_tasks.py
git commit -m "feat(phase4): add PDF optimization step before OCR extraction"
```

---

## Task 17: Add anthropic + pikepdf to Dependencies

**Files:**
- Modify: `backend/pyproject.toml` (or `requirements.txt`)

- [ ] **Step 1: Add new Python packages**

Add these packages to the backend dependencies:

```
anthropic>=0.40.0
pikepdf>=9.0.0
```

Note: `PyMuPDF` (fitz) is already in the dependencies.

- [ ] **Step 2: Rebuild backend container**

```bash
docker compose -f docker-compose.local.yml build backend celery-worker
docker compose -f docker-compose.local.yml up -d
```

- [ ] **Step 3: Commit**

```bash
git add backend/pyproject.toml
git commit -m "feat(phase4): add anthropic and pikepdf dependencies"
```

---

## Task 18: Add ANTHROPIC_API_KEY to Environment

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add API key to environment**

Add to `.env.local`:

```
ANTHROPIC_API_KEY=your-api-key-here
```

- [ ] **Step 2: Verify the key is picked up**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.core.config import settings; print('Key configured:', bool(settings.ANTHROPIC_API_KEY))"
```

Expected: `Key configured: True`

---

## Task 19: End-to-End Smoke Test

- [ ] **Step 1: Start all services**

```bash
make local-up
```

- [ ] **Step 2: Seed data**

```bash
make seed
```

- [ ] **Step 3: Test the upload → OCR flow**

1. Login as vendor (vendor@valuepro.com / vendor123)
2. Go to an accepted request
3. Upload a PDF report
4. Observe: status transitions UPLOADED → PROCESSING → READY_TO_PUBLISH
5. Verify extraction review form appears with extracted fields
6. Edit a field, save draft
7. Fill required fields, publish
8. Verify status transitions to PUBLISHED

- [ ] **Step 4: Test bulk upload flow**

1. Navigate to /vendor/reports/bulk-upload
2. Select 2-3 PDF files
3. Upload and verify redirect to job status page
4. Watch progress update as reports are processed

- [ ] **Step 5: Test extraction failure + retry**

1. Upload a non-readable PDF (image-only with no content)
2. If extraction fails, verify EXTRACTION_FAILED state renders
3. Click "Retry Extraction"
4. Verify it re-enters PROCESSING state
