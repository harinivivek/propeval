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
