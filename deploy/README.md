# Deploy Manifests & Helm Charts

This directory contains deployment definitions for the `gitops-playground` application.

## Directory Structure

```text
deploy/
├── README.md
└── helm/
    └── gitops-playground/        # Complete Helm Chart
        ├── Chart.yaml            # Metadata
        ├── values.yaml           # Default values (v1.0.0, blue theme, 2 replicas)
        ├── values-dev.yaml       # Development overlay (v1.1.0, green theme, 1 replica)
        ├── values-prod.yaml      # Production overlay (v1.0.0, purple theme, 3 replicas)
        └── templates/
            ├── _helpers.tpl
            ├── backend-deployment.yaml
            ├── backend-service.yaml
            ├── backend-configmap.yaml
            ├── backend-secret.yaml
            ├── frontend-deployment.yaml
            ├── frontend-service.yaml
            ├── redis-deployment.yaml
            ├── redis-service.yaml
            ├── ingress.yaml
            └── NOTES.txt
```

---

## Testing & Linting the Chart

To lint the chart:

```bash
helm lint deploy/helm/gitops-playground
```

To render templates locally without installing:

```bash
# Render default templates
helm template playground deploy/helm/gitops-playground

# Render with development values overlay
helm template playground-dev deploy/helm/gitops-playground -f deploy/helm/gitops-playground/values-dev.yaml

# Render with production values overlay
helm template playground-prod deploy/helm/gitops-playground -f deploy/helm/gitops-playground/values-prod.yaml
```

---

## Installing Directly with Helm

```bash
# Install with default values
helm install gitops-playground deploy/helm/gitops-playground

# Or install for a specific environment
helm install gitops-playground-dev deploy/helm/gitops-playground -f deploy/helm/gitops-playground/values-dev.yaml
```

---

## Deploying with ArgoCD

You can create an ArgoCD `Application` pointing to this Helm chart:

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
    path: deploy/helm/gitops-playground
    helm:
      valueFiles:
        - values.yaml
        # - values-dev.yaml   # Swap or override for multi-environment GitOps
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
