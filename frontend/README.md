# todo frontend

The web app for todo: Next.js 16 (App Router, Server Actions) with Tailwind 4. To run the whole stack, see the [root README](../README.md).

## Pages

| Route     | What it is                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`       | Login form. A visitor who is already logged in goes on to `/tasks`.                                                                                          |
| `/signup` | Create an account.                                                                                                                                           |
| `/tasks`  | The app. Add tasks with details and a deadline, make lists, drag tasks between lists and the Inbox, edit inline, tick off, and show or hide completed tasks. |

- **Deadlines** use a custom date picker ([app/tasks/date-picker.tsx](app/tasks/date-picker.tsx)) with a calendar, quick picks and a time field. A date is only saved when you press ✓. Times are shown in the browser's time zone and stored as UTC.
- **Sessions:** the access and refresh tokens are kept in httpOnly cookies. [proxy.ts](proxy.ts) guards `/tasks` and refreshes an expired access token. All API calls happen server-side, in Server Actions and server components.
- **Live updates:** the tasks page connects to the API's socket.io endpoint from the browser and refreshes when a task changes in another tab or device.

## Environment

| Variable             | What for                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL`        | Where the server calls the API, e.g. `http://localhost:3001`. In the cluster: `http://todo-backend`.                                  |
| `BACKEND_PUBLIC_URL` | Where the browser opens its socket.io connection. In the cluster: `https://api.renteadan.com`. Live updates are off when it is unset. |

Put local values in `.env.local`.

## Scripts

```sh
npm install
npm run dev           # http://localhost:3000
npm run lint          # ESLint
npm run format:check  # Prettier
npm run build && npm start
```

## Deployment

The Docker image runs Next.js in standalone mode on port 3000. It is built by [frontend.yml](../.github/workflows/frontend.yml) and deployed to k3s by Argo CD with the manifests in [k8s/](k8s/). See the [root README](../README.md#deployment).
