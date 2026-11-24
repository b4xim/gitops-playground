# Deploy Manifests (Helm Chart)

This directory is the root of the **GitOps Playground Helm Chart**. Because `Chart.yaml` is located directly in `deploy/`, you can point your ArgoCD Application path directly to `path: deploy`.

## Directory Structure

```text
deploy/
├── Chart.yaml            # Helm Chart metadata
├── values.yaml           # Default values (v1.0.0, blue theme, 2 replicas)
├── values-dev.yaml       # Development overlay (v1.1.0, green theme, 1 replica)
├── values-prod.yaml      # Production overlay (v1.0.0, purple theme, 3 replicas)
├── templates/            # Kubernetes manifest templates
│   ├── _helpers.tpl
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── backend-configmap.yaml
│   ├── backend-secret.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── redis-deployment.yaml
│   ├── redis-service.yaml
│   ├── ingress.yaml
│   └── NOTES.txt
└── README.md
```

---

## ArgoCD Application Definition

With `Chart.yaml` directly in `deploy/`, set `path: deploy`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: gitops-playground
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<your-username>/gitops-playground.git
    targetRevision: HEAD
    path: deploy
    helm:
      valueFiles:
        - values.yaml
        # - values-dev.yaml # Uncomment for dev environment testing
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

## Local Helm Commands

```bash
# Lint the chart in deploy/
helm lint deploy

# Render templates locally
helm template playground deploy

# Render with dev overlay
helm template playground deploy -f deploy/values-dev.yaml
```
