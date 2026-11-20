# Deploying to k3s with Argo CD

These manifests run the API on a k3s cluster:

- **Postgres** runs as a StatefulSet, with its data on the node's disk (the `local-path` storage class).
- **The API** runs as a Deployment with 2 replicas. Before the app starts, an init container applies pending Prisma migrations.
- **Traefik**, which comes with k3s, handles ingress, and cert-manager provides HTTPS through Let's Encrypt.
- **Argo CD** syncs this folder from `main`.
- **Secrets** are created by hand with `kubectl` and never go into git. Argo CD doesn't manage them.

## How a release flows

1. You push to `main`.
2. [.github/workflows/docker.yml](../.github/workflows/docker.yml) builds `ghcr.io/renteadan/todo-nest` and `ghcr.io/renteadan/todo-nest-migrate`, and tags both `sha-<commit>`.
3. The workflow's `deploy` job writes that tag into [kustomization.yaml](kustomization.yaml) (`images:`) and commits `deploy: <sha>` to `main`.
4. Argo CD sees the commit and rolls out the new version. Migrations run in the init container before any new pod takes traffic.

To roll back, revert the `deploy:` commit, or pick an older sync in the Argo CD UI.

If `main` is protected by branch rules, allow GitHub Actions to push to it. Otherwise the `deploy` job fails.

## One-time setup

Run the `kubectl` commands where you have the cluster's kubeconfig.

1. **DNS.** Point an A record for your domain to the server's public IP. Open ports 80 and 443. Let's Encrypt needs port 80 for its HTTP challenge.

2. **Domain.** Replace `api.example.com` in [ingress.yaml](ingress.yaml) (it appears twice).

3. **cert-manager.**
   ```sh
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml
   kubectl -n cert-manager rollout status deploy/cert-manager-webhook
   ```
   Then set your email in [cluster-issuer.yaml](cluster-issuer.yaml) and apply it:
   ```sh
   kubectl apply -f k8s/cluster-issuer.yaml
   ```

4. **Namespace.** Create it now, so the secrets have somewhere to go before Argo CD's first sync:
   ```sh
   kubectl create namespace todo-nest
   ```

5. **App secrets.** Copy the examples and fill them in. The `.env` files are gitignored and never committed.
   ```sh
   cp k8s/secrets/postgres.env.example k8s/secrets/postgres.env
   cp k8s/secrets/app.env.example k8s/secrets/app.env
   ```
   Write the values without quotes. The user, password and database name in `DATABASE_URL` must match `postgres.env`. If the password contains URL special characters (`@ : / ? #`), percent-encode it in `DATABASE_URL`, or use `openssl rand -hex 24`.

   Then create the Secrets in the cluster. Keep these exact names, because the manifests refer to them.
   ```sh
   kubectl -n todo-nest create secret generic postgres-credentials --from-env-file=k8s/secrets/postgres.env
   kubectl -n todo-nest create secret generic todo-nest-env --from-env-file=k8s/secrets/app.env
   ```
   The cluster is now the only place these values live, apart from your local `.env` files. Keep a copy of those somewhere safe, such as a password manager.

6. **GHCR pull secret.** The repo is private, so the images are private too. The token is described in [GitHub tokens](#github-tokens) below.
   ```sh
   kubectl -n todo-nest create secret docker-registry ghcr-pull \
     --docker-server=ghcr.io --docker-username=<github-user> --docker-password=<packages-token>
   ```

   Argo CD doesn't manage the Secrets from steps 5 and 6, because they aren't in git. `selfHeal` and `prune` leave them alone.

7. **Repository access for Argo CD.**
   ```sh
   argocd repo add https://github.com/renteadan/todo-nest.git \
     --username <github-user> --password <repo-token>
   ```
   You can also do this in the UI: Settings → Repositories → Connect repo → HTTPS.

8. **Push, then create the Application.** Push to `main` and wait for the first workflow run, which pins the image tags. Then run:
   ```sh
   kubectl apply -f k8s/argocd/application.yaml
   argocd app get todo-nest   # or watch it in the UI
   ```

9. **Check.**
   ```sh
   kubectl -n todo-nest get certificate   # READY=True after a minute or so
   curl https://api.yourdomain.com/health/ready
   ```

## GitHub tokens

The cluster needs two read-only tokens. GitHub's fine-grained tokens can't access GHCR packages, so the packages token is a classic one.

| Used by | Kind | Access |
|---|---|---|
| Argo CD, to read the repo (step 7) | Fine-grained | Only `todo-nest`, **Contents: Read-only** |
| The kubelet, to pull images (step 6) | Classic | **`read:packages`** only |

When a token expires, Argo CD stops syncing, or new pods can't pull images. Note the expiry dates, and replace the tokens with `argocd repo add ... --upsert` and by re-creating `ghcr-pull`.

## Day to day

- **Release:** push to `main`. Everything else is automatic.
- **Change a secret:** edit the `.env` file, then replace the Secret. `create` refuses to overwrite an existing Secret, so render it and apply it instead. Pods read env vars only at startup, so restart them afterwards:
  ```sh
  kubectl -n todo-nest create secret generic todo-nest-env --from-env-file=k8s/secrets/app.env \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n todo-nest rollout restart deploy/todo-nest
  ```
  For a Postgres password, you must also change it inside the database. The image only applies `POSTGRES_PASSWORD` when the database is first created.
- **Manual changes** to the cluster are reverted by Argo CD (`selfHeal`). Change the manifests in git instead.
- **Logs:**
  - `kubectl -n todo-nest logs deploy/todo-nest -f` (the API)
  - `... -c migrate` (the migrations)
- **Back up the database:**
  ```sh
  kubectl -n todo-nest exec postgres-0 -- sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
  ```
  The data is on the node's disk under `/var/lib/rancher/k3s/storage`. Nothing backs it up for you.

## Health endpoints

| Path | Used by | Checks |
|---|---|---|
| `/health/live` | startup and liveness probes | The process answers. A database outage doesn't restart the pods. |
| `/health/ready` | readiness probe | Postgres answers within 1.5 s. If not, the pod is taken out of the Service. |
