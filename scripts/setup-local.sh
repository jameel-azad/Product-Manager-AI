#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# setup-local.sh — One-time local environment bootstrap
# Run after: docker compose -f docker-compose.infra.yml up -d
# ──────────────────────────────────────────────────────────────────────────────
set -e

echo "==> Waiting for Postgres..."
until docker exec xccelera-postgres pg_isready -U xccelera -d xccelera; do sleep 2; done

echo "==> Running Postgres migrations..."
docker exec -i xccelera-postgres psql -U xccelera -d xccelera \
  < data/postgres/migrations/001_initial_schema.sql

echo "==> Waiting for Kafka..."
until docker exec xccelera-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list > /dev/null 2>&1; do sleep 3; done

echo "==> Creating Kafka topics..."
TOPICS=(
  "ai.jobs.created:12"
  "ai.jobs.completed:12"
  "ai.jobs.failed:6"
  "apix.jobs:6"
  "uix.jobs:6"
  "integrationx.jobs:4"
  "mobile.jobs:4"
  "agent.jobs:4"
  "legacy.jobs:4"
  "bex.jobs:4"
  "requirements.changed:6"
  "requirements.approved:4"
  "mee.events:24"
  "deployments.started:4"
  "deployments.completed:4"
  "notifications.send:6"
  "platform.events:8"
)

for entry in "${TOPICS[@]}"; do
  TOPIC=$(echo $entry | cut -d: -f1)
  PARTITIONS=$(echo $entry | cut -d: -f2)
  docker exec xccelera-kafka kafka-topics.sh \
    --bootstrap-server localhost:9092 \
    --create --if-not-exists \
    --topic "$TOPIC" \
    --partitions "$PARTITIONS" \
    --replication-factor 1
  echo "  Created topic: $TOPIC (partitions: $PARTITIONS)"
done

echo "==> Creating MinIO buckets..."
# Wait for MinIO
until curl -sf http://localhost:9000/minio/health/live; do sleep 2; done

# Use mc (MinIO client) if available, otherwise use the API
if command -v mc &> /dev/null; then
  mc alias set local http://localhost:9000 minioadmin minioadmin
  mc mb --ignore-existing local/xccelera-artifacts
  mc mb --ignore-existing local/xccelera-mee-evidence
  # MEE evidence bucket: set immutable object lock (compliance)
  mc retention set --default COMPLIANCE 7y local/xccelera-mee-evidence || true
else
  echo "  mc not found — create buckets manually via http://localhost:9001 (minioadmin/minioadmin)"
fi

echo "==> Initializing Vault (dev mode — token: root)..."
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=root

if command -v vault &> /dev/null; then
  vault kv put secret/xccelera/postgres \
    url="postgresql://xccelera:changeme@postgres:5432/xccelera"
  vault kv put secret/xccelera/redis \
    url="redis://redis:6379/0"
  vault kv put secret/xccelera/jwt \
    secret_key="local-dev-secret-change-in-prod"
  echo "  Vault secrets written."
else
  echo "  vault CLI not found — configure Vault manually at http://localhost:8200 (token: root)"
fi

echo ""
echo "✅ Local environment ready!"
echo ""
echo "  Services: docker compose up -d"
echo "  Frontend: cd frontend/web-app && npm run dev"
echo "  Kafka UI: http://localhost:9093"
echo "  MinIO:    http://localhost:9001 (minioadmin / minioadmin)"
echo "  Vault:    http://localhost:8200 (token: root)"
