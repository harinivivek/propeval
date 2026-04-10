# Phase 8: Templates & Report Formatting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lenders can configure custom report templates (branding + field selection) and download reports rendered as formatted PDFs via HTML-to-PDF conversion.

**Architecture:** New `ReportTemplate` model stores template config as JSONB. A form-based template builder in lender settings lets users configure header/logo/colors, select and reorder report fields, and set footer text. A PDF render service uses Jinja2 + WeasyPrint to merge report data into the template and produce a downloadable PDF. Existing download endpoints gain a `?format=template` param.

**Tech Stack:** WeasyPrint (HTML→PDF), Jinja2 (templating), Pillow (logo resize), @dnd-kit/sortable (drag-and-drop reorder)

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|----------------|
| `backend/app/models/template.py` | ReportTemplate SQLAlchemy model |
| `backend/app/schemas/template.py` | Pydantic schemas (Create, Update, Response) |
| `backend/app/services/template_service.py` | Template CRUD + logo upload |
| `backend/app/services/pdf_render_service.py` | Jinja2 + WeasyPrint PDF rendering |
| `backend/app/api/lender/templates.py` | 7 REST endpoints for template management |
| `backend/app/templates/report_master.html` | Jinja2 HTML master template for PDF rendering |
| `backend/alembic/versions/XXXX_add_report_templates.py` | Migration for report_templates table |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Register ReportTemplate |
| `backend/app/main.py` | Register templates router |
| `backend/app/core/constants.py` | Add LOGOS_DIR, RENDERED_DIR, TEMPLATE_FIELDS constants |
| `backend/app/api/common/download.py` | Add `?format=template` support |
| `backend/app/api/lender/listings.py` | Add `?format=template` support to purchase download |
| `backend/pyproject.toml` | Add weasyprint dependency |

### Frontend — New Files
| File | Responsibility |
|------|----------------|
| `frontend/src/types/template.ts` | TypeScript interfaces |
| `frontend/src/app/lender/settings/_components/template-builder.tsx` | Form-based template builder |
| `frontend/src/app/lender/settings/_components/field-list.tsx` | Drag-and-drop field reorder component |
| `frontend/src/app/lender/settings/_components/users-tab.tsx` | Extracted users table (existing code) |
| `frontend/src/components/download-button.tsx` | Split download button with template/original options |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/app/lender/settings/page.tsx` | Add tab navigation (Users / Report Template) |
| `frontend/package.json` | Add @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |

---

## Task 1: ReportTemplate Model + Migration

**Files:**
- Create: `backend/app/models/template.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the ReportTemplate model**

Create `backend/app/models/template.py`:

```python
import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ReportTemplate(BaseModel):
    __tablename__ = "report_templates"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    config_json: Mapped[dict] = mapped_column(JSONB)
```

- [ ] **Step 2: Register model in `__init__.py`**

Add to `backend/app/models/__init__.py`:

After the line `from app.models.notification import Notification`, add:
```python
from app.models.template import ReportTemplate
```

In the `__all__` list, after `"Notification",`, add:
```python
    # Phase 8 models
    "ReportTemplate",
```

- [ ] **Step 3: Generate Alembic migration**

Run inside the backend container:
```bash
docker compose -f docker-compose.local.yml exec backend alembic revision --autogenerate -m "add report_templates table"
```

Then copy the migration file from the container to the host:
```bash
docker cp propeval-backend-1:/app/alembic/versions/<generated_file>.py backend/alembic/versions/
```

- [ ] **Step 4: Run the migration**

```bash
docker compose -f docker-compose.local.yml exec backend alembic upgrade head
```

Verify:
```bash
docker compose -f docker-compose.local.yml exec db psql -U propeval -d propeval -c "\d report_templates"
```

Expected: Table with columns id, lender_id, name, is_active, logo_path, config_json, created_at, updated_at.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/template.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat(phase8): add ReportTemplate model and migration"
```

---

## Task 2: Template Constants + Pydantic Schemas

**Files:**
- Modify: `backend/app/core/constants.py`
- Create: `backend/app/schemas/template.py`

- [ ] **Step 1: Add template constants**

Add to the end of `backend/app/core/constants.py`:

```python
# Templates
LOGOS_DIR = "logos"
RENDERED_DIR = "rendered"
LOGO_MAX_WIDTH = 200
LOGO_MAX_HEIGHT = 80
LOGO_MAX_SIZE_MB = 2
LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg"]

TEMPLATE_FIELDS = [
    {"key": "property_address", "label": "Property Address"},
    {"key": "property_type", "label": "Property Type"},
    {"key": "valuation_amount", "label": "Valuation Amount"},
    {"key": "plot_extent_sqft", "label": "Plot Area (sq ft)"},
    {"key": "built_up_sqft", "label": "Built-up Area (sq ft)"},
    {"key": "loan_applicant_name", "label": "Applicant Name"},
    {"key": "report_date", "label": "Report Date"},
    {"key": "city", "label": "City"},
    {"key": "pin_code", "label": "PIN Code"},
    {"key": "latitude", "label": "Latitude"},
    {"key": "longitude", "label": "Longitude"},
    {"key": "report_category", "label": "Report Category"},
    {"key": "expiry_date", "label": "Expiry Date"},
]
```

- [ ] **Step 2: Create Pydantic schemas**

Create `backend/app/schemas/template.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TemplateSectionField(BaseModel):
    key: str
    label: str
    enabled: bool = True
    order: int


