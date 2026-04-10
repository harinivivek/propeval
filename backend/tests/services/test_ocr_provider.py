import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.ocr.base import ExtractionResult, OcrProvider
from app.services.ocr.claude_provider import ClaudeOcrProvider


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
