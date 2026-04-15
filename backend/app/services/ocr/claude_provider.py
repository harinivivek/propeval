import base64
import json

import fitz  # PyMuPDF

from app.services.ocr.base import ExtractionResult, OcrProvider

EXTRACTION_PROMPT = """You are analyzing a property valuation / technical appraisal report from India.
Extract all relevant structured data from this document.

You MUST return a JSON object with exactly three keys:
- "anchor_fields": Always try to extract these core fields:
  - property_address (text): Full property address with floor and pin code
  - property_type (text): residential, commercial, industrial, or agricultural
  - valuation_amount (currency): Final recommended market/fair value in INR
  - built_up_area (text): Built-up area with unit
  - owner_name (text): Property owner or loan applicant name

- "sections": Extract fields organized into these sections. Each section is an object whose keys are field names and values are field objects.

  "general" — Section (a) General:
    - customer_id (text)
    - property_address_with_floor_pin (text): Full address with floor no & pin code
    - nearest_landmark (text)
    - cooperative_housing_society (text): Name of the co-operative housing society
    - builder_developer (text): Builder / Developer name
    - contact_detail (text)
    - case_type (text)
    - current_owner_name (text): Name of the current owner
    - address_of_property (text)
    - date_of_inspection (date)

  "locality" — Section (b) Locality:
    - ward_no_municipal_land_no (text): Ward No / Municipal Land No
    - vicinity (text)
    - type_property_as_per_approvals (text): Type of property as per approvals
    - proximity_civic_amenities (text): Proximity to civic amenities overview
    - nearest_railway_station (text): Name and distance
    - nearest_bus_stop (text): Name and distance
    - nearest_hospital (text): Name and distance
    - conditions_of_approach (text)
    - plot_demarcated_at_site (text): Whether plot is demarcated at site
    - land_freehold_or_leasehold (text): Freehold/Leasehold, term, period expired, balance, lease rent
    - identified_through_person_met (text): Person met at site for identification

  "property" — Section (c) Property:
    - property_usage_observation (text): Property usage as per site observation
    - additional_amenities (text): Amenities within the property
    - no_of_stories (number)
    - occupied_by (text)
    - relationship_occupant_customer (text): Relationship of occupant with customer
    - name_on_society_board (text)
    - within_municipal_limits (text): Yes/No

  "boundaries" — Section (d) Boundaries:
    - north_as_per_deed (text)
    - south_as_per_deed (text)
    - east_as_per_deed (text)
    - west_as_per_deed (text)
    - north_as_per_site (text)
    - south_as_per_site (text)
    - east_as_per_site (text)
    - west_as_per_site (text)
    - boundaries_match (text): Whether boundaries at site match documentation

  "structural_details" — Section (e) Structural Details:
    - type_of_structure (text)
    - no_of_floors (number)
    - no_of_wings (number)
    - no_of_flats_each_floor (number)
    - no_of_lifts (number)
    - internal_composition (text): Internal composition of flat/house/plot
    - age_of_property (text): Age in years
    - estimated_future_life (text): Estimated future life in years
    - construction_stage (text): Current construction stage
    - recommendation (text)

  "quality_of_construction" — Section (f) Quality of Construction:
    - beam_column_structure (text)
    - appearance_maintenance (text): Appearance & maintenance of building
    - flooring_finishing (text): Flooring & finishing, wood work, etc.
    - roofing_terracing (text)
    - quality_fixtures_fittings (text)

  "technical_approvals" — Section (g) Technical Approvals:
    - layout_plan_details (text): Details of layout plan
    - approved_plan_details (text): Approved plan with approval no and date
    - construction_permission (text): Construction permission number and date
    - legal_document_details (text)
    - violations_observed (text)
    - structure_confirming_byelaws (text): If plans not available, does structure confirm to local byelaws

  "valuation_fair_market" — Section (h) Valuation by Fair Market Value:
    - area_as_per_measurement (text): Area as per measurement (with unit)
    - area_as_per_agreement (text)
    - area_as_per_approved_plan (text)
    - area_considered_for_valuation (text)
    - rate_per_sqft (currency): Rate per sq.ft.
    - fair_market_value_unit (currency): (A) Fair Market Value of the Unit
    - car_parks_count (number): Number of car parks
    - car_park_rate (currency): Rate per park
    - parking_value (currency): (B) Value of Parking
    - one_time_acquisition_cost (currency): (C) One Time Acquisition Cost
    - final_value_comparison_method (currency): Final Value by Comparison Method (A+B+C)

  "valuation_land_building" — Section (i) Valuation by Land & Building Method:
    - land_area_as_per_plan (text)
    - land_area_as_per_deed (text)
    - land_area_as_per_measurement (text)
    - land_area_considered (text)
    - land_rate (currency)
    - land_value (currency): (A) Land Value
    - area_measurement_lb (text): Area as per measurement
    - area_agreement_lb (text): Area as per agreement
    - area_approved_plan_lb (text): Area as per approved plan
    - area_considered_lb (text): Area considered for valuation
    - loading (text): Loading percentage
    - built_up_area_lb (text): Built-up area
    - construction_rate (currency): Construction rate
    - construction_cost_completion (currency): (B) Construction cost at completion
    - current_construction_stage_pct (text): (C) Current stage of construction (%)
    - proportionate_construction_cost (currency): (D) Proportionate construction cost as on date = B * C
    - value_land_building_current (currency): Value by Land & Building method as on date (YY) = A + D
    - value_land_building_completion (currency): Value by Land & Building method on completion (ZZ) = A + B

  "recommended_valuation" — Section (j) Recommended Valuation:
    - stage_of_construction (text)
    - stage_percentage (text): Stage in %
    - recommended_disbursement_pct (text): % Recommended disbursement
    - recommended_mortgage_valuation (currency): Recommended net mortgage valuation by comparison method
    - realizable_value (currency)
    - distressed_valuation_80pct (currency): Distressed valuation @80%
    - rental_value_per_month (currency)
    - longitude_latitude (text): Longitude & Latitude
    - reconstruction_cost_insurable (currency): Reconstruction cost / Insurable value

  "remarks" — Section (k) Remarks:
    - remarks (text): Any remarks or observations

  "google_location" — Section (l) Google Location:
    - google_location_url (text): Google Maps URL or description of property location

  "photos" — Section (m) Photos:
    - photos_description (text): Description of photos included in the report (list what photos are present)

- "additional_fields": Any other relevant fields found in the document that do not fit the above sections.

For each field, provide:
- "value": The extracted value
- "confidence": Your confidence score from 0.0 to 1.0
- "type": One of "text", "number", "currency", "date"

If a field is not found in the document, omit it from the section.
If an entire section has no fields found, omit the section.
Return ONLY valid JSON, no other text."""


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
            sections=parsed.get("sections", {}),
            raw_text=raw_text,
            page_count=page_count,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )
