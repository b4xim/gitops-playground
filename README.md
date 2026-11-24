# GitOps Playground 🐙

A lightweight, multi-tier demo application designed specifically for learning **GitOps**, **ArgoCD**, and Kubernetes rollout patterns.

The UI provides instant visual feedback for GitOps actions: when you update a Git value (image tag, replica count, environment variable, or theme color) and sync with ArgoCD, the dashboard dynamically shows the rollout in real-time.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │        Browser (Single Page UI)      │
                      └──────────────────┬───────────────────┘
                                         │ :8080
                                         ▼
                      ┌──────────────────────────────────────┐
                      │   Frontend (Nginx Unprivileged)      │
                      │   - Serves React/Vite SPA            │
                      │   - Proxies /api/ to backend via env │
                      └──────────────────┬───────────────────┘
                                         │ :8080
                                         ▼
                      ┌──────────────────────────────────────┐
                      │       Backend (Node.js/Express)      │
                      │   - /api/info, /api/visits           │
                      │   - /healthz, /readyz probes         │
                      │   - JSON structured logging          │
                      └──────────────────┬───────────────────┘
                                         │ :6379
                                         ▼
                      ┌──────────────────────────────────────┐
                      │           Redis (7-alpine)           │
                      │   - Visit counter state              │
                      └──────────────────────────────────────┘
```

- **Frontend**: React + Vite SPA served by `nginxinc/nginx-unprivileged:alpine`. Reverse-proxies `/api/` to the backend service dynamically via the `BACKEND_URL` environment variable at container startup.
- **Backend**: Node.js/Express service. Outputs structured JSON logs, responds to Kubernetes liveness (`/healthz`) and readiness (`/readyz`) probes, and gracefully handles `SIGTERM`.
- **Redis**: In-memory database used by the backend to store and increment the visit counter.

---

## Repository Structure

```text
├── app/
│   ├── backend/
│   │   ├── Dockerfile             # Multi-stage, non-root (USER node), multi-arch
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js           # API server, probes, graceful shutdown
│   │       └── logger.js          # Structured JSON logger
│   └── frontend/
│       ├── Dockerfile             # Multi-stage, non-root (UID 101), multi-arch
│       ├── nginx.conf.template    # Dynamic proxy configuration for envsubst
│       ├── package.json
│       ├── vite.config.js
│       ├── index.html
│       └── src/
│           ├── App.jsx            # Real-time rollout & observability dashboard
│           ├── main.jsx
│           └── index.css
├── deploy/                        # Helm chart root (path: deploy for ArgoCD)
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-dev.yaml
│   ├── values-prod.yaml
│   ├── templates/
│   └── README.md
├── docker-compose.yml             # Local multi-container testing stack
├── Makefile                       # Automated build, test, and tag targets
└── README.md
```

---

## Quickstart: Local Development with Docker Compose

Ensure Docker Desktop or Docker engine is running:

```bash
# Start all 3 tiers (frontend on :8080, backend on :8081, redis on :6379)
make up

# View running container logs
make logs

# Run automated tests against all endpoints
make test

# Stop the containers
make down
```

Open your browser to **[http://localhost:8080](http://localhost:8080)** to access the dashboard.

---

## Environment Variables Reference

### Backend Configuration

All backend settings are loaded from environment variables (ideal for Kubernetes `ConfigMap` and `Secret` exercises):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port on which the HTTP server listens |
| `APP_VERSION` | `v1.0.0` | Application version badge displayed on the UI |
| `APP_ENV` | `local` | Environment identifier badge (e.g. `dev`, `staging`, `production`) |
| `THEME_COLOR` | `#2563eb` | Hex color code that dynamically styles UI accents and banners |
| `WELCOME_MESSAGE` | `Welcome to GitOps Playground!` | Greeting text displayed in the dashboard banner |
| `REDIS_HOST` | `redis` | Hostname/DNS name of the Redis service |
| `REDIS_PORT` | `6379` | Port of the Redis service |
| `REDIS_PASSWORD` | *(none)* | Optional Redis password (for practicing K8s Secrets) |

### Frontend Configuration

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port on which Nginx listens |
| `BACKEND_URL` | `http://backend:8080` | Target URL used by Nginx to proxy `/api/`, `/healthz`, and `/readyz` |

---

## API Endpoints Reference

| Endpoint | Method | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/info` | `GET` | Backend | Returns version, pod hostname, environment, theme color, message, and timestamp |
| `/api/visits` | `GET` | Backend | Increments and returns the Redis visit counter along with pod hostname |
| `/healthz` | `GET` | Backend | **Liveness Probe**: Returns `200 OK` as long as the backend process is running |
| `/readyz` | `GET` | Backend | **Readiness Probe**: Returns `200 OK` if Redis is reachable, or `503 Service Unavailable` if Redis is down |

---

## Building and Pushing Container Images

Images use multi-stage builds, run as non-root users, and support both `linux/amd64` and `linux/arm64` (compatible with local kind clusters, Minikube, and cloud environments like AWS EKS).

### 1. Build Single Architecture (Local Docker)

```bash
# Build v1.0.0 images
make build-v1
# or
make build VERSION=v1.0.0 REGISTRY=my-dockerhub-user
```

### 2. Build Upgrades (v1.0.0 vs v1.1.0) for Rollout and Rollback Practice

To practice rolling updates and rollbacks with ArgoCD, build and push two version tags:

```bash
# Build v1.0.0 (Blue theme #2563eb)
docker build -t <YOUR_REGISTRY>/gitops-playground-backend:v1.0.0 ./app/backend
docker build -t <YOUR_REGISTRY>/gitops-playground-frontend:v1.0.0 ./app/frontend

# Build v1.1.0 (Green theme #10b981)
docker build -t <YOUR_REGISTRY>/gitops-playground-backend:v1.1.0 ./app/backend
docker build -t <YOUR_REGISTRY>/gitops-playground-frontend:v1.1.0 ./app/frontend

# Push both versions to your container registry
docker push <YOUR_REGISTRY>/gitops-playground-backend:v1.0.0
docker push <YOUR_REGISTRY>/gitops-playground-backend:v1.1.0
docker push <YOUR_REGISTRY>/gitops-playground-frontend:v1.0.0
docker push <YOUR_REGISTRY>/gitops-playground-frontend:v1.1.0
```

### 3. Multi-Arch Build with Docker Buildx (for EKS & kind cross-architecture)

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t <YOUR_REGISTRY>/gitops-playground-backend:v1.0.0 \
  --push ./app/backend

docker buildx build --platform linux/amd64,linux/arm64 \
  -t <YOUR_REGISTRY>/gitops-playground-frontend:v1.0.0 \
  --push ./app/frontend
```

---

## Ideas to Practice with ArgoCD

Here are practical GitOps scenarios you can explore using this app:

1. **Automated Sync Policies and Pruning**
2. **Self-Healing and Drift Detection**
3. **Application Rollouts and Instant Rollbacks**
4. **ConfigMap and Secret Updates (Watching Theme and Messages Change)**
5. **Readiness Probe Failures and Degraded Health Status**
6. **Blue/Green and Canary Deployments with Argo Rollouts**
7. **ArgoCD Sync Phases and Resource Waves**
8. **App of Apps Pattern and Multi-Environment Overlays**
9. **Kustomize Image Tag Transformations via GitOps Commits**
10. **Pre-Sync and Post-Sync Lifecycle Hooks**
