import pytest
from app.services.ocr.base import ExtractionResult, OcrProvider


def test_extraction_result_creation():
    result = ExtractionResult(
        anchor_fields={"property_address": {"value": "123 Main St", "confidence": 0.95, "type": "text"}},
        additional_fields={"plot_number": {"value": "A-1", "confidence": 0.80, "type": "text"}},
        raw_text="Sample text",
        page_count=3,
        usage={"input_tokens": 1000, "output_tokens": 200},
    )
    assert result.anchor_fields["property_address"]["value"] == "123 Main St"
    assert result.page_count == 3
    assert result.usage["input_tokens"] == 1000


def test_extraction_result_to_content_json():
    result = ExtractionResult(
        anchor_fields={"property_address": {"value": "123 Main St", "confidence": 0.95, "type": "text"}},
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
