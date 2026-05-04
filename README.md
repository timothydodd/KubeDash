# KubeDash

Lightweight Kubernetes dashboard. ASP.NET Core 10 backend, Angular 21 frontend with SignalR for live updates.

## Features

- Cluster overview: aggregated CPU/memory + per-node cards.
- Pod table with search, namespace + status filters, sortable columns, and 24h error/warning counts.
- Live pod log viewer streamed straight from the K8s API (no agent).
- Multi-level + time-range filtering, syntax highlighting, day dividers.
- JWT auth backed by SQLite via [RoboDodd.OrmLite](https://github.com/timothydodd/RoboDodd.OrmLite).

## Quick start

This repo uses git submodules:

```bash
git clone --recurse-submodules https://github.com/timothydodd/KubeDash
# or, if already cloned:
git submodule update --init --recursive
```

### Run locally

```bash
# Backend
cd src/api
dotnet run

# Frontend (separate terminal)
cd src/web/kube-dash
npm install
npm start
```

The dev build proxies `http://localhost:4200` to the API on `http://localhost:5211`.

Default seeded user: **admin / admin** — change via the user menu after first login.

### Run with Docker

```bash
docker build -t kubedash:dev .
docker run -p 8080:8080 \
  -v $HOME/.kube:/home/app/.kube:ro \
  -v kubedash-data:/app/data \
  kubedash:dev
```

### Deploy to k3s

A sample manifest is in [`deploy/k3s/kubedash.yaml`](deploy/k3s/kubedash.yaml). It includes:

- ServiceAccount + ClusterRole with the read-only permissions the dashboard needs.
- A Secret for the JWT signing key (replace before applying).
- A PersistentVolumeClaim backing the SQLite user store.
- Liveness/readiness probes pointed at `/api/health/live` and `/api/health/ready`.
- Traefik Ingress (k3s default).

```bash
# Generate a real JWT secret first, then replace the placeholder in the manifest.
openssl rand -base64 48

kubectl apply -f deploy/k3s/kubedash.yaml
```

## Architecture

```
src/
  api/                  ASP.NET Core 10 API + SignalR hubs
  RoboDodd.OrmLite/     submodule - ORM
  web/kube-dash/
    src/rd-ui/          submodule - shared Angular UI library
    src/app/            kube-dash app
deploy/k3s/             sample manifest
.github/workflows/ci.yml
Dockerfile
```

## Health endpoints

| Endpoint | Use |
|---|---|
| `GET /api/health/live` | Liveness — process responding. |
| `GET /api/health/ready` | Readiness — sqlite + kube API reachable. |
| `GET /api/health` | Full report (JSON). |

## License

MIT.
