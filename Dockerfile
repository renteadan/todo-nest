# syntax=docker/dockerfile:1

FROM node:24-slim AS base
WORKDIR /app
# Prisma's migration engine links against OpenSSL, which the slim image lacks.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# src/generated/prisma is gitignored, so the client is generated here.
RUN npx prisma generate --config prisma7.config.ts \
 && npm run build \
 && npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# What `prisma migrate deploy` reads at startup.
COPY --from=build --chown=node:node /app/prisma7.config.ts ./
COPY --from=build --chown=node:node /app/src/prisma ./src/prisma
USER node
EXPOSE 3000
# Applies pending migrations, then replaces the shell with node (exec), so node
# is PID 1 and gets SIGTERM directly. Several pods starting at once is safe:
# Prisma takes an advisory lock, and the others wait and find nothing to apply.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --config prisma7.config.ts && exec node dist/main.js"]
