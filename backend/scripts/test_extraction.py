"""Test the updated OCR extraction prompt against a sample report.

Usage (run from repo root, uses your local ANTHROPIC_API_KEY):
  cd backend && python -m scripts.test_extraction [index]

Or with explicit path:
  PYTHONPATH=backend python backend/scripts/test_extraction.py [index]
"""

import asyncio
import json
import sys
from pathlib import Path

import anthropic

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.ocr.claude_provider import ClaudeOcrProvider


async def main():
    sample_dir = Path(__file__).resolve().parent.parent.parent / "sample-reports"
    if not sample_dir.exists():
        print(f"ERROR: {sample_dir} not found.")
        sys.exit(1)

    pdfs = sorted(sample_dir.glob("*.pdf"))
    if not pdfs:
        print("No PDF files found in sample-reports/")
        sys.exit(1)

    print(f"Found {len(pdfs)} sample reports:")
    for i, p in enumerate(pdfs):
        print(f"  [{i}] {p.name}")

    idx = 0
    if len(sys.argv) > 1:
        idx = int(sys.argv[1])
    pdf_path = pdfs[idx]
    print(f"\nProcessing: {pdf_path.name}")
    print("-" * 60)

    client = anthropic.AsyncAnthropic()
    provider = ClaudeOcrProvider(client)

    result = await provider.extract(str(pdf_path))
    content_json = result.to_content_json("claude", provider._model)

    print(f"\nPages processed: {result.page_count}")
    print(f"Tokens: input={result.usage.get('input_tokens', 0)}, output={result.usage.get('output_tokens', 0)}")
    print(f"\n--- ANCHOR FIELDS ({len(result.anchor_fields)}) ---")
    for key, field in result.anchor_fields.items():
        conf = field.get("confidence", 0)
        val = field.get("value", "")
        print(f"  {key}: {val}  (confidence: {conf:.0%})")

    print(f"\n--- SECTIONS ({len(result.sections)}) ---")
    for section_key, section_fields in result.sections.items():
        print(f"\n  [{section_key}] ({len(section_fields)} fields)")
        for key, field in section_fields.items():
            conf = field.get("confidence", 0)
            val = str(field.get("value", ""))[:80]
            print(f"    {key}: {val}  ({conf:.0%})")

    if result.additional_fields:
        print(f"\n--- ADDITIONAL FIELDS ({len(result.additional_fields)}) ---")
        for key, field in result.additional_fields.items():
            conf = field.get("confidence", 0)
            val = str(field.get("value", ""))[:80]
            print(f"  {key}: {val}  ({conf:.0%})")

    out_path = Path(f"extraction_result_{idx}.json")
    with open(out_path, "w") as f:
        json.dump(content_json, f, indent=2, default=str)
    print(f"\nFull result saved to: {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
