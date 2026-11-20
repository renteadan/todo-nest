# Deploying to k3s

These manifests run the API on a k3s cluster:

- **Postgres** runs as a StatefulSet, with its data on the node's disk (the `local-path` storage class).
- **The API** runs as a Deployment with 2 replicas. Before the app starts, an init container applies pending Prisma migrations.
- **Traefik**, which comes with k3s, handles ingress, and cert-manager provides HTTPS through Let's Encrypt.

The images are built by [.github/workflows/docker.yml](../.github/workflows/docker.yml) on every push to `main`:

- `ghcr.io/renteadan/todo-nest` (the API)
- `ghcr.io/renteadan/todo-nest-migrate` (the migrations)

Run the `kubectl` commands on the server, or anywhere with its kubeconfig. On k3s the kubeconfig is `/etc/rancher/k3s/k3s.yaml`.

## One-time setup

1. **DNS.** Point an A record for your domain (for example `api.yourdomain.com`) to the server's public IP. Open ports 80 and 443. Let's Encrypt needs port 80 for its HTTP challenge.

2. **cert-manager.**
   ```sh
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml
   kubectl -n cert-manager rollout status deploy/cert-manager-webhook
   ```
   Then set your email in [cluster-issuer.yaml](cluster-issuer.yaml) and apply it:
   ```sh
   kubectl apply -f k8s/cluster-issuer.yaml
   ```

3. **Domain.** Replace `api.example.com` in [ingress.yaml](ingress.yaml) (it appears twice).

4. **Secrets.** These files are gitignored. Never commit them.
   ```sh
   cp k8s/secrets/postgres.env.example k8s/secrets/postgres.env
   cp k8s/secrets/app.env.example k8s/secrets/app.env
   ```
   Fill them in without quotes around the values. The user, password and database name in `DATABASE_URL` must match `postgres.env`. If the password contains URL special characters (`@ : / ? #`), percent-encode it in `DATABASE_URL`, or pick a password made of letters and digits only (`openssl rand -hex 24`).

5. **Images.** Push to `main` and wait for the *Docker images* workflow to finish. GHCR packages start out private. Either make both packages public (GitHub → your profile → Packages → package settings), or give the cluster a pull secret. For the pull secret, use a personal access token (classic) with only the `read:packages` scope, and run this after the namespace exists (step 6 creates it):
   ```sh
   kubectl -n todo-nest create secret docker-registry ghcr-pull \
     --docker-server=ghcr.io --docker-username=<github-user> --docker-password=<token>
   ```

6. **Deploy.**
   ```sh
   kubectl apply -k k8s
   kubectl -n todo-nest get pods -w
   ```
   Pods that started before the pull secret existed retry the pull on their own.

7. **Check.**
   ```sh
   kubectl -n todo-nest get certificate   # READY=True after a minute or so
   curl https://api.yourdomain.com/health/ready
   ```

## Day to day

- **Release:** push to `main`, wait for the workflow, then pull the new `latest` images:
  ```sh
  kubectl -n todo-nest rollout restart deployment/todo-nest
  ```
  New migrations run in the init container before any new pod takes traffic. Old pods keep serving until the new ones are ready.
- **Change a secret:** edit the `.env` file and run `kubectl apply -k k8s`. The Secret name changes, which rolls out the pods that use it.
- **Logs:**
  - `kubectl -n todo-nest logs deploy/todo-nest -f` (the API)
  - `... -c migrate` (the migrations)
- **Back up the database:**
  ```sh
  kubectl -n todo-nest exec postgres-0 -- sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
  ```
  The data is on the node's disk under `/var/lib/rancher/k3s/storage`. Schedule regular dumps: nothing backs it up for you.

## Health endpoints

| Path | Used by | Checks |
|---|---|---|
| `/health/live` | startup and liveness probes | The process answers. A database outage doesn't restart the pods. |
| `/health/ready` | readiness probe | Postgres answers within 1.5 s. If not, the pod is taken out of the Service. |
