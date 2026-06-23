FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir litellm[proxy]==1.40.0

COPY src/ ./src/

EXPOSE 4000

CMD ["litellm", "--config", "/app/src/litellm_config.yaml", "--port", "4000"]
