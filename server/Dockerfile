# ── Backend Dockerfile ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy deps first (layer cache optimization)
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Only install production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 5000

# Use dumb-init to handle signals properly (important for graceful shutdown)
RUN apk add --no-cache dumb-init
USER node

CMD ["dumb-init", "node", "dist/index.js"]
