#
# T9.3 — a Dockerfile rather than Nixpacks autodetection, so the image that runs
# in production is the image that was tested, byte for byte.
#
# Multi-stage: dependencies, build, then a runtime image that carries only
# Next's standalone output plus the Prisma CLI needed by the pre-deploy
# migration step.

# ---- dependencies ----------------------------------------------------------
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
# --frozen-lockfile: a deploy must never silently resolve a different version
# than the one that was reviewed.
RUN pnpm install --frozen-lockfile

# ---- build -----------------------------------------------------------------
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The build has no database and no secrets; src/env.ts skips validation for it
# rather than failing a build over a value that is only needed at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
RUN pnpm exec prisma generate
RUN pnpm build

# ---- runtime ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway assigns the port; binding to 0.0.0.0 is what makes the container
# reachable. Hardcoding 3000 or 127.0.0.1 is the most common Railway deploy
# failure there is.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Non-root: the app never needs to write to its own image.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# The Prisma CLI, for `prisma migrate deploy` as the pre-deploy command (T9.5).
# Pinned to the same version as the client to keep the engines in step.
RUN npm install -g prisma@6.19.3 && npm cache clean --force

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# Standalone output: no Next CLI, no pnpm, just Node running the traced server.
CMD ["node", "server.js"]
