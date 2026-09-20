# Stage 1: Build dependencies, shared types, backend, and frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies (including devDependencies for TypeScript & Vite)
RUN npm ci

# Copy source files
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Compile shared library, backend TypeScript, and frontend Vite bundle
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend
RUN npm run build --workspace=frontend

# Stage 2: Lean production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copy manifests for production install
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 10000

WORKDIR /app/backend

CMD ["node", "dist/server.js"]
