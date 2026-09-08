# Combined Dockerfile for full-stack deployment
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm install

# Build the apps
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=4000

COPY --from=builder /app ./

EXPOSE 3000 4000

CMD ["npx", "concurrently", "-n", "API,WEB", "-c", "magenta,cyan", "npm run start:prod -w apps/api", "npm run start -w apps/web"]
