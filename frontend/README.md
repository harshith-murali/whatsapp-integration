# WhatsApp Broadcast Platform — Frontend Dashboard

> Modern, responsive administrative dashboard for orchestrating and monitoring WhatsApp alert broadcasts, built with React 18, TypeScript, Vite, and custom Vanilla CSS.

🔗 **Live Demo:** [whatsapp-integration-iota.vercel.app](https://whatsapp-integration-iota.vercel.app)  
📦 **Parent Repository:** [github.com/harshith-murali/whatsapp-integration](https://github.com/harshith-murali/whatsapp-integration)

---

## 🛠️ Tech Stack & Architecture

- **Framework**: React 18 (SPA)
- **Tooling**: Vite (fast HMR and optimized production bundling)
- **Language**: TypeScript (strict types)
- **Styling**: TailAdmin-inspired design system with CSS custom properties (`index.css`), full light/dark mode support, responsive layouts, and zero heavy UI runtime overhead.
- **Routing**: React Router (DOM) with protected role-gated routes.
- **API Client**: Centralized fetch client handling JWT credential exchange and error propagation.

---

## 🖥️ Views & Capabilities

1. **Dashboard Overview**: Aggregated broadcast volume, delivery success rates, queue latency, and real-time activity stream.
2. **Campaign Manager**: Multi-step wizard for creating broadcast drafts, selecting recipient groups, and previewing WhatsApp template formatting.
3. **Queue & Message Monitor**: Filterable table showing message status (`QUEUED`, `CLAIMED`, `SUBMITTED`, `FAILED`), retry counters, and failure codes with one-click requeue for admins.
4. **Subscriber Roster**: Contact management with automatic PII masking (e.g. `••••••1234`) when viewed by read-only viewers.
5. **Worker Heartbeats**: Real-time worker monitoring dashboard displaying host IDs, active worker counts, processed batches, and liveness status.
6. **Audit Logs**: Immutable activity log recording all user logins, campaign approvals, and configuration changes.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Create `.env` in `frontend/`:
```env
VITE_API_URL=http://localhost:3000/api
```

### 3. Run Development Server
```bash
npm run dev
# Running at http://localhost:5173
```

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 📄 License
MIT License. Part of WhatsApp Alert & Broadcast Platform.
