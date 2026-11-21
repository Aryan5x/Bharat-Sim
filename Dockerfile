# Single-origin deployment: the FastAPI API also serves the built dashboard.
# Android emulators never run here; APK execution happens on a separate worker.
FROM node:22-alpine AS dashboard
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Publishable (browser-safe) values only. Secret keys are runtime env on the API.
ENV VITE_SUPABASE_URL=https://gpkyzastnibffyuxhtix.supabase.co \
    VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_hgwNVlzldW1gRkb1kSu6Ug_0SyUIK84
RUN npx tsc -b && npx vite build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 BHARATSIM_DATA_DIR=/tmp/bharatsim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
COPY --from=dashboard /build/frontend/dist frontend/dist
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /tmp/bharatsim \
    && chown -R appuser:appuser /app /tmp/bharatsim
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8000')+'/health/live', timeout=3).read()" || exit 1
WORKDIR /app/backend
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips '*'"]
