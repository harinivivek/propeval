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
