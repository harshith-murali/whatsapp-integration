# Deployment Guide — AWS RDS

This document is the production runbook for deploying the WhatsApp Alert & Broadcast Platform with **AWS RDS (MySQL 8.x)** as the database.

---

## Architecture Overview

```
                 ┌─────────────────────────────────────┐
Internet ──────► │  Load Balancer / Reverse Proxy        │
                 │  (ALB, Nginx, Caddy, or CloudFront)  │
                 └──────────────┬────────────────────────┘
                                │ HTTPS
                 ┌──────────────▼────────────────────────┐
                 │  Compute (EC2 / ECS / PaaS)            │
                 │  ┌──────────┐ ┌──────────┐ ┌────────┐ │
                 │  │  API     │ │ msg-     │ │webhook │ │
                 │  │ :3000    │ │ worker   │ │ worker │ │
                 │  └────┬─────┘ └────┬─────┘ └───┬────┘ │
                 └───────┼────────────┼────────────┼──────┘
                         │            │            │
                 ┌────────▼────────────▼────────────▼──────┐
                 │         AWS RDS MySQL 8.x (SSL)          │
                 └──────────────────────────────────────────┘
```

Three long-running processes connect to the same RDS instance:

| Process | npm script | Purpose |
| :--- | :--- | :--- |
| **API Server** | `start:api` | Handles all HTTP requests |
| **Message Worker** | `start:worker` | Processes the outbound message queue |
| **Webhook Worker** | `start:webhook-worker` | Processes inbound Meta webhook events |

---

## Pre-Flight Checklist

### AWS RDS

