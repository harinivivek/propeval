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

    @property
    def name(self) -> str:
        return "openrouter" if hasattr(self._client, "chat") else "claude"

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
        print(f"Extracting from {page_count} pages using model {self._model}...")

        # Detect if we are using OpenAI (OpenRouter) or Anthropic SDK
        is_openai = hasattr(self._client, "chat")

        content = []
        if is_openai:
            content.append({"type": "text", "text": EXTRACTION_PROMPT})
            for img_bytes in images:
                b64 = base64.b64encode(img_bytes).decode("utf-8")
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"}
                })
        else:
            for i, img_bytes in enumerate(images):
                b64 = base64.b64encode(img_bytes).decode("utf-8")
                content.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": "image/png", "data": b64},
                })
                if i == 0:
                    content.append({"type": "text", "text": EXTRACTION_PROMPT})

        if is_openai:
            response = await self._client.chat.completions.create(
                model=self._model,
                max_tokens=4096,
                messages=[{"role": "user", "content": content}],
            )
            raw_text = response.choices[0].message.content
            print("Raw OCR Output:", raw_text)
            usage = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            }
            if raw_text is None:
                raise ValueError("OpenRouter API returned no content for extraction.")

        else:
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=4096,
                messages=[{"role": "user", "content": content}],
            )
            raw_text = response.content[0].text
            usage = {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }

        parsed = json.loads(raw_text)

        return ExtractionResult(
            anchor_fields=parsed.get("anchor_fields", {}),
            additional_fields=parsed.get("additional_fields", {}),
            raw_text=raw_text,
            page_count=page_count,
            usage=usage,
        )