class TemplateHeader(BaseModel):
    bank_name: str
    primary_color: str = "#1a3b5c"
    secondary_color: str = "#f0f4f8"
    show_logo: bool = True
    subtitle: str = "Property Valuation Report"


class TemplateFooter(BaseModel):
    text: str = "Confidential - For internal use only"
    show_page_numbers: bool = True


class TemplateConfig(BaseModel):
    header: TemplateHeader
    sections: list[TemplateSectionField]
    footer: TemplateFooter


class TemplateCreate(BaseModel):
    name: str
    config_json: TemplateConfig


class TemplateUpdate(BaseModel):
    name: str | None = None
    config_json: TemplateConfig | None = None


class TemplateResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    name: str
    is_active: bool
    logo_path: str | None = None
    config_json: dict
    created_at: datetime
    updated_at: datetime


class TemplateListResponse(BaseModel):
    templates: list[TemplateResponse]


class TemplateFieldOption(BaseModel):
    key: str
    label: str
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/constants.py backend/app/schemas/template.py
git commit -m "feat(phase8): add template constants and Pydantic schemas"
```

---

## Task 3: Template Service

**Files:**
- Create: `backend/app/services/template_service.py`

- [ ] **Step 1: Create the template service**

Create `backend/app/services/template_service.py`:

```python
import os
import uuid as uuid_mod
from uuid import UUID

from fastapi import HTTPException, UploadFile
from PIL import Image
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    LOGO_ALLOWED_TYPES,
    LOGO_MAX_HEIGHT,
    LOGO_MAX_SIZE_MB,
    LOGO_MAX_WIDTH,
    LOGOS_DIR,
    MEDIA_ROOT,
)
from app.models.template import ReportTemplate
from app.schemas.template import TemplateConfig


async def create_template(
    db: AsyncSession,
    lender_id: UUID,
    name: str,
    config_json: TemplateConfig,
) -> ReportTemplate:
    await _deactivate_all(db, lender_id)

    template = ReportTemplate(
        lender_id=lender_id,
        name=name,
        is_active=True,
        config_json=config_json.model_dump(),
    )
    db.add(template)
    await db.flush()
    return template


async def update_template(
    db: AsyncSession,
    template_id: UUID,
    lender_id: UUID,
    name: str | None = None,
    config_json: TemplateConfig | None = None,
) -> ReportTemplate:
    template = await _get_owned_template(db, template_id, lender_id)

    if name is not None:
        template.name = name
    if config_json is not None:
        template.config_json = config_json.model_dump()
        _invalidate_cache_for_template(template_id)

    await db.flush()
    return template


