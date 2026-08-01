# Deployment Notes

## Production Checklist

- Set `NODE_ENV=production`.
- Use a long random `JWT_SECRET`; do not reuse development values.
- Set `CORS_ALLOWED_ORIGINS` to exact frontend origins.
- Set `COOKIE_SECURE=true` behind HTTPS.
- Keep Meta access token, app secret, and webhook verify token backend-only.
- Run Prisma migrations before starting workers.
- Run API, message worker, and webhook worker as separate processes.
- Protect `/metrics` at the deployment or network layer.

## MySQL Backups

Configure automated MySQL backups outside the application process.

Recommended baseline:

- Daily encrypted backups.
- At least 7 daily and 4 weekly restore points.
- Quarterly restore tests into an isolated environment.
- Store backup credentials in a secret manager.

Example backup command shape:

```bash
mysqldump --single-transaction --routines --triggers whatsapp_alerts > backup.sql
```

Example restore-test command shape:

```bash
mysql restored_whatsapp_alerts < backup.sql
```

Do not run restore commands against production without an approved maintenance plan.

## Docker

Production-like local stack:

```bash
docker compose build
docker compose up
```

Services:

- `mysql`
- `api`
- `message-worker`
- `webhook-worker`
- `frontend`

MySQL is bound to `127.0.0.1` only.

## Health And Metrics

- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`
- Admin details: `GET /api/health/details`
- Metrics: `GET /metrics`
