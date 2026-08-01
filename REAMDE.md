# WhatsApp Alert & Broadcast Platform

A robust, role-aware internal notification system designed to orchestrate, approve, queue, and deliver WhatsApp broadcast campaigns. Built with a secure role-based access control (RBAC) model, transactional message claiming locks, background worker processes, and Winston structured log streams.

---

## 🚀 Tech Stack

- **Frontend**: React + TypeScript + Vite + Vanilla CSS (TailAdmin-inspired design system with dark mode)
- **Backend**: Node.js + Express + TypeScript
- **Database**: MySQL (MariaDB compatible)
- **ORM**: Prisma ORM (Version 7 with dynamic runtime adapter resolution)
- **Authentication**: JWT stored in secure `HttpOnly` cookies
- **Worker Engine**: Node.js background process utilizing MySQL atomic transactional claim locks
- **Logging**: Winston (structured worker and app logs) + Morgan (HTTP request logging with request correlation IDs)

---

## 🔒 Role Philosophy & Permissions

The platform enforces strict role-based visibility and least-privilege principles:

| Capability | SUPER_ADMIN | ADMIN | OPERATOR | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| **Manage Administrators** | ✓ | ✗ | ✗ | ✗ |
| **Manage System Settings** | ✓ | ✗ | ✗ | ✗ |
| **View Audit Logs** | ✓ | ✓ | ✗ | ✗ |
| **Requeue Failed Messages** | ✓ | ✓ | ✗ | ✗ |
| **Approve / Reject Broadcasts** | ✓ | ✓ | ✗ | ✗ |
| **Queue / Cancel Campaigns** | ✓ | ✓ | ✗ | ✗ |
| **Create Recipient Groups** | ✓ | ✓ | ✗ | ✗ |
| **Manage Group Members** | ✓ | ✓ | ✓ | ✗ |
| **Create Broadcast Drafts** | ✓ | ✓ | ✓ | ✗ |
| **View Subscribers & Details** | ✓ | ✓ | ✓ | ✓ |
| **View Dashboard** | Full | Campaign & Delivery | Workspace & Drafts | Subscriber Counts Only |
| **PII Protection (Phone Masking)** | Unmasked | Unmasked | Unmasked | Masked (`••••••1234`) |
| **Sidebar Navigation Access** | All Items | All Items | All except Admins | Dashboard & Subscribers |

---

## ⚡ Background Worker Queue Engine

The messaging engine is handled by a separate worker process (`message.worker.ts`) executing as a background daemon:

1. **Transactional Claim Lock**: To prevent duplicate processing by concurrent worker scaling, the worker selects eligible `QUEUED` messages and stamps them atomically inside a transactional block using a unique `claimToken` and `workerId` with a TTL expiration date.
2. **Backoff Retry Policy**:
   - **Attempt 1**: Retries after 30 seconds (`RETRY_DELAY_ATTEMPT_1_MS`).
   - **Attempt 2**: Retries after 2 minutes (`RETRY_DELAY_ATTEMPT_2_MS`).
   - **Attempt 3**: Retries after 10 minutes (`RETRY_DELAY_ATTEMPT_3_MS`).
   - **Attempt 4**: Marks message permanently `FAILED` with code `RETRIES_EXHAUSTED`.
3. **Stale Claim Recovery**: Expired worker claims (e.g. following worker crashes) are periodically scanned and returned to `QUEUED` state.
4. **Graceful Shutdown**: Listens to `SIGINT`/`SIGTERM` interrupts to halt polling, wait for in-flight requests, write stopped heartbeat statuses, and disconnect cleanly.
5. **Worker Monitor Heartbeats**: Registered workers log runtime stats (success count, failure count, host, PID) periodically, which are queried at `GET /api/workers` for Admin panels.

---

## 🧪 Development Mock Testing Mode

The mock messaging provider matches phone numbers ending in specific suffixes to test delivery states deterministically in development/test environments:

- **Phone ending in `0001`**: Simulates instant **SUCCESS** (transitions to `SUBMITTED` with a generated provider ID).
- **Phone ending in `0002`**: Simulates **RETRYABLE FAILURE** (throws `MOCK_RATE_LIMIT`, triggers backoff queue).
- **Phone ending in `0003`**: Simulates **PERMANENT FAILURE** (throws `MOCK_INVALID_NUMBER`, transitions immediately to `FAILED`).

---

## ⚙️ Environment Variables

Configure `.env` in the `backend` folder:

```ini
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL="mysql://root:password@localhost:3306/whatsapp_alerts"
JWT_SECRET="your_jwt_signing_secret_here"

# Background Worker & Mock Provider Settings (Phase 3)
MESSAGE_PROVIDER=mock
WORKER_POLL_INTERVAL_MS=2000
WORKER_BATCH_SIZE=20
WORKER_CONCURRENCY=5
WORKER_CLAIM_TTL_MS=60000
WORKER_MAX_RETRIES=3
WORKER_SHUTDOWN_TIMEOUT_MS=5000

MOCK_PROVIDER_MIN_DELAY_MS=100
MOCK_PROVIDER_MAX_DELAY_MS=500
MOCK_PROVIDER_RETRYABLE_FAILURE_RATE=0.10
MOCK_PROVIDER_PERMANENT_FAILURE_RATE=0.05

RETRY_DELAY_ATTEMPT_1_MS=30000
RETRY_DELAY_ATTEMPT_2_MS=120000
RETRY_DELAY_ATTEMPT_3_MS=600000
```

---

## 🛠️ Startup Instructions

### 1. Database Setup
Ensure your MySQL server is running and run Prisma migrations:
```bash
cd backend
npx prisma migrate dev
npm run seed
```

### 2. Run Backend API Server
Launch the Express server in a terminal window:
```bash
cd backend
npm run dev
```

### 3. Run Background Queue Worker
Launch the background queue processor in a second terminal window:
```bash
cd backend
npm run worker:dev
```

### 4. Run Frontend UI App
Launch the Vite development application:
```bash
cd frontend
npm run dev
```

---

## 📋 Credentials for Testing

Use the following seeded accounts for local login verification:

- **Super Admin**: `superadmin@alerts.com` / `SuperAdmin@123`
- **Admin**: `admin@alerts.com` / `Admin@123`
- **Operator**: `operator@alerts.com` / `Operator@123`
- **Viewer**: `viewer@alerts.com` / `Viewer@123`
