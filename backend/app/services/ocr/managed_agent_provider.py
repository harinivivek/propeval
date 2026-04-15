"""OCR provider using Claude Agent SDK with OAuth credentials.

Uses `claude-agent-sdk` query() which runs the Claude CLI under the hood,
authenticating via ~/.claude/.credentials.json (from `claude login`).
No direct API key needed.
"""
import json
import logging
import os
import shutil
import socket
from pathlib import Path

from app.services.ocr.base import ExtractionResult, OcrProvider
from app.services.ocr.claude_provider import EXTRACTION_PROMPT

logger = logging.getLogger(__name__)

_CONFIG_DIR_PREFIX = "/tmp/claude-ocr-config"

AGENT_SYSTEM_PROMPT = f"""You are a property valuation report data extraction agent.
You will be given a PDF file path. Read the file and extract structured data
according to the schema below.

{EXTRACTION_PROMPT}"""


def _ensure_clean_config_dir(task_id: str | None = None) -> str:
    """Create a clean CLI config dir with only OAuth credentials.

    Copies ~/.claude/.credentials.json into an isolated temp dir so the
    CLI authenticates via OAuth (Claude Max subscription) without picking
    up hooks/plugins from the host ~/.claude/ directory.
    """
    hostname = socket.gethostname()
    suffix = task_id or str(os.getpid())
    config_dir = Path(f"{_CONFIG_DIR_PREFIX}-{hostname}-{suffix}")
    config_dir.mkdir(parents=True, exist_ok=True)

    for stale in ("projects", "shell-snapshots", "plans", "session-env"):
        p = config_dir / stale
        if p.exists():
            shutil.rmtree(p, ignore_errors=True)

    home_claude = Path.home() / ".claude"
    creds_src = home_claude / ".credentials.json"
    creds_dst = config_dir / ".credentials.json"
    if creds_src.exists() and (
        not creds_dst.exists()
        or creds_src.stat().st_mtime > creds_dst.stat().st_mtime
    ):
        shutil.copy2(creds_src, creds_dst)

    return str(config_dir)


def _extract_json_from_text(text: str) -> str:
    """Strip markdown fences and leading text to find raw JSON."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        start = 1
        end = len(lines)
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip() == "```":
                end = i
                break
        stripped = "\n".join(lines[start:end]).strip()

    brace_start = stripped.find("{")
    if brace_start > 0:
        stripped = stripped[brace_start:]

    return stripped


class ManagedAgentOcrProvider(OcrProvider):
    """OCR provider using Claude Agent SDK (OAuth-based, no API key needed)."""

    def __init__(self, model: str = "sonnet", task_id: str | None = None):
        self._model = model
        self._task_id = task_id

    async def extract(self, pdf_path: str) -> ExtractionResult:
        from claude_agent_sdk import (
            AssistantMessage,
            ClaudeAgentOptions,
            ResultMessage,
            TextBlock,
            query,
        )

        config_dir = _ensure_clean_config_dir(self._task_id)

        options = ClaudeAgentOptions(
            system_prompt=AGENT_SYSTEM_PROMPT,
            model=self._model,
            max_turns=3,
            permission_mode="bypassPermissions",
            env={
                "ANTHROPIC_API_KEY": "",
                "CLAUDE_CONFIG_DIR": config_dir,
            },
            plugins=[],
        )

        user_prompt = (
            f"Read the property valuation report PDF at {pdf_path} and extract "
            "all structured data. Return ONLY valid JSON matching the schema "
            "in your instructions — no markdown fences, no explanation, just "
            "the raw JSON object."
        )

        collected_text: list[str] = []
        result_message: ResultMessage | None = None

        async for message in query(prompt=user_prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock) and block.text:
                        collected_text.append(block.text)
            elif isinstance(message, ResultMessage):
                result_message = message

        raw_text = "".join(collected_text)
        if not raw_text.strip():
            if result_message and result_message.result:
                raw_text = result_message.result
            else:
                raise ValueError("Agent returned no text output")

        json_text = _extract_json_from_text(raw_text)
        parsed = json.loads(json_text)

        usage = {}
        if result_message and result_message.usage:
            usage = {
                "input_tokens": result_message.usage.get("input_tokens", 0),
                "output_tokens": result_message.usage.get("output_tokens", 0),
            }

        return ExtractionResult(
            anchor_fields=parsed.get("anchor_fields", {}),
            additional_fields=parsed.get("additional_fields", {}),
            sections=parsed.get("sections", {}),
            raw_text=raw_text,
            page_count=0,
            usage=usage,
        )
