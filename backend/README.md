# todo backend

The API for the todo app: NestJS, Prisma 7 with Postgres, JWT auth, and live updates over socket.io. To run the whole stack, see the [root README](../README.md).

## Endpoints

| Path | What it does |
|---|---|
| `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all` | Accounts and sessions. Login returns a short-lived access token and a rotating refresh token. |
| `GET` / `PATCH` / `DELETE /user/:id` | Your own user. |
| `/tasklist` | CRUD for your task lists. `POST` / `DELETE /tasklist/:id/task/:taskId` moves a task into or out of a list. A list holds at most 50 tasks. |
| `/task` | CRUD for your tasks: title, details, deadline, done. Tasks with no list are the Inbox. |
| `GET /health/live`, `/health/ready` | Probes. `ready` also checks Postgres. |
| `/socket.io/` | Live task events for the signed-in user (WebSocket transport only). |

Every resource belongs to one user, and nobody else can read or change it.

The schema is in [src/prisma/schema.prisma](src/prisma/schema.prisma). Migrations are in [prisma/migrations](prisma/migrations).

## Environment

| Variable | Needed | What for |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. |
| `JWT_SECRET` | yes | Signs access tokens. Use a long random value. |
| `REDIS_URL` | in production | Shares socket.io events between pods. Optional locally. With `NODE_ENV=production`, the API won't start without it. |
| `PORT` | no | Defaults to 3000. |
| `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET` | no | [NestJS Observe](https://observe.nestjs.com) tracing, metrics and logs. |

The `start`, `dev` and `start:debug` scripts load `.env`.

## Scripts

```sh
npm install
npx prisma migrate dev --config prisma7.config.ts   # apply migrations, generate the client
npm run dev           # watch mode
npm test              # unit tests (Vitest)
npm run test:e2e      # end-to-end tests
npm run lint          # oxlint
npm run format:check  # Prettier
npm run build && npm run start:prod
```

## Observability

The app is already instrumented for NestJS Observe. To connect it locally, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link):

```sh
npx @nestjs/observe link
```

It writes the key pair into `.env`. In the cluster, the pair goes into the `todo-backend-env` Secret.

## Deployment

The Docker image runs the pending migrations, then starts the API. It is built by [backend.yml](../.github/workflows/backend.yml) and deployed to k3s by Argo CD. The setup and day-to-day commands are in [k8s/README.md](k8s/README.md).
