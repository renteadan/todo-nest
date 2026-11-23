# todo

A todo app: a NestJS API with Postgres and Redis, and a Next.js frontend. Both run on a single-node k3s cluster, deployed by Argo CD.

Users sign up, make task lists and add tasks with optional details and a deadline. Tasks without a list land in the **Inbox**. They are moved between lists by dragging, edited inline, and ticked off. Changes show up live in every open tab.

| Folder | What it is |
|---|---|
| [backend/](backend/) | NestJS API with Prisma 7 and Postgres. JWT auth, users, task lists, tasks, health checks, live updates over socket.io. |
| [frontend/](frontend/) | Next.js 16 app with Tailwind 4. Login, signup and the tasks page. |
| [backend/k8s/](backend/k8s/) | Manifests for Postgres, Redis and the API, and the full cluster setup guide. |
| [frontend/k8s/](frontend/k8s/) | Manifests for the frontend. |
| [.github/workflows/](.github/workflows/) | CI on pull requests, and one image build per app on `main`. |
| [docker-compose.yml](docker-compose.yml) | The whole stack locally. |

## Run locally

### With Docker Compose

```sh
docker compose up --build          # or `docker compose up --watch` to rebuild on source changes
```

- Frontend: http://localhost:3000. API: http://localhost:3001.
- Postgres (`todo`/`todo`) and Redis run as containers. Postgres keeps its data in the `pgdata` volume.
- Each app also loads its own env file if it exists: `backend/.env` and `frontend/.env.local`. The values in `docker-compose.yml` win over the files, so the container-network URLs and ports stay correct. Use the files for extras such as the Observe keys.
- `JWT_SECRET` comes from `backend/.env` and must be set there.
- The frontend image runs in production mode, so the session cookies are `Secure` while Compose serves plain http. Chrome and Firefox accept that on `localhost`; older Safari versions drop the cookies, so login won't stick there. Use another browser, or run the frontend [without Docker](#without-docker).

### Without Docker

Both apps use Node 24. The backend needs a Postgres database, and Redis is optional.

**Backend:**

```sh
cd backend
npm install
# .env: DATABASE_URL=postgresql://..., JWT_SECRET=..., PORT=... (defaults to 3000)
# optional: REDIS_URL, OBSERVE_APP_KEY and OBSERVE_APP_SECRET
npx prisma migrate dev --config prisma7.config.ts   # applies migrations and generates the client
npm run dev
```

**Frontend:**

```sh
cd frontend
npm install
# .env.local: BACKEND_URL=http://localhost:<api port>, BACKEND_PUBLIC_URL=http://localhost:<api port>
npm run dev   # http://localhost:3000
```

The two apps default to the same port, so give the API another one (`PORT` in `backend/.env`).

## Checks

Pull requests run [ci.yml](.github/workflows/ci.yml). It runs Prettier, lint, the unit tests and both builds. `main` is protected: changes go in through pull requests with passing checks, and nothing pushes to it directly.

Locally, run `npm run format:check`, `npm run lint`, `npm test` and `npm run build` in each app. The backend also has `npm run test:e2e`.

## Deployment

Everything is in the `todo-app` namespace on k3s:

```
client ──https──▶ Caddy (on the node) ──▶ todo-backend Service  10.43.115.124 ──▶ API pods ──▶ postgres
                                      │                                            └─▶ redis (WebSocket events between pods)
                                      └─▶ todo-frontend Service 10.43.115.125 ──▶ Next.js pods
```

- The Service cluster IPs are pinned, so Caddy can `reverse_proxy` straight to them. There is no ingress controller. The API is at `api.renteadan.com`.
- When a merge to `main` changes an app's code, its workflow runs ([backend.yml](.github/workflows/backend.yml), [frontend.yml](.github/workflows/frontend.yml)). It builds `ghcr.io/renteadan/todo-<app>`, tags it `sha-<commit>` and `latest`, and dates the image by the commit. Changes to `k8s/` or Markdown files don't trigger a build. Nothing is committed back to git.
- Argo CD Image Updater sees the new tag in GHCR within 2 minutes and sets it on the app's Argo CD Application, which rolls out the new version. The Applications and the updater's config live in the `docker-stacks` repo. Rollback steps are in [backend/k8s/README.md](backend/k8s/README.md#how-a-release-flows).
- The backend applies pending Prisma migrations when each pod starts.
- The frontend calls the API server-side through `BACKEND_URL` (`http://todo-backend` in the cluster). The browser opens its socket.io connection to `BACKEND_PUBLIC_URL` (`https://api.renteadan.com`).
- Clients get live task updates over socket.io on the API's port (`/socket.io/`, WebSocket transport only). With `REDIS_URL` set, as in the cluster, events go through Redis so every API pod can deliver them. Without it, they stay in one process. With `NODE_ENV=production` (set by the Dockerfile), the API refuses to start without `REDIS_URL`.
- Secrets (`postgres-credentials`, `todo-backend-env`, `ghcr-pull`) are created by hand with `kubectl` and are never in git.

The one-time setup (DNS, Caddy, secrets, GHCR and Argo CD access) and the day-to-day commands are in [backend/k8s/README.md](backend/k8s/README.md). The frontend reuses the same namespace and `ghcr-pull` secret. It has its own Argo CD Application and its own Caddy site pointing to `10.43.115.125:80`.
