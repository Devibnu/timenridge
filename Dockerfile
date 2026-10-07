# Multi-stage Dockerfile for TimeBridge Monorepo

# Base Node Image
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/security/package.json ./packages/security/
COPY packages/device-adapters/package.json ./packages/device-adapters/
COPY packages/attendance-engine/package.json ./packages/attendance-engine/
COPY packages/queue/package.json ./packages/queue/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/scheduler/package.json ./apps/scheduler/
COPY frontend/package.json ./frontend/

# Dependencies
FROM base AS deps
RUN npm ci

# Builder
FROM deps AS builder
COPY . .
# Build the TypeScript packages and applications
RUN npm run build:all

# Prune dev dependencies for production
RUN npm ci --omit=dev && npm cache clean --force

# API Production Image
FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
EXPOSE 3000
CMD ["node", "apps/api/dist/index.cjs"]

# Worker Production Image
FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker ./apps/worker
CMD ["node", "apps/worker/dist/index.cjs"]

# Frontend Production Image (Serve static files with nginx)
FROM nginx:alpine AS frontend
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
