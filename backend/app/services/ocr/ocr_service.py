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

            # Sync extracted data to top-level model columns for indexing
            self._sync_extracted_data(report, result)

            report.status = ReportStatus.READY_TO_PUBLISH
            logger.info(
                "OCR extraction succeeded for report %s (%d pages)",
                report.id, result.page_count,
            )
        except Exception as e:
            logger.exception("OCR extraction failed for report %s: %s", report.id, e)
            report.status = ReportStatus.EXTRACTION_FAILED

        await db.flush()

    def _sync_extracted_data(self, report: Report, result: "ExtractionResult") -> None:
        """Sync extracted fields from result to model attributes."""
        from decimal import Decimal, InvalidOperation
        from datetime import datetime
        import re

        def _get_val(field_data):
            if isinstance(field_data, dict):
                return field_data.get("value")
            return field_data

        def _to_decimal(val):
            if val is None: return None
            try: return Decimal(str(val).replace(",", "").strip())
            except (InvalidOperation, ValueError): return None

        def _to_int(val):
            if val is None: return None
            try: return int(val)
            except (ValueError, TypeError): return None

        def _to_date(val):
            if val is None: return None
            try: return datetime.strptime(str(val), "%Y-%m-%d").date()
            except (ValueError, TypeError): return None

        # Map Anchor Fields (Core indexing)
        anchor = result.anchor_fields
        if "property_address" in anchor: report.property_address = _get_val(anchor["property_address"])
        if "valuation_amount" in anchor: report.valuation_amount = _to_decimal(_get_val(anchor["valuation_amount"]))
        if "owner_name" in anchor: report.loan_applicant_name = _get_val(anchor["owner_name"])
        if "latitude" in anchor: report.latitude = _to_decimal(_get_val(anchor["latitude"]))
        if "longitude" in anchor: report.longitude = _to_decimal(_get_val(anchor["longitude"]))
        if "built_up_area" in anchor:
            val = _get_val(anchor["built_up_area"])
            if val:
                nums = re.findall(r"\d+\.?\d*", str(val))
                if nums: report.built_up_sqft = _to_decimal(nums[0])

        # Map Additional Fields (Sectioned details)
        add = result.additional_fields

        # Section: General
        gen = add.get("general", {})
        report.customer_id = _get_val(gen.get("customer_id"))
        report.nearest_landmark = _get_val(gen.get("nearest_landmark"))
        report.society_name = _get_val(gen.get("society_name"))
        report.builder_developer = _get_val(gen.get("builder_developer"))
        report.contact_detail = _get_val(gen.get("contact_detail"))
        report.case_type = _get_val(gen.get("case_type"))
        report.inspection_date = _to_date(_get_val(gen.get("inspection_date")))

        # Section: Locality
        loc = add.get("locality", {})
        report.ward_no = _get_val(loc.get("ward_no"))
        report.vicinity = _get_val(loc.get("vicinity"))
        report.property_type_approvals = _get_val(loc.get("property_type_per_approvals"))
        report.nearest_railway_station = _get_val(loc.get("nearest_railway_station"))
        report.nearest_bus_stop = _get_val(loc.get("nearest_bus_stop"))
        report.nearest_hospital = _get_val(loc.get("nearest_hospital"))
        report.tenure_type = _get_val(loc.get("tenure_type"))

        # Section: Property Details
        prop = add.get("property_details", {})
        report.usage_observed = _get_val(prop.get("usage_observed"))
        report.no_of_stories = _to_int(_get_val(prop.get("no_of_stories")))
        report.occupied_by = _get_val(prop.get("occupied_by"))
        report.within_municipal_limits = _get_val(prop.get("within_municipal_limits"))

        # Section: Boundaries
        bound = add.get("boundaries", {})
        site, deed = bound.get("as_per_site", {}), bound.get("as_per_deed", {})
        report.north_site, report.south_site = _get_val(site.get("north")), _get_val(site.get("south"))
        report.east_site, report.west_site = _get_val(site.get("east")), _get_val(site.get("west"))
        report.north_deed, report.south_deed = _get_val(deed.get("north")), _get_val(deed.get("south"))
        report.east_deed, report.west_deed = _get_val(deed.get("east")), _get_val(deed.get("west"))
        report.boundaries_match = _get_val(bound.get("matches_documentation"))

        # Section: Structural
        struct = add.get("structural_details", {})
        report.structure_type = _get_val(struct.get("structure_type"))
        report.no_of_floors = _to_int(_get_val(struct.get("no_of_floors")))
        report.no_of_wings = _to_int(_get_val(struct.get("no_of_wings")))
        report.flats_per_floor = _to_int(_get_val(struct.get("flats_per_floor")))
        report.no_of_lifts = _to_int(_get_val(struct.get("no_of_lifts")))
        report.internal_composition = _get_val(struct.get("internal_composition"))
        report.age_of_property, report.future_life = _get_val(struct.get("age_of_property")), _get_val(struct.get("future_life"))
        report.construction_stage, report.recommendation = _get_val(struct.get("construction_stage")), _get_val(struct.get("recommendation"))

        # Section: Technical & Quality
        tech, q = add.get("technical_approvals", {}), add.get("quality_of_construction", {})
        report.approved_plan_no_date = _get_val(tech.get("approved_plan_no_date"))
        report.violations_observed = _get_val(tech.get("violations_observed"))
        report.conforms_to_byelaws = _get_val(tech.get("confirm_local_byelaws"))
        report.quality_maintenance = _get_val(q.get("maintenance_appearance"))
        report.quality_finishing = _get_val(q.get("flooring_finishing"))

        # Section: Valuation
        fmv, rec = add.get("valuation_fmv", {}), add.get("recommended_valuation", {})
        report.rate_per_sqft = _to_decimal(_get_val(fmv.get("rate_per_sqft")))
        report.final_comparison_value = _to_decimal(_get_val(fmv.get("final_comparison_value")))
        report.stage_pct = _to_decimal(_get_val(rec.get("stage_pct")))
        report.realizable_value = _to_decimal(_get_val(rec.get("realizable_value")))
        report.distressed_valuation = _to_decimal(_get_val(rec.get("distressed_valuation_80pct")))
        report.rental_value = _to_decimal(_get_val(rec.get("rental_value_per_month")))
        report.reconstruction_cost = _to_decimal(_get_val(rec.get("reconstruction_cost_insurable_value")))
        report.remarks = _get_val(add.get("remarks"))
