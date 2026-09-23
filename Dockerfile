# Stage 1: Build dependencies, shared types, backend, and frontend
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies for building
RUN npm install

# Copy source code
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build shared library, backend, and frontend bundle
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend
RUN npm run build --workspace=frontend

# Stage 2: Production runtime image
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copy manifests for production installation
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/

# Install production dependencies
RUN npm install --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 10000

WORKDIR /app/backend

CMD ["node", "dist/server.js"]
