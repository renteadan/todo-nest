# todo

A todo app: a NestJS API with Postgres, and a Next.js frontend. Both run on a single-node k3s cluster, deployed by Argo CD.

| Folder | What it is |
|---|---|
| [backend/](backend/) | NestJS API with Prisma 7 and Postgres. JWT auth (`/auth`), users (`/user`), health checks (`/health`). |
| [frontend/](frontend/) | Next.js 16 app with Tailwind 4. |
| [backend/k8s/](backend/k8s/) | Manifests for Postgres and the API, and the full cluster setup guide. |
| [frontend/k8s/](frontend/k8s/) | Manifests for the frontend. |
| [.github/workflows/](.github/workflows/) | One workflow per app: build the image, then pin it for Argo CD. |

## Run locally

Both apps use Node 24.

**Backend** (needs a Postgres database):

```sh
cd backend
npm install
# .env: DATABASE_URL=postgresql://..., JWT_SECRET=...
# (optional: OBSERVE_APP_KEY and OBSERVE_APP_SECRET for NestJS Observe)
npx prisma migrate dev --config prisma7.config.ts   # applies migrations and generates the client
npm run start:dev                                   # http://localhost:3000
```

Tests: `npm test` (unit) and `npm run test:e2e`. Lint: `npm run lint`.

**Frontend:**

```sh
cd frontend
npm install
npm run dev   # http://localhost:3000, so run it on another port (-- -p 3001) next to the backend
```

## Deployment

Everything is in the `todo-app` namespace on k3s:

```
client ──https──▶ Caddy (on the node) ──▶ todo-backend Service  10.43.115.124 ──▶ API pods ──▶ postgres
                                      │                                            └─▶ redis (WebSocket events between pods)
                                      └─▶ todo-frontend Service 10.43.115.125 ──▶ Next.js pods
```

- The Service cluster IPs are pinned, so Caddy can `reverse_proxy` straight to them. There is no ingress controller.
- A push to `main` that changes an app's code runs its workflow ([backend.yml](.github/workflows/backend.yml), [frontend.yml](.github/workflows/frontend.yml)). It builds `ghcr.io/renteadan/todo-<app>`, tagged `sha-<commit>`. Nothing is committed back to git.
- Argo CD Image Updater sees the new tag in GHCR within 2 minutes and sets it on the app's Argo CD Application, which rolls out the new version. The Applications and the updater's config live in the `docker-stacks` repo. Rollback steps are in [backend/k8s/README.md](backend/k8s/README.md#how-a-release-flows).
- The backend applies pending Prisma migrations when each pod starts.
- Clients get live task updates over socket.io on the API's port (`/socket.io/`, WebSocket transport only). With `REDIS_URL` set, as in the cluster, events go through Redis so every API pod can deliver them. Without it, as locally, they stay in one process. With `NODE_ENV=production` (set by the Dockerfile) the API refuses to start without `REDIS_URL`.
- Secrets (`postgres-credentials`, `todo-backend-env`, `ghcr-pull`) are created by hand with `kubectl` and are never in git.

The one-time setup (DNS, Caddy, secrets, GHCR and Argo CD access) and the day-to-day commands are in [backend/k8s/README.md](backend/k8s/README.md). The frontend reuses the same namespace and `ghcr-pull` secret. It needs its own Argo CD Application and its own Caddy site pointing to `10.43.115.125:80`.
