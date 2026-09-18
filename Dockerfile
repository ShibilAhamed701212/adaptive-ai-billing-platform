# Stage 1: Build dependencies & TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY shared/ ./shared/
COPY backend/ ./backend/

# Compile shared library and backend TypeScript
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Copy manifests for production install
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled files from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist

EXPOSE 8000

WORKDIR /app/backend

CMD ["node", "dist/server.js"]