async def upload_logo(
    db: AsyncSession,
    template_id: UUID,
    lender_id: UUID,
    file: UploadFile,
) -> ReportTemplate:
    if file.content_type not in LOGO_ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Logo must be PNG or JPEG")

    contents = await file.read()
    if len(contents) > LOGO_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Logo must be under {LOGO_MAX_SIZE_MB}MB")

    template = await _get_owned_template(db, template_id, lender_id)

    logo_dir = os.path.join(MEDIA_ROOT, LOGOS_DIR, str(lender_id))
    os.makedirs(logo_dir, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "png"
    logo_filename = f"{uuid_mod.uuid4().hex}.{ext}"
    logo_full_path = os.path.join(logo_dir, logo_filename)

    with open(logo_full_path, "wb") as f:
        f.write(contents)

    img = Image.open(logo_full_path)
    img.thumbnail((LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT))
    img.save(logo_full_path)

    relative_path = os.path.join(LOGOS_DIR, str(lender_id), logo_filename)
    template.logo_path = relative_path
    _invalidate_cache_for_template(template_id)
    await db.flush()
    return template


async def get_active_template(
    db: AsyncSession, lender_id: UUID
) -> ReportTemplate | None:
    result = await db.execute(
        select(ReportTemplate).where(
            ReportTemplate.lender_id == lender_id,
            ReportTemplate.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def list_templates(
    db: AsyncSession, lender_id: UUID
) -> list[ReportTemplate]:
    result = await db.execute(
        select(ReportTemplate)
        .where(ReportTemplate.lender_id == lender_id)
        .order_by(ReportTemplate.created_at.desc())
    )
    return list(result.scalars().all())


async def activate_template(
    db: AsyncSession, template_id: UUID, lender_id: UUID
) -> ReportTemplate:
    template = await _get_owned_template(db, template_id, lender_id)
    await _deactivate_all(db, lender_id)
    template.is_active = True
    await db.flush()
    return template


async def delete_template(
    db: AsyncSession, template_id: UUID, lender_id: UUID
) -> None:
    template = await _get_owned_template(db, template_id, lender_id)
    if template.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete the active template")
    await db.delete(template)
    _invalidate_cache_for_template(template_id)
    await db.flush()


async def _get_owned_template(
    db: AsyncSession, template_id: UUID, lender_id: UUID
) -> ReportTemplate:
    result = await db.execute(
        select(ReportTemplate).where(
            ReportTemplate.id == template_id,
            ReportTemplate.lender_id == lender_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


async def _deactivate_all(db: AsyncSession, lender_id: UUID) -> None:
    await db.execute(
        update(ReportTemplate)
        .where(
            ReportTemplate.lender_id == lender_id,
            ReportTemplate.is_active == True,
        )
        .values(is_active=False)
    )


def _invalidate_cache_for_template(template_id: UUID) -> None:
    from app.core.constants import RENDERED_DIR

    rendered_dir = os.path.join(MEDIA_ROOT, RENDERED_DIR)
    if not os.path.exists(rendered_dir):
        return
    prefix = str(template_id)
    for filename in os.listdir(rendered_dir):
        if prefix in filename:
            os.remove(os.path.join(rendered_dir, filename))
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/template_service.py
git commit -m "feat(phase8): add template service with CRUD and logo upload"
```

---

## Task 4: PDF Render Service + Jinja2 Master Template

**Files:**
- Create: `backend/app/services/pdf_render_service.py`
- Create: `backend/app/templates/report_master.html`

- [ ] **Step 1: Create the Jinja2 master HTML template**

Create `backend/app/templates/report_master.html`:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: A4;
    margin: 20mm 15mm 25mm 15mm;
    @bottom-center {
      {% if footer.show_page_numbers %}
      content: "Page " counter(page) " of " counter(pages);
      font-size: 9px;
      color: #666;
      {% endif %}
    }
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11px;
    color: #333;
    line-height: 1.5;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: {{ header.primary_color }};
    color: white;
    margin-bottom: 20px;
    border-radius: 4px;
  }

  .header-logo img {
    max-width: 160px;
    max-height: 60px;
  }

  .header-text {
    text-align: right;
  }

  .header-text h1 {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 2px;
  }

  .header-text p {
    font-size: 12px;
    opacity: 0.9;
  }

  .fields-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }

  .fields-table tr:nth-child(even) {
    background-color: {{ header.secondary_color }};
  }

  .fields-table td {
    padding: 10px 14px;
    border: 1px solid #ddd;
    vertical-align: top;
  }

  .field-label {
    font-weight: 600;
    color: #555;
    width: 35%;
  }

  .field-value {
    color: #222;
  }

  .footer-text {
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid #ccc;
    font-size: 9px;
    color: #888;
    text-align: center;
  }

  .generated-at {
    margin-top: 8px;
    font-size: 8px;
    color: #aaa;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header">
    {% if header.show_logo and logo_data %}
    <div class="header-logo">
      <img src="data:image/png;base64,{{ logo_data }}" alt="Logo">
    </div>
    {% endif %}
    <div class="header-text">
      <h1>{{ header.bank_name }}</h1>
      <p>{{ header.subtitle }}</p>
    </div>
  </div>

  <table class="fields-table">
    {% for field in fields %}
    <tr>
      <td class="field-label">{{ field.label }}</td>
      <td class="field-value">{{ field.value }}</td>
    </tr>
    {% endfor %}
  </table>

  {% if footer.text %}
  <div class="footer-text">{{ footer.text }}</div>
  {% endif %}

  <div class="generated-at">Generated on {{ generated_at }}</div>
</body>
</html>
```

- [ ] **Step 2: Create the PDF render service**

Create `backend/app/services/pdf_render_service.py`:

```python
import base64
import os
from datetime import datetime
from uuid import UUID

from jinja2 import Environment, FileSystemLoader

from app.core.constants import MEDIA_ROOT, RENDERED_DIR
from app.models.report import Report
from app.models.template import ReportTemplate

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

_jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=True,
)


def render_report_pdf(report: Report, template: ReportTemplate) -> bytes:
    cache_path = _get_cache_path(report.id, template.id)
    if os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            return f.read()

    config = template.config_json
    header = config.get("header", {})
    sections = config.get("sections", [])
    footer = config.get("footer", {})

    enabled_sections = sorted(
        [s for s in sections if s.get("enabled")],
        key=lambda s: s.get("order", 0),
    )

    fields = []
    for section in enabled_sections:
        value = _get_field_value(report, section["key"])
        if value is not None:
            fields.append({"label": section["label"], "value": str(value)})

    logo_data = None
    if header.get("show_logo") and template.logo_path:
        logo_full_path = os.path.join(MEDIA_ROOT, template.logo_path)
        if os.path.exists(logo_full_path):
            with open(logo_full_path, "rb") as f:
                logo_data = base64.b64encode(f.read()).decode("utf-8")

    html_template = _jinja_env.get_template("report_master.html")
    html_content = html_template.render(
        header=header,
        fields=fields,
        footer=footer,
        logo_data=logo_data,
        generated_at=datetime.now().strftime("%d %b %Y, %I:%M %p"),
    )

    from weasyprint import HTML

    pdf_bytes = HTML(string=html_content).write_pdf()

    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "wb") as f:
        f.write(pdf_bytes)

    return pdf_bytes


def _get_field_value(report: Report, key: str):
    if hasattr(report, key):
        val = getattr(report, key)
        if val is not None:
            return val

    if report.content_json:
        for section_key in ("anchor_fields", "additional_fields"):
            section = report.content_json.get(section_key, {})
            if key in section:
                field_data = section[key]
                if isinstance(field_data, dict):
                    return field_data.get("value")
                return field_data

    return None


def _get_cache_path(report_id: UUID, template_id: UUID) -> str:
    return os.path.join(
        MEDIA_ROOT, RENDERED_DIR, f"{report_id}_{template_id}.pdf"
    )


def invalidate_report_cache(report_id: UUID) -> None:
    rendered_dir = os.path.join(MEDIA_ROOT, RENDERED_DIR)
    if not os.path.exists(rendered_dir):
        return
    prefix = str(report_id)
    for filename in os.listdir(rendered_dir):
        if filename.startswith(prefix):
            os.remove(os.path.join(rendered_dir, filename))
```

- [ ] **Step 3: Add weasyprint to backend dependencies**

In `backend/pyproject.toml`, add `weasyprint` to the `[tool.poetry.dependencies]` section:

```toml
weasyprint = ">=62.0"
```

Then regenerate the lock file:
```bash
cd backend && poetry lock
```

Rebuild the backend container:
```bash
docker compose -f docker-compose.local.yml build backend
docker compose -f docker-compose.local.yml up -d backend
```

**Note:** WeasyPrint requires system libraries (pango, cairo, gdk-pixbuf). Add to `backend/Dockerfile` before the pip install step:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
    libcairo2 libffi-dev && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/pdf_render_service.py backend/app/templates/report_master.html backend/pyproject.toml
git commit -m "feat(phase8): add PDF render service with Jinja2 + WeasyPrint"
```

---

## Task 5: Template API Router + Registration

**Files:**
- Create: `backend/app/api/lender/templates.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the templates API router**

Create `backend/app/api/lender/templates.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import TEMPLATE_FIELDS
from app.core.deps import get_db, require_role
from app.models.lender import LenderUser
from app.models.user import User
from app.schemas.template import (
    TemplateCreate,
    TemplateFieldOption,
    TemplateListResponse,
    TemplateResponse,
    TemplateUpdate,
)
from app.services import template_service
from fastapi import HTTPException
from sqlalchemy import select

router = APIRouter(prefix="/api/lender/templates", tags=["lender-templates"])


async def _get_lender_id(db, user_id: UUID) -> UUID:
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == user_id)
    )
    lu = result.scalar_one_or_none()
    if not lu:
        raise HTTPException(status_code=400, detail="User not associated with a lender")
    return lu.lender_id


@router.get("/fields", response_model=list[TemplateFieldOption])
async def get_available_fields(
    current_user: User = Depends(require_role("LENDER")),
):
    return [TemplateFieldOption(**f) for f in TEMPLATE_FIELDS]


@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    templates = await template_service.list_templates(db, lender_id)
    return TemplateListResponse(templates=templates)


@router.get("/active", response_model=TemplateResponse)
async def get_active_template(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    template = await template_service.get_active_template(db, lender_id)
    if not template:
        raise HTTPException(status_code=404, detail="No active template")
    return template


@router.post("/", response_model=TemplateResponse, status_code=201)
async def create_template(
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await template_service.create_template(
        db,
        lender_id=lender_id,
        name=payload.name,
        config_json=payload.config_json,
    )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: UUID,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await template_service.update_template(
        db,
        template_id=template_id,
        lender_id=lender_id,
        name=payload.name,
        config_json=payload.config_json,
    )


@router.post("/{template_id}/logo", response_model=TemplateResponse)
async def upload_logo(
    template_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await template_service.upload_logo(
        db, template_id=template_id, lender_id=lender_id, file=file
    )


@router.patch("/{template_id}/activate", response_model=TemplateResponse)
async def activate_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await template_service.activate_template(db, template_id, lender_id)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    await template_service.delete_template(db, template_id, lender_id)
```

- [ ] **Step 2: Register the router in `main.py`**

In `backend/app/main.py`, add the import after the admin_dashboard import (line 20):

```python
from app.api.lender.templates import router as lender_templates_router
```

And add the include after the last `app.include_router(...)` line (after line 58):

```python
app.include_router(lender_templates_router)
```

- [ ] **Step 3: Verify the server starts**

```bash
docker compose -f docker-compose.local.yml restart backend
docker compose -f docker-compose.local.yml logs backend --tail=20
```

Expected: No import errors, server running on port 8020.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/lender/templates.py backend/app/main.py
git commit -m "feat(phase8): add template API router with 8 endpoints"
```

---

## Task 6: Modify Download Endpoints for Template Support

**Files:**
- Modify: `backend/app/api/common/download.py`
- Modify: `backend/app/api/lender/listings.py`

- [ ] **Step 1: Update common download endpoint**

Replace the full contents of `backend/app/api/common/download.py` with:

```python
import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MEDIA_ROOT
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.lender import LenderUser
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{report_id}/download")
async def download_report(
    report_id: UUID,
    format: str = Query("original", regex="^(original|template)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.uploaded_file_path:
        raise HTTPException(status_code=404, detail="No file uploaded for this report")

    if format == "template" and current_user.user_type == "LENDER":
        pdf_bytes = await _try_render_template(db, report, current_user.id)
        if pdf_bytes:
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="report-{report.id}.pdf"'
                },
            )

    full_path = os.path.join(MEDIA_ROOT, report.uploaded_file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=full_path,
        media_type="application/pdf",
        filename=os.path.basename(report.uploaded_file_path),
    )


async def _try_render_template(
    db: AsyncSession, report: Report, user_id: UUID
) -> bytes | None:
    lu_result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == user_id)
    )
    lu = lu_result.scalar_one_or_none()
    if not lu:
        return None

    from app.services.template_service import get_active_template

    template = await get_active_template(db, lu.lender_id)
    if not template:
        return None

    from app.services.pdf_render_service import render_report_pdf

    return render_report_pdf(report, template)
```

- [ ] **Step 2: Update lender listings download endpoint**

In `backend/app/api/lender/listings.py`, update the `download_purchased_report` function (lines 71-104).

Replace the existing function with:

```python
@router.get("/purchases/{purchase_id}/download")
async def download_purchased_report(
    purchase_id: UUID,
    format: str = Query("original", regex="^(original|template)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)

    purchase_result = await db.execute(
        select(ReportPurchase).where(
            ReportPurchase.id == purchase_id,
            ReportPurchase.lender_id == lender_id,
        )
    )
    purchase = purchase_result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    report_result = await db.execute(
        select(Report).where(Report.id == purchase.report_id)
    )
    report = report_result.scalar_one_or_none()
    if not report or not report.uploaded_file_path:
        raise HTTPException(status_code=404, detail="Report file not found")

    if format == "template":
        from app.services.template_service import get_active_template
        from app.services.pdf_render_service import render_report_pdf

        template = await get_active_template(db, lender_id)
        if template:
            from fastapi.responses import Response

            pdf_bytes = render_report_pdf(report, template)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="report-{report.id}.pdf"'
                },
            )

    full_path = os.path.join(MEDIA_ROOT, report.uploaded_file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        full_path,
        media_type="application/pdf",
        filename=f"report-{report.id}.pdf",
    )
```

Add `Query` to the imports at the top of `backend/app/api/lender/listings.py` if not already present (it is already there on line 4).

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/common/download.py backend/app/api/lender/listings.py
git commit -m "feat(phase8): add template format option to download endpoints"
```

---

## Task 7: Frontend Types + Install dnd-kit

**Files:**
- Create: `frontend/src/types/template.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: Create TypeScript interfaces**

Create `frontend/src/types/template.ts`:

```typescript
export interface TemplateSectionField {
  key: string;
  label: string;
  enabled: boolean;
  order: number;
}

export interface TemplateHeader {
  bank_name: string;
  primary_color: string;
  secondary_color: string;
  show_logo: boolean;
  subtitle: string;
}

export interface TemplateFooter {
  text: string;
  show_page_numbers: boolean;
}

export interface TemplateConfig {
  header: TemplateHeader;
  sections: TemplateSectionField[];
  footer: TemplateFooter;
}

export interface ReportTemplate {
  id: string;
  lender_id: string;
  name: string;
  is_active: boolean;
  logo_path: string | null;
  config_json: TemplateConfig;
  created_at: string;
  updated_at: string;
}

export interface TemplateListResponse {
  templates: ReportTemplate[];
}

export interface TemplateFieldOption {
  key: string;
  label: string;
}
```

- [ ] **Step 2: Install dnd-kit packages**

```bash
cd /home/yogidigital/projects/propeval/frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/template.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(phase8): add template TypeScript types and dnd-kit dependencies"
```

---

## Task 8: Extract Users Tab + Add Tab Navigation to Lender Settings

**Files:**
- Create: `frontend/src/app/lender/settings/_components/users-tab.tsx`
- Modify: `frontend/src/app/lender/settings/page.tsx`

- [ ] **Step 1: Extract users tab component**

Create `frontend/src/app/lender/settings/_components/users-tab.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/auth";

export default function UsersTab() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<UserResponse[]>("/api/lender/settings/users")
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Desktop/Tablet: Table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Mobile</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No users found.</td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{u.mobile}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-3">
        {loading && <p className="text-center text-gray-400 py-8">Loading…</p>}
        {!loading && users.length === 0 && <p className="text-center text-gray-400 py-8">No users found.</p>}
        {users.map((u) => (
          <div key={u.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-medium text-gray-900">{u.full_name}</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {u.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-sm text-gray-500">{u.email}</div>
            <div className="text-sm text-gray-500">{u.mobile}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite settings page with tab navigation**

Replace the full contents of `frontend/src/app/lender/settings/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import UsersTab from "./_components/users-tab";

const TABS = [
  { key: "users", label: "Users" },
  { key: "template", label: "Report Template" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function LenderSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("users");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your organisation settings</p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "template" && (
        <div className="text-sm text-gray-400 py-8 text-center">
          Template builder loading…
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3020/lender/dashboard`, log in as `lender@abcl.com` / `lender123`, navigate to Settings. Confirm:
- Two tabs visible: "Users" and "Report Template"
- Users tab shows the user table as before
- Report Template tab shows placeholder text

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/lender/settings/_components/users-tab.tsx frontend/src/app/lender/settings/page.tsx
git commit -m "feat(phase8): add tab navigation to lender settings, extract users tab"
```

---

## Task 9: Field List Component (Drag-and-Drop)

**Files:**
- Create: `frontend/src/app/lender/settings/_components/field-list.tsx`

- [ ] **Step 1: Create the sortable field list component**

Create `frontend/src/app/lender/settings/_components/field-list.tsx`:

```tsx
"use client";
import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TemplateSectionField } from "@/types/template";

interface FieldListProps {
  fields: TemplateSectionField[];
  onChange: (fields: TemplateSectionField[]) => void;
}

function SortableField({
  field,
  onToggle,
  onLabelChange,
}: {
  field: TemplateSectionField;
  onToggle: () => void;
  onLabelChange: (label: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-200 rounded-lg ${
        !field.enabled ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
        {...attributes}
        {...listeners}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      <input
        type="checkbox"
        checked={field.enabled}
        onChange={onToggle}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />

      <input
        type="text"
        value={field.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="flex-1 text-sm border-0 bg-transparent focus:ring-0 p-0 text-gray-900"
      />

      <span className="text-xs text-gray-400 hidden sm:inline">{field.key}</span>
    </div>
  );
}

export default function FieldList({ fields, onChange }: FieldListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fieldIds = useMemo(() => fields.map((f) => f.key), [fields]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.key === active.id);
    const newIndex = fields.findIndex((f) => f.key === over.id);
    const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
      ...f,
      order: i + 1,
    }));
    onChange(reordered);
  }

  function handleToggle(key: string) {
    onChange(
      fields.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  }

  function handleLabelChange(key: string, label: string) {
    onChange(
      fields.map((f) => (f.key === key ? { ...f, label } : f))
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {fields.map((field) => (
            <SortableField
              key={field.key}
              field={field}
              onToggle={() => handleToggle(field.key)}
              onLabelChange={(label) => handleLabelChange(field.key, label)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/lender/settings/_components/field-list.tsx
git commit -m "feat(phase8): add drag-and-drop field list component"
```

---

## Task 10: Template Builder Component

**Files:**
- Create: `frontend/src/app/lender/settings/_components/template-builder.tsx`
- Modify: `frontend/src/app/lender/settings/page.tsx`

- [ ] **Step 1: Create the template builder component**

Create `frontend/src/app/lender/settings/_components/template-builder.tsx`:

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import FieldList from "./field-list";
import type {
  ReportTemplate,
  TemplateConfig,
  TemplateFieldOption,
  TemplateSectionField,
} from "@/types/template";

const DEFAULT_CONFIG: TemplateConfig = {
  header: {
    bank_name: "",
    primary_color: "#1a3b5c",
    secondary_color: "#f0f4f8",
    show_logo: true,
    subtitle: "Property Valuation Report",
  },
  sections: [],
  footer: {
    text: "Confidential - For internal use only",
    show_page_numbers: true,
  },
};

export default function TemplateBuilder() {
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [config, setConfig] = useState<TemplateConfig>(DEFAULT_CONFIG);
  const [name, setName] = useState("My Template");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [archivedTemplates, setArchivedTemplates] = useState<ReportTemplate[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadTemplate = useCallback(async () => {
    try {
      const [fieldOptions, activeTemplate] = await Promise.allSettled([
        api.get<TemplateFieldOption[]>("/api/lender/templates/fields"),
        api.get<ReportTemplate>("/api/lender/templates/active"),
      ]);

      const fields =
        fieldOptions.status === "fulfilled" ? fieldOptions.value : [];

      if (activeTemplate.status === "fulfilled") {
        const t = activeTemplate.value;
        setTemplate(t);
        setName(t.name);
        setConfig(t.config_json as TemplateConfig);
      } else {
        const defaultSections: TemplateSectionField[] = fields.map(
          (f, i) => ({
            key: f.key,
            label: f.label,
            enabled: ["property_address", "property_type", "valuation_amount", "loan_applicant_name", "report_date"].includes(f.key),
            order: i + 1,
          })
        );
        setConfig((prev) => ({ ...prev, sections: defaultSections }));
      }
    } catch {
      // Ignore — no active template is valid
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  async function loadHistory() {
    try {
      const data = await api.get<{ templates: ReportTemplate[] }>("/api/lender/templates/");
      setArchivedTemplates(data.templates.filter((t) => !t.is_active));
      setShowHistory(true);
    } catch {
      toast.error("Failed to load template history");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { name, config_json: config };
      let saved: ReportTemplate;

      if (template) {
        saved = await api.put<ReportTemplate>(`/api/lender/templates/${template.id}`, payload);
      } else {
        saved = await api.post<ReportTemplate>("/api/lender/templates/", payload);
      }

      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        saved = await api.upload<ReportTemplate>(`/api/lender/templates/${saved.id}/logo`, formData);
      }

      setTemplate(saved);
      toast.success("Template saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    try {
      const activated = await api.patch<ReportTemplate>(`/api/lender/templates/${id}/activate`, {});
      setTemplate(activated);
      setName(activated.name);
      setConfig(activated.config_json as TemplateConfig);
      setShowHistory(false);
      toast.success("Template activated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to activate");
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Logo must be PNG or JPEG");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-8">Loading…</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Template name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Header Config */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Header</h3>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Logo</label>
          <div className="flex items-center gap-4">
            {(logoPreview || template?.logo_path) && (
              <img
                src={logoPreview || `/api/media/${template?.logo_path}`}
                alt="Logo preview"
                className="h-10 object-contain border border-gray-200 rounded px-2 py-1"
              />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoChange}
              className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Bank Name</label>
            <input
              type="text"
              value={config.header.bank_name}
              onChange={(e) =>
                setConfig((c) => ({ ...c, header: { ...c.header, bank_name: e.target.value } }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Subtitle</label>
            <input
              type="text"
              value={config.header.subtitle}
              onChange={(e) =>
                setConfig((c) => ({ ...c, header: { ...c.header, subtitle: e.target.value } }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.header.primary_color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, primary_color: e.target.value } }))
                }
                className="h-9 w-9 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={config.header.primary_color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, primary_color: e.target.value } }))
                }
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.header.secondary_color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, secondary_color: e.target.value } }))
                }
                className="h-9 w-9 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={config.header.secondary_color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, header: { ...c.header, secondary_color: e.target.value } }))
                }
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Field Selection & Ordering */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-gray-900">Fields</h3>
        <p className="text-xs text-gray-500">Drag to reorder. Check to include in the template.</p>
        <FieldList
          fields={config.sections}
          onChange={(sections) => setConfig((c) => ({ ...c, sections }))}
        />
      </div>

      {/* Footer Config */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Footer</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Footer Text</label>
          <input
            type="text"
            value={config.footer.text}
            onChange={(e) =>
              setConfig((c) => ({ ...c, footer: { ...c.footer, text: e.target.value } }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.footer.show_page_numbers}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                footer: { ...c.footer, show_page_numbers: e.target.checked },
              }))
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show page numbers
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Template"}
        </button>
        <button
          onClick={loadHistory}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Template History
        </button>
      </div>

      {/* Template History */}
      {showHistory && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-gray-900">Archived Templates</h3>
          {archivedTemplates.length === 0 && (
            <p className="text-sm text-gray-400">No archived templates.</p>
          )}
          {archivedTemplates.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-900">{t.name}</div>
                <div className="text-xs text-gray-400">
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleActivate(t.id)}
                className="text-xs px-3 py-1 border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50"
              >
                Activate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire template builder into the settings page**

In `frontend/src/app/lender/settings/page.tsx`, replace the placeholder template tab content.

Change the import section to add:
```tsx
import TemplateBuilder from "./_components/template-builder";
```

Replace the template tab placeholder:
```tsx
      {activeTab === "template" && (
        <div className="text-sm text-gray-400 py-8 text-center">
          Template builder loading…
        </div>
      )}
```

With:
```tsx
      {activeTab === "template" && <TemplateBuilder />}
```

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:3020/lender/settings`, click "Report Template" tab. Confirm:
- Header section with logo upload, bank name, subtitle, color pickers
- Fields section with draggable/checkable field list
- Footer section with text input and page number toggle
- Save Template button and Template History link

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/lender/settings/_components/template-builder.tsx frontend/src/app/lender/settings/page.tsx
git commit -m "feat(phase8): add template builder component with form-based config"
```

---

## Task 11: Download Button Component

**Files:**
- Create: `frontend/src/components/download-button.tsx`

- [ ] **Step 1: Create the download button component**

Create `frontend/src/components/download-button.tsx`:

```tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ReportTemplate } from "@/types/template";

interface DownloadButtonProps {
  downloadUrl: string;
  filename?: string;
  className?: string;
}

export default function DownloadButton({ downloadUrl, filename, className }: DownloadButtonProps) {
  const [hasTemplate, setHasTemplate] = useState(false);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<ReportTemplate>("/api/lender/templates/active")
      .then(() => setHasTemplate(true))
      .catch(() => setHasTemplate(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = useCallback(async (format: "original" | "template") => {
    setDownloading(true);
    setOpen(false);
    try {
      const separator = downloadUrl.includes("?") ? "&" : "?";
      const url = `${downloadUrl}${separator}format=${format}`;
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "localhost:8020" : ""}${url}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "report.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Silently fail — the API layer handles 401 redirects
    } finally {
      setDownloading(false);
    }
  }, [downloadUrl, filename]);

  const baseClass = className || "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50";

  if (!hasTemplate) {
    return (
      <button onClick={() => handleDownload("original")} disabled={downloading} className={baseClass}>
        {downloading ? "Downloading…" : "Download PDF"}
      </button>
    );
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div className="flex">
        <button
          onClick={() => handleDownload("template")}
          disabled={downloading}
          className={`${baseClass} rounded-r-none`}
        >
          {downloading ? "Downloading…" : "Download (My Template)"}
        </button>
        <button
          onClick={() => setOpen(!open)}
          disabled={downloading}
          className={`${baseClass} rounded-l-none border-l border-blue-500 px-2`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <button
            onClick={() => handleDownload("template")}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
          >
            Download (My Template)
          </button>
          <button
            onClick={() => handleDownload("original")}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg border-t border-gray-100"
          >
            Download (Original)
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/download-button.tsx
git commit -m "feat(phase8): add split download button with template/original options"
```

---

## Task 12: Integrate Download Button into Lender Pages

**Files:**
- Modify: lender request detail page and lender purchases page (find exact paths)

- [ ] **Step 1: Find and update lender download locations**

Search for existing download buttons/links in lender pages:

```bash
grep -rn "download" frontend/src/app/lender/ --include="*.tsx" -l
```

For each page that has a download action, replace the existing download button/link with the `DownloadButton` component:

```tsx
import DownloadButton from "@/components/download-button";

// Replace existing download link/button with:
<DownloadButton
  downloadUrl={`/api/lender/listings/purchases/${purchase.id}/download`}
  filename={`report-${purchase.report_id}.pdf`}
/>
```

For the common report download (on request detail pages):
```tsx
<DownloadButton
  downloadUrl={`/api/reports/${reportId}/download`}
  filename={`report-${reportId}.pdf`}
/>
```

- [ ] **Step 2: Fix the download URL construction**

The `DownloadButton` component uses the `api.ts` base URL logic. Update the `handleDownload` function to use the same `getApiBaseUrl` pattern. The fetch URL should be:

```typescript
const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8020"
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8020");

const response = await fetch(`${apiBase}${url}`, { ... });
```

- [ ] **Step 3: Verify in browser**

Log in as lender, navigate to a request detail with a report, and to purchased reports. Confirm:
- If no template configured: single "Download PDF" button
- If template configured: split button with "Download (My Template)" primary + dropdown for "Original"

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/lender/ frontend/src/components/download-button.tsx
git commit -m "feat(phase8): integrate download button into lender pages"
```

---

## Task 13: Vendor Settings Info Note

**Files:**
- Modify: `frontend/src/app/vendor/settings/page.tsx`

- [ ] **Step 1: Add informational note to vendor settings**

In `frontend/src/app/vendor/settings/page.tsx`, add an info box after the users section (before the closing `</div>` of the main container):

```tsx
      {/* Template info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-700">
          Reports you upload are stored in their original PDF format. Lenders with custom templates will see a formatted version when they download.
        </p>
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/vendor/settings/page.tsx
git commit -m "feat(phase8): add template info note to vendor settings"
```

---

## Task 14: Dockerfile Update + Seed Template Data + CLAUDE.md

**Files:**
- Modify: `backend/Dockerfile` (add WeasyPrint system deps)
- Modify: `backend/scripts/seed_demo.py` (add sample template for ABCL Bank)
- Modify: `CLAUDE.md` (update Phase 8 status)

- [ ] **Step 1: Update Dockerfile for WeasyPrint system dependencies**

In `backend/Dockerfile`, add the following `RUN` command before the `poetry install` or `pip install` step:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
    libcairo2 libffi-dev && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Add sample template to seed_demo.py**

Add to the end of `backend/scripts/seed_demo.py` (inside the `seed_demo()` function, before the final print):

```python
        # ── Sample report template for ABCL Bank ────────────────────────────
        from app.models.template import ReportTemplate

        template = ReportTemplate(
            lender_id=lenders[0].id,
            name="ABCL Standard Template",
            is_active=True,
            config_json={
                "header": {
                    "bank_name": "ABCL Bank",
                    "primary_color": "#1a3b5c",
                    "secondary_color": "#f0f4f8",
                    "show_logo": True,
                    "subtitle": "Property Valuation Report",
                },
                "sections": [
                    {"key": "property_address", "label": "Property Address", "enabled": True, "order": 1},
                    {"key": "property_type", "label": "Property Type", "enabled": True, "order": 2},
                    {"key": "valuation_amount", "label": "Valuation Amount", "enabled": True, "order": 3},
                    {"key": "loan_applicant_name", "label": "Applicant Name", "enabled": True, "order": 4},
                    {"key": "report_date", "label": "Report Date", "enabled": True, "order": 5},
                    {"key": "city", "label": "City", "enabled": True, "order": 6},
                    {"key": "pin_code", "label": "PIN Code", "enabled": True, "order": 7},
                    {"key": "plot_extent_sqft", "label": "Plot Area (sq ft)", "enabled": False, "order": 8},
                    {"key": "built_up_sqft", "label": "Built-up Area (sq ft)", "enabled": False, "order": 9},
                    {"key": "expiry_date", "label": "Expiry Date", "enabled": False, "order": 10},
                ],
                "footer": {
                    "text": "Confidential - ABCL Bank Internal Use Only",
                    "show_page_numbers": True,
                },
            },
        )
        db.add(template)
        print(f"Created report template: {template.name}")
```

- [ ] **Step 3: Update CLAUDE.md**

Update Phase 8 status from the milestone list to "Complete" and add new key files.

In the "Current Status" section, add after Phase 7:
```
**Phase 8 (Templates & Report Formatting):** Complete — ReportTemplate model + CRUD service, form-based template builder (header/logo/colors, field selection/ordering, footer), PDF render service (Jinja2 + WeasyPrint), template/original download choice, lender settings tabs
```

In the "Key Files" section, add:
```
- `backend/app/models/template.py` — ReportTemplate model (config_json JSONB)
- `backend/app/services/template_service.py` — Template CRUD + logo upload
- `backend/app/services/pdf_render_service.py` — Jinja2 + WeasyPrint PDF rendering
- `backend/app/api/lender/templates.py` — Lender template endpoints (8)
- `backend/app/templates/report_master.html` — Jinja2 HTML master template for PDF output
```

- [ ] **Step 4: Rebuild and reseed**

```bash
docker compose -f docker-compose.local.yml build backend
docker compose -f docker-compose.local.yml up -d backend
# Drop and recreate DB, run migrations, seed
docker compose -f docker-compose.local.yml exec db psql -U propeval -d propeval -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose -f docker-compose.local.yml exec backend alembic upgrade head
docker compose -f docker-compose.local.yml exec backend python -m scripts.seed
docker compose -f docker-compose.local.yml exec backend python -m scripts.seed_demo
```

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile backend/scripts/seed_demo.py CLAUDE.md
git commit -m "feat(phase8): add WeasyPrint deps, seed template, update CLAUDE.md"
```

---

## Task 15: End-to-End Verification

- [ ] **Step 1: Verify template CRUD via API**

```bash
# Login as lender
TOKEN=$(curl -s -X POST http://localhost:8020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lender@abcl.com","password":"lender123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Get active template
curl -s http://localhost:8020/api/lender/templates/active \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Get available fields
curl -s http://localhost:8020/api/lender/templates/fields \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: Active template returned with ABCL config. Fields list with 13 options.

- [ ] **Step 2: Verify template download**

```bash
# Find a report ID from the seed data
REPORT_ID=$(curl -s http://localhost:8020/api/lender/requests/ \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['items'][0]['report_id'] if data.get('items') and data['items'][0].get('report_id') else 'none')")

# Download with template format
curl -s -o /tmp/template-report.pdf \
  "http://localhost:8020/api/reports/$REPORT_ID/download?format=template" \
  -H "Authorization: Bearer $TOKEN"

# Check the file
file /tmp/template-report.pdf
```

Expected: PDF file with template formatting (or original if no report has data).

- [ ] **Step 3: Verify frontend template builder**

Open `http://localhost:3020/lender/settings` in a browser, log in as lender. Navigate to "Report Template" tab. Confirm:
- Template loads with ABCL seed data (bank name, colors, 7 enabled fields)
- Fields are draggable and checkboxes work
- Color pickers show current colors
- Save button works without errors
- Template History link shows no archived templates (only one exists)

- [ ] **Step 4: Verify download button on lender pages**

Navigate to a lender request detail or purchased reports page. Confirm:
- Split download button appears with "Download (My Template)" as primary
- Dropdown shows both options
- Both download options produce PDF files
