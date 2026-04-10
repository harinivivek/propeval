import logging
import os
import shutil

import pikepdf

from app.core.constants import MEDIA_ROOT

logger = logging.getLogger(__name__)


def optimize_pdf(relative_path: str) -> str:
    """Losslessly optimize a PDF file. Preserves original with _original suffix.

    Returns the relative path to the optimized file (same as input — original is renamed).
    """
    full_path = os.path.join(MEDIA_ROOT, relative_path)
    if not os.path.exists(full_path):
        logger.warning("PDF not found for optimization: %s", full_path)
        return relative_path

    base, ext = os.path.splitext(full_path)
    original_path = f"{base}_original{ext}"
    shutil.copy2(full_path, original_path)

    try:
        with pikepdf.open(original_path) as pdf:
            pdf.save(
                full_path,
                linearize=True,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
            )
        original_size = os.path.getsize(original_path)
        optimized_size = os.path.getsize(full_path)
        logger.info(
            "PDF optimized: %s (%.1fKB -> %.1fKB, %.0f%% reduction)",
            relative_path,
            original_size / 1024,
            optimized_size / 1024,
            (1 - optimized_size / original_size) * 100 if original_size > 0 else 0,
        )
    except Exception:
        logger.exception("PDF optimization failed for %s, keeping original", relative_path)
        shutil.copy2(original_path, full_path)

    return relative_path
