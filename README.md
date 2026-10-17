<p align="center">
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma_ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
</p>

# WhatsApp Alert & Broadcast Platform

> A robust, role-aware internal notification system designed to orchestrate, approve, queue, and deliver WhatsApp broadcast campaigns at scale. Features strict Role-Based Access Control (RBAC), atomic transactional message claiming locks, background daemon workers with exponential backoff retries, and Winston structured log streams.

🔗 **Live Demo:** [whatsapp-integration-iota.vercel.app](https://whatsapp-integration-iota.vercel.app)  
📦 **Repository:** [github.com/harshith-murali/whatsapp-integration](https://github.com/harshith-murali/whatsapp-integration)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Vanilla CSS (TailAdmin-inspired design system with dark/light themes) |
| **Backend API** | Node.js, Express.js, TypeScript |
| **Database** | MySQL 8.0+ / MariaDB |
| **ORM** | Prisma ORM (v7 with dynamic runtime adapter resolution) |
| **Authentication** | JWT stored in secure `HttpOnly` cookies |
| **Worker Engine** | Node.js background process utilizing MySQL atomic transactional claim locks |
| **Logging** | Winston (structured JSON worker/app logs) + Morgan (HTTP request correlation) |

---

## 🔒 Role Philosophy & Permissions (RBAC)

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
| **View Dashboard** | Full Overview | Campaign & Delivery | Workspace & Drafts | Subscriber Counts Only |
| **PII Protection (Phone Masking)** | Unmasked | Unmasked | Unmasked | Masked (`••••••1234`) |
| **Sidebar Navigation Access** | All Items | All Items | All except Admins | Dashboard & Subscribers |

---

## ⚡ Background Worker Queue Engine

The messaging engine is handled by a decoupled worker daemon (`message.worker.ts`):

1. **Transactional Claim Lock**: To prevent race conditions and duplicate deliveries across multiple worker instances, the worker claims eligible `QUEUED` messages atomically inside a transactional block using a unique `claimToken` and `workerId` with a TTL expiration timestamp:
   ```sql
   UPDATE Message 
   SET claimToken = :uuid, workerId = :workerId, claimExpiresAt = :ttl
   WHERE status = 'QUEUED' AND (claimExpiresAt IS NULL OR claimExpiresAt < NOW())
   LIMIT :batchSize;
   ```
2. **Backoff Retry Policy**:
   - **Attempt 1**: Retries after 30 seconds (`RETRY_DELAY_ATTEMPT_1_MS`)
   - **Attempt 2**: Retries after 2 minutes (`RETRY_DELAY_ATTEMPT_2_MS`)
   - **Attempt 3**: Retries after 10 minutes (`RETRY_DELAY_ATTEMPT_3_MS`)
   - **Attempt 4**: Transitions to permanently `FAILED` with code `RETRIES_EXHAUSTED`
3. **Stale Claim Recovery**: Expired worker claims (e.g. from crashed containers) are scanned and returned to `QUEUED` state.
4. **Graceful Shutdown**: Traps `SIGINT`/`SIGTERM` interrupts to halt polling, complete in-flight batches, log terminal heartbeats, and disconnect cleanly.
5. **Worker Monitor Heartbeats**: Registered workers report periodic runtime stats (success count, failure count, host PID) to the `WorkerHeartbeat` table, queried by admins at `/api/workers`.

---

## 🧪 Deterministic Mock Provider Testing

The mock messaging provider deterministically matches phone numbers ending in specific suffixes to test delivery lifecycles:

- **Phone ending in `0001`**: Simulates instant **SUCCESS** (transitions to `SUBMITTED` with a generated provider message ID).
- **Phone ending in `0002`**: Simulates **RETRYABLE FAILURE** (throws `MOCK_RATE_LIMIT`, triggers backoff queue).
- **Phone ending in `0003`**: Simulates **PERMANENT FAILURE** (throws `MOCK_INVALID_NUMBER`, transitions directly to `FAILED`).

---

## ⚙️ Environment Configuration

Configure `.env` in the `backend/` directory:

```ini
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL="mysql://root:password@localhost:3306/whatsapp_alerts"
JWT_SECRET="your_secure_jwt_signing_secret"

# Background Worker & Provider Settings
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
Ensure MySQL is running, then run Prisma migrations and seed default data:
```bash
cd backend
npm install
npx prisma migrate dev
npm run seed
```

### 2. Run Backend API Server
```bash
cd backend
npm run dev
# API running at http://localhost:3000
```

### 3. Run Background Queue Worker
In a separate terminal:
```bash
cd backend
npm run worker:dev
```

### 4. Run Frontend Application
```bash
cd frontend
npm install
npm run dev
# Frontend running at http://localhost:5173
```

---

## 📋 Seeded Test Accounts

| Role | Email | Password |
|---|---|---|
| **Super Admin** | `superadmin@alerts.com` | `SuperAdmin@123` |
| **Admin** | `admin@alerts.com` | `Admin@123` |
| **Operator** | `operator@alerts.com` | `Operator@123` |
| **Viewer** | `viewer@alerts.com` | `Viewer@123` |

---

## 📄 License
MIT License. Built for WhatsApp Alert & Broadcast Platform.
