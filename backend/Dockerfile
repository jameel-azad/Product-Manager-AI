# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install only the pre-built packages from stage 1
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

EXPOSE 8000

# Use uvicorn with sensible production defaults
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
