import base64
import json

import fitz  # PyMuPDF

from app.services.ocr.base import ExtractionResult, OcrProvider

EXTRACTION_PROMPT = """You are analyzing a property valuation or legal due diligence report from India.
Extract all relevant structured data from this document.
Note: Section headings in the document may not match these exact labels; identify sections based on semantic similarity and context (e.g., "Building Specifications" should be mapped to "structural_details").

You MUST return a JSON object with exactly two keys:
- "anchor_fields": Extract these primary fields for indexing:
    - property_address: Full address with floor no & pin code
    - property_type: Must be one of: residential, commercial, industrial, or agricultural
    - valuation_amount: Final Recommended Net Mortgage Valuation (Comparison Method)
    - built_up_area: Total built-up area used for valuation
    - owner_name: Name of the current owner
    - latitude: Decimal latitude
    - longitude: Decimal longitude

- "additional_fields": Organize the following sections:
    - general: {
        customer_id, nearest_landmark, society_name, builder_developer, 
        contact_detail, case_type, inspection_date
      }
    - locality: {
        ward_no, vicinity, property_type_per_approvals, proximity_civic_amenities,
        nearest_railway_station, nearest_bus_stop, nearest_hospital, 
        approach_conditions, plot_demarcated, tenure_type (freehold/leasehold)
      }
    - property_details: {
        usage_observed, additional_amenities, no_of_stories, occupied_by,
        occupant_relationship, name_on_board, within_municipal_limits
      }
    - boundaries: {
        as_per_deed: {north, south, east, west},
        as_per_site: {north, south, east, west},
        matches_documentation: boolean
      }
    - structural_details: {
        structure_type, no_of_floors, no_of_wings, flats_per_floor, 
        no_of_lifts, internal_composition, age_of_property, future_life, 
        construction_stage, recommendation
      }
    - quality_of_construction: {
        beam_column_structure, maintenance_appearance, flooring_finishing,
        roofing_terracing, fixtures_quality
      }
    - technical_approvals: {
        layout_plan_details, approved_plan_no_date, construction_permission_no_date,
        legal_document_details, violations_observed, confirm_local_byelaws
      }
    - valuation_fmv: {
        area_measurement, area_agreement, area_approved_plan, area_considered,
        rate_per_sqft, fmv_value, parking_value, acquisition_cost, final_comparison_value
      }
    - valuation_land_building: {
        land: {area_plan, area_deed, area_measurement, area_considered, rate, value},
        construction: {area_measurement, area_agreement, area_approved_plan, area_considered, 
                       loading, built_up_area, rate, cost_at_completion, current_stage_pct,
                       proportionate_cost},
        value_as_on_date, value_on_completion
      }
    - recommended_valuation: {
        stage_of_construction, stage_pct, recommended_disbursement_pct, 
        realizable_value, distressed_valuation_80pct, rental_value_per_month,
        reconstruction_cost_insurable_value
      }
    - remarks: Overall summary or specific notes
    - photos: List any photo captions or descriptions found

For each field, provide:
- "value": The extracted value
- "confidence": Your confidence score (0.0 to 1.0)
- "type": One of "text", "number", "currency", "date", "boolean"

If a field or section is not found in the document, omit it. Return ONLY valid JSON."""

class ClaudeOcrProvider(OcrProvider):
    def __init__(self, client, model: str = "claude-sonnet-4-6"):
        self._client = client
        self._model = model

    def _pdf_to_images(self, pdf_path: str, max_pages: int = 20) -> list[bytes]:
        """Convert PDF pages to PNG images."""
        images = []
        with fitz.open(pdf_path) as doc:
            for page_num in range(min(len(doc), max_pages)):
                page = doc[page_num]
                pix = page.get_pixmap(dpi=150)
                images.append(pix.tobytes("png"))
        return images

    async def extract(self, pdf_path: str) -> ExtractionResult:
        """Extract structured data from PDF using Claude vision."""
        images = self._pdf_to_images(pdf_path)
        page_count = len(images)

        content = []
        for i, img_bytes in enumerate(images):
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": b64},
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
