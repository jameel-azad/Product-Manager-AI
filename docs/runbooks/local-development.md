# Local Development Guide

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | 4.x+ | https://docker.com |
| Python | 3.11+ | https://python.org |
| Node.js | 20+ | https://nodejs.org |
| kubectl | latest | https://kubernetes.io/docs/tasks/tools/ |
| Helm | 3.x | https://helm.sh |
| k9s (optional) | latest | https://k9scli.io |

---

## 1. First-time Setup

```bash
# Clone the repo
git clone https://github.com/xccelera/platform.git
cd platform

# Copy and configure environment variables
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY or OPENAI_API_KEY

# Start infrastructure (Postgres, MongoDB, Redis, Kafka, MinIO, InfluxDB, Vault)
docker compose -f docker-compose.infra.yml up -d

# Wait for health checks (~60 seconds)
docker compose -f docker-compose.infra.yml ps
```

---

## 2. Database Setup

```bash
# Apply Postgres migrations
docker exec -i xccelera-postgres psql -U xccelera -d xccelera < data/postgres/migrations/001_initial_schema.sql

# Create Kafka topics
docker exec xccelera-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic ai.jobs.created --partitions 12 --replication-factor 1
# (repeat for all topics in data/kafka/topics.yaml — or use the setup script)

bash scripts/setup-local.sh
```

---

## 3. Running Services

### Option A — All services via Docker Compose

```bash
docker compose up -d
```

### Option B — Individual service (hot reload for development)

```bash
cd services/project-service
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8002
```

### Option C — Frontend only

```bash
cd frontend/web-app
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## 4. Service URLs

| Service | URL | Docs |
|---|---|---|
| Auth Service | http://localhost:8001 | http://localhost:8001/docs |
| Project Service | http://localhost:8002 | http://localhost:8002/docs |
| Requirement Service | http://localhost:8003 | http://localhost:8003/docs |
| Design Service | http://localhost:8004 | http://localhost:8004/docs |
| AI Orchestration | http://localhost:8005 | http://localhost:8005/docs |
| Test Management | http://localhost:8006 | http://localhost:8006/docs |
| DevOps Service | http://localhost:8007 | http://localhost:8007/docs |
| MEE Service | http://localhost:8008 | http://localhost:8008/docs |
| Analytics | http://localhost:8009 | http://localhost:8009/docs |
| Notification | http://localhost:8010 | http://localhost:8010/docs |
| Agent Developer | http://localhost:8011 | http://localhost:8011/docs |
| Legacy Conversion | http://localhost:8012 | http://localhost:8012/docs |
| Business Extraction | http://localhost:8013 | http://localhost:8013/docs |
| Frontend | http://localhost:3000 | — |
| Kafka UI | http://localhost:9093 | — |
| MinIO Console | http://localhost:9001 | — |
| Vault UI | http://localhost:8200 | Token: `root` |
| LLM Proxy | http://localhost:4000 | — |

---

## 5. Running Tests

```bash
# Unit tests for a single service
cd services/auth-service
pytest tests/ -v

# All services
for svc in services/*/; do
  cd $svc && pytest tests/ --tb=short && cd ../..
done

# Integration tests
cd tests/integration
pytest . -v

# Load tests (k6)
k6 run tests/load/k6/api-smoke.js
```

---

## 6. Kafka Topic Management

```bash
# List topics
docker exec xccelera-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

# Consume a topic (debug)
docker exec xccelera-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic ai.jobs.created \
  --from-beginning

# Monitor via Kafka UI
open http://localhost:9093
```

---

## 7. Common Issues

**PostgreSQL connection refused**  
Run `docker compose -f docker-compose.infra.yml up -d postgres` and wait for the health check.

**Kafka consumer group lag**  
Check the Kafka UI at http://localhost:9093 → Consumer Groups.

**JWT token expired in Swagger UI**  
Re-login via `POST /api/v1/auth/login` and update the Bearer token in Swagger's Authorize dialog.

**MinIO bucket missing**  
Run `bash scripts/setup-local.sh` which creates required buckets (`xccelera-artifacts`, `xccelera-mee-evidence`).
