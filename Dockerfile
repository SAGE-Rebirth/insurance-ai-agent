# ── Stage 1: Build React App ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Pass build-time env var for Gemini API key
ARG VITE_API_KEY
ENV VITE_API_KEY=$VITE_API_KEY

RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built React app
COPY --from=builder /app/dist /usr/share/nginx/html

# Healthcheck for Docker / ECS
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health/ping || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
