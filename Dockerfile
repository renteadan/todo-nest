# syntax=docker/dockerfile:1

# Two images from one file:
#   --target runtime  the API (default, last stage)
#   --target migrate  runs `prisma migrate deploy`; used as the pod's init container

FROM node:24-slim AS base
WORKDIR /app

# All dependencies, dev included: the Nest CLI, TypeScript and the Prisma CLI.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# src/generated/prisma is gitignored, so the client is generated here.
RUN npx prisma generate --config prisma7.config.ts \
 && npm run build \
 && npm prune --omit=dev

FROM deps AS migrate
COPY prisma7.config.ts ./
COPY src/prisma ./src/prisma
USER node
CMD ["npx", "prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
