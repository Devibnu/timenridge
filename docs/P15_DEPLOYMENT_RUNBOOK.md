# TimeBridge Deployment Runbook (P15)

## 1. Prerequisites

- Docker & Docker Compose installed on target environment.
- Access to the target database (PostgreSQL 14+).
- Access to the target Redis instance (Redis 7+).
- `.env` file securely deployed to the target environment containing all keys defined in `.env.example`.

## 2. Infrastructure Provisioning

TimeBridge provides a unified multi-stage `Dockerfile` and a `docker-compose.yml` (for local provisioning). In staging or production, use standard container orchestration (e.g., Docker Swarm, Kubernetes, or AWS ECS).

### Image Targets:

- API: `docker build --target api -t timebridge-api:latest .`
- Worker: `docker build --target worker -t timebridge-worker:latest .`
- Frontend: `docker build --target frontend -t timebridge-frontend:latest .`

## 3. Database Migration

**CRITICAL**: Never squash or reset migrations in Production/Staging.

Execute the following command on the CI/CD pipeline or directly in the deployment environment:

```bash
# Set DATABASE_URL in environment first
npx prisma migrate deploy
```

_Note_: `migrate deploy` only applies pending migrations sequentially and strictly validates the history lock.

## 4. Application Deployment Sequence

1. **Queue/Workers**: Deploy the worker nodes first. If there are pending jobs or retries in Redis, workers will naturally start picking them up.
2. **API Nodes**: Deploy the API nodes. They will connect to the Database and Redis.
3. **Frontend**: Deploy the Vue 3 SPA asset bundle (usually behind an Nginx reverse proxy).

## 5. Smoke Testing

Once deployed, perform the following verification:

1. **API Readiness**: `GET https://<api-host>/ready` -> Ensure `success: true` and all dependencies are `healthy`.
2. **Health Check**: `GET https://<api-host>/health` -> Verify service is responding.
3. **Login Flow**: Attempt login via the frontend client to verify database read/write and JWT validation.

## 6. Rollback Procedures

1. If the API or Worker fails to start (e.g., missing environment variable): Revert the deployment image tag to the previous stable release.
2. If a database migration causes data loss or instability:
   - DO NOT `prisma migrate resolve` or downgrade via Prisma.
   - Restore the PostgreSQL instance from the last Backup snapshot (See `BACKUP_RECOVERY.md`).
