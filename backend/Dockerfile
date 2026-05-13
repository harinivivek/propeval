FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    POETRY_VERSION=1.8.5 \
    POETRY_VIRTUALENVS_CREATE=false

# System deps
# Combined System and WeasyPrint dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    tesseract-ocr \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Poetry
RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}"

# Create a non-privileged user with a home directory
RUN groupadd -r appuser && useradd -m -r -g appuser -u 1000 appuser

WORKDIR /app
RUN chown appuser:appuser /app

# Copy dependency files first for better caching
COPY pyproject.toml poetry.lock* ./

# Install dependencies as root (needed because virtualenvs are disabled)
RUN poetry install --no-interaction --no-ansi --no-root

# Copy app code
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