- [ ] RDS instance is **MySQL 8.x** (not Aurora unless you've confirmed MariaDB adapter compatibility).
- [ ] RDS is in a **private subnet** — only reachable from the compute security group, not public internet.
- [ ] Compute security group has **outbound TCP 3306** to the RDS security group.
- [ ] **Automated backups** enabled with at least 7-day retention.
- [ ] **Multi-AZ** enabled for production (failover).
- [ ] **SSL enforcement** is on: set `require_secure_transport = ON` in the RDS parameter group.
- [ ] You have noted the RDS endpoint hostname (e.g. `your-cluster.rds.amazonaws.com`).

### Secrets

- [ ] Generate a strong JWT secret (minimum 64 characters):
  ```bash
  openssl rand -hex 64
  ```
- [ ] All secrets are stored in **AWS Secrets Manager** or **SSM Parameter Store** — never committed to source control.
- [ ] `.env` is listed in `.gitignore` (it already is).

### Environment Variables

Set the following on your compute host before starting:

```ini
NODE_ENV=production
PORT=3000

DATABASE_URL=mysql://appuser:StrongPassword@your-cluster.rds.amazonaws.com:3306/whatsapp_alerts
DATABASE_SSL=true
DATABASE_CONNECTION_LIMIT=20
DATABASE_CONNECT_TIMEOUT_MS=15000

JWT_SECRET=<64+ char secret from openssl rand -hex 64>
SESSION_DURATION_HOURS=8
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
COOKIE_DOMAIN=.yourdomain.com

CORS_ALLOWED_ORIGINS=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
TRUST_PROXY=true

MESSAGE_PROVIDER=mock   # change to meta when WhatsApp credentials are ready

LOG_LEVEL=info
LOG_DIRECTORY=/var/log/whatsapp-alerts
```

> [!WARNING]
> The app will **refuse to start** if any of the following are invalid:
> - `DATABASE_URL` missing or not `mysql://...`
> - `JWT_SECRET` under 64 chars in production
> - `CORS_ALLOWED_ORIGINS` is `*` or empty
> - `NODE_ENV` is not `development`, `test`, or `production`

---

## Build Step

Run once per deployment (CI/CD or manually):

```bash
cd backend
npm ci --omit=dev
npx prisma generate
npm run build
```

```bash
cd frontend
npm ci
npm run build
# dist/ contains the static files to serve via CDN or Nginx
```

---

## Database Migration

Run **before** starting any process. Safe to run repeatedly — only applies pending migrations:

```bash
cd backend
npm run migrate:deploy
```

This runs `prisma migrate deploy` — no interactive prompts, safe for automated pipelines.

> [!CAUTION]
> Never run `prisma migrate dev` or `prisma db push` against the production database. These can cause destructive schema changes.

---

## Starting Processes

### Option A — Single host (EC2 / VPS)

```bash
cd backend
sh scripts/start-production.sh
```

This script runs migrations, then starts all three processes and propagates SIGTERM on shutdown.

Or manually with a process manager (PM2 example):

```bash
pm2 start dist/server.js            --name api
pm2 start dist/workers/message.worker.js   --name message-worker
pm2 start dist/workers/webhook.worker.js   --name webhook-worker
pm2 save
pm2 startup
```

### Option B — Docker (no local MySQL)

For AWS RDS, remove the `mysql` service from `docker-compose.yml` and inject `DATABASE_URL` as an environment variable pointing at your RDS endpoint:

```bash
# Set DATABASE_URL in your shell or secrets manager, then:
docker compose up --build api message-worker webhook-worker frontend
```

### Option C — ECS / Fargate

Create three separate task definitions:

| Task | Command |
| :--- | :--- |
| `api` | `node --experimental-specifier-resolution=node dist/server.js` |
| `message-worker` | `node --experimental-specifier-resolution=node dist/workers/message.worker.js` |
| `webhook-worker` | `node --experimental-specifier-resolution=node dist/workers/webhook.worker.js` |

Run the migration as a **one-off ECS task** before updating services:
```
command: node node_modules/.bin/prisma migrate deploy
```

---

## Health Verification

After startup, confirm all processes are healthy:

```bash
# Liveness
curl https://yourdomain.com/api/health/live
# → {"status":"ok"}

# Readiness (checks DB connection)
curl https://yourdomain.com/api/health/ready
# → {"status":"ok","database":"connected"}

# Admin details (requires authentication)
curl -b cookies.txt https://yourdomain.com/api/health/details
```

Worker heartbeats (requires Admin auth):
```bash
curl -b cookies.txt https://yourdomain.com/api/workers
```

---

## Rollback Procedure

1. **Code rollback**: redeploy the previous Docker image tag or git commit.
2. **Migration rollback**: Prisma does not auto-generate down migrations. For destructive changes, restore from RDS snapshot taken before the deployment.
3. **RDS snapshot**: take a manual snapshot before every deployment that includes schema changes:
   ```
   AWS Console → RDS → your instance → Actions → Take snapshot
   ```

---

## Log Locations

| Process | Log path |
| :--- | :--- |
| API access log | `$LOG_DIRECTORY/access.log` |
| Application log | `$LOG_DIRECTORY/app.log` |
| Worker log | `$LOG_DIRECTORY/worker.log` |
| Error log | `$LOG_DIRECTORY/error.log` |

Forward logs to **CloudWatch Logs** via the CloudWatch agent or ECS `awslogs` log driver.

---

## MySQL Backups (RDS)

AWS RDS automated backups handle this. Recommended settings:

- **Backup retention**: 14 days minimum.
- **Backup window**: off-peak hours in your region.
- **Multi-AZ**: yes (synchronous standby).
- **Snapshot before deployments**: manual snapshot before any schema migration.

To test restore, spin up a separate RDS instance from a snapshot and verify data integrity — never restore into production without an approved maintenance window.

---

## Security Hardening Notes

- [ ] Keep `META_WHATSAPP_ACCESS_TOKEN`, `META_APP_SECRET`, and `JWT_SECRET` in AWS Secrets Manager — rotate periodically.
- [ ] Expose only port 443 (HTTPS) publicly. Port 3000 should only be reachable via the load balancer or internally.
- [ ] Protect `GET /metrics` at the ALB or security group layer — it should not be publicly accessible.
- [ ] Enable AWS WAF on the ALB for bot and rate-limit protection at the network edge.
- [ ] Enable RDS encryption at rest (KMS) and enforce SSL (`require_secure_transport = ON`).
