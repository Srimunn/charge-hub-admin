# Base node image
FROM node:18-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Declare build arguments and environment variables for Next.js build time
# NEXT_PUBLIC_* vars are baked into the JS bundle at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# NEXTAUTH_URL is needed at build time so NextAuth can generate correct URLs
ARG NEXTAUTH_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# NEXTAUTH_SECRET is needed for JWT signing during build-time prerendering
ARG NEXTAUTH_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# BACKEND_API_URL is used server-side in next.config.mjs rewrites (not public)
ARG BACKEND_API_URL
ENV BACKEND_API_URL=$BACKEND_API_URL

# Disable telemetry during the build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown node:node .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

ENV PORT=3000
# trustHost is set in route.ts; HOSTNAME allows binding on all interfaces
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
