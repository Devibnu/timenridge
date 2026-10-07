# TimeBridge

Enterprise Attendance Integration Middleware for SAP.

## Architecture Baseline

- **Backend**: Node.js + TypeScript
- **Database**: PostgreSQL 16+
- **Queue**: Redis + BullMQ
- **Frontend**: Vue 3 + Vite
- **Target SAP**: SAP HCM / SAP S/4HANA

## Getting Started

### Prerequisites

- Node.js (v20+)
- npm
- Docker and Docker Compose

### Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Start infrastructure (PostgreSQL & Redis):
   ```bash
   docker-compose up -d
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development server:
   ```bash
   npm run dev:api
   npm run dev:worker
   npm run dev:scheduler
   npm run dev:frontend
   ```

## Workspaces

- `apps/api`: REST API
- `apps/worker`: Queue workers
- `apps/scheduler`: Chronological task schedulers
- `frontend`: Web dashboard
- `packages/*`: Shared modules and engines
