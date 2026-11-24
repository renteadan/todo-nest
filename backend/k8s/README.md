# Deploying to k3s with Argo CD

These manifests run the API on a k3s cluster:

- **Postgres** runs as a StatefulSet, with its data on the node's disk (the `local-path` storage class).
- **The API** runs as a Deployment. Each container applies pending Prisma migrations before it starts the API.
- **Redis** relays WebSocket events between API pods (socket.io's Redis adapter), so a client hears about a change whichever pod made it. It stores nothing.
- **NetworkPolicies** let only the API pods reach Postgres and Redis. k3s enforces them with its built-in network policy controller.
- **Caddy**, already running on the host, keeps ports 80 and 443 and terminates HTTPS with a certificate it gets and renews automatically. It forwards the app's domain to Traefik (deployed from the `docker-stacks` repo, `k8s/apps/traefik.yaml`), which routes it to the `todo-backend` Service by the Ingress in [app.yaml](app.yaml).
  ```
  client ──https:443──▶ Caddy ──http:80──▶ Traefik ──Ingress──▶ todo-backend Service ──▶ pods
  ```
- **Argo CD** syncs this folder from `main`.
- **Secrets** are created by hand with `kubectl` and never go into git. Argo CD doesn't manage them.

## How a release flows

1. A pull request is merged into `main`. `main` is protected, so nothing is pushed to it directly.
2. [.github/workflows/backend.yml](../../.github/workflows/backend.yml) builds `ghcr.io/renteadan/todo-backend` and tags it `sha-<commit>`.
3. Within 2 minutes, Argo CD Image Updater (in the `docker-stacks` repo, `k8s/argocd-image-updater/`) sees the new tag in GHCR and sets it on the `todo-backend` Application. Nothing is committed to git; the `images:` tag in [kustomization.yaml](kustomization.yaml) is only the starting point.
4. Argo CD rolls out the new version. Each new pod applies pending migrations before it starts the API, so no new pod takes traffic before its migrations are done.

To see which tag is live: `argocd app get todo-backend` (or the Argo CD UI), not git.

To roll back, first stop the updater from moving the app forward again: remove its entry from `k8s/argocd-image-updater/todo.yaml` in `docker-stacks` and push. Then set the older tag:
```sh
argocd app set todo-backend --kustomize-image ghcr.io/renteadan/todo-backend:sha-<older>
```
Put the entry back once a fixed build is on `main`.

## One-time setup

Run the `kubectl` commands where you have the cluster's kubeconfig.

1. **DNS.** Point an A record for `api.renteadan.com` to the server's public IP.

2. **Disable Traefik in k3s.** Caddy owns ports 80 and 443, so k3s's bundled Traefik isn't used. Add this to `/etc/rancher/k3s/config.yaml`, then `sudo systemctl restart k3s`:
   ```yaml
   disable:
     - traefik
   ```

3. **Site in Caddy.** Add this to the Caddyfile, then reload Caddy:
   ```
   api.renteadan.com {
   	reverse_proxy 10.43.51.95:80
   }
   ```
   The upstream is Traefik's pinned cluster IP (`docker-stacks`, `k8s/apps/traefik.yaml`); the host must also be listed in the Ingress in [app.yaml](app.yaml). Caddy runs on the k3s node, and the node routes cluster IPs to the pods, so Caddy can reach it. Caddy gets the certificate, redirects HTTP to HTTPS and renews the certificate by itself.

4. **Namespace.** Create it now, so the secrets have somewhere to go before Argo CD's first sync:
   ```sh
   kubectl create namespace todo-app
   ```

5. **App secrets.** Copy the examples and fill them in. The `.env` files are gitignored and never committed.
   ```sh
   cd backend
   cp k8s/secrets/postgres.env.example k8s/secrets/postgres.env
   cp k8s/secrets/app.env.example k8s/secrets/app.env
   ```
   Write the values without quotes. The user, password and database name in `DATABASE_URL` must match `postgres.env`. If the password contains URL special characters (`@ : / ? #`), percent-encode it in `DATABASE_URL`, or use `openssl rand -hex 24`.

   Then create the Secrets in the cluster. Keep these exact names, because the manifests refer to them.
   ```sh
   kubectl -n todo-app create secret generic postgres-credentials --from-env-file=k8s/secrets/postgres.env
   kubectl -n todo-app create secret generic todo-backend-env --from-env-file=k8s/secrets/app.env
   ```
   The cluster is now the only place these values live, apart from your local `.env` files. Keep a copy of those somewhere safe, such as a password manager.

6. **GHCR pull secret.** The repo is private, so the images are private too. The token is described in [GitHub tokens](#github-tokens) below.
   ```sh
   kubectl -n todo-app create secret docker-registry ghcr-pull \
     --docker-server=ghcr.io --docker-username=<github-user> --docker-password=<packages-token>
   ```

   Argo CD doesn't manage the Secrets from steps 5 and 6, because they aren't in git. `selfHeal` and `prune` leave them alone.

7. **Repository access for Argo CD.**
   ```sh
   argocd repo add https://github.com/renteadan/todo-nest.git \
     --username <github-user> --password <repo-token>
   ```
   You can also do this in the UI: Settings → Repositories → Connect repo → HTTPS.

8. **Merge, then let Argo CD pick it up.** Merge a pull request into `main` and wait for the first workflow run, which pushes the images. Image Updater picks up the newest one. The Application itself lives in the `docker-stacks` repo (`k8s/apps/todo-backend.yaml`), where the `root` app-of-apps creates it. Then run:
   ```sh
   argocd app get todo-backend   # or watch it in the UI
   ```

9. **Check.**
   ```sh
   curl -H 'Host: api.home.renteadan.com' http://10.43.51.95/health/ready   # Traefik directly (on the node)
   curl https://api.renteadan.com/health/ready      # through Caddy
   ```
   If the first works and the second doesn't, the problem is in Caddy: the upstream address, or the certificate. If both fail, check the pods and `kubectl -n todo-app get svc todo-backend`.

## GitHub tokens

The cluster needs two read-only tokens. GitHub's fine-grained tokens can't access GHCR packages, so the packages token is a classic one.

| Used by | Kind | Access |
|---|---|---|
| Argo CD, to read the repo (step 7) | Fine-grained | Only `todo-nest`, **Contents: Read-only** |
| The kubelet, to pull images (step 6) | Classic | **`read:packages`** only |

When a token expires, Argo CD stops syncing, or new pods can't pull images. Note the expiry dates, and replace the tokens with `argocd repo add ... --upsert` and by re-creating `ghcr-pull`.

## Day to day

- **Release:** merge a pull request into `main`. Everything else is automatic.
- **Change a secret:** edit the `.env` file, then replace the Secret. `create` refuses to overwrite an existing Secret, so render it and apply it instead. Pods read env vars only at startup, so restart them afterwards:
  ```sh
  kubectl -n todo-app create secret generic todo-backend-env --from-env-file=k8s/secrets/app.env \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n todo-app rollout restart deploy/todo-backend
  ```
  For a Postgres password, you must also change it inside the database. The image only applies `POSTGRES_PASSWORD` when the database is first created.
- **Manual changes** to the cluster are reverted by Argo CD (`selfHeal`). Change the manifests in git instead.
- **Logs:**
  - `kubectl -n todo-app logs deploy/todo-backend -f` (migrations first, then the API)
- **Back up the database:**
  ```sh
  kubectl -n todo-app exec postgres-0 -- sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
  ```
  The data is on the node's disk under `/var/lib/rancher/k3s/storage`. Nothing backs it up for you.

## Health endpoints

| Path | Used by | Checks |
|---|---|---|
| `/health/live` | startup and liveness probes | The process answers. A database outage doesn't restart the pods. |
| `/health/ready` | readiness probe | Postgres answers within 1.5 s. If not, the pod is taken out of the Service. |
