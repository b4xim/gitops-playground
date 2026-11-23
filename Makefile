# Makefile for gitops-playground

REGISTRY ?= localhost
BACKEND_IMAGE ?= $(REGISTRY)/gitops-playground-backend
FRONTEND_IMAGE ?= $(REGISTRY)/gitops-playground-frontend
VERSION ?= v1.0.0

.PHONY: help build run up down stop logs test tag-version push build-v1 build-v2 build-multiarch clean

help:
	@echo "Available targets:"
	@echo "  make build               Build frontend and backend Docker images ($(VERSION))"
	@echo "  make up (or run)         Start the full stack with docker-compose"
	@echo "  make down (or stop)      Stop docker-compose containers and networks"
	@echo "  make logs                Tail docker-compose logs across all containers"
	@echo "  make test                Run automated endpoint tests (healthz, readyz, info, visits)"
	@echo "  make build-v1            Build v1.0.0 images (Blue theme)"
	@echo "  make build-v2            Build v1.1.0 images (Emerald green theme, for upgrade testing)"
	@echo "  make tag-version         Tag built images with custom VERSION and REGISTRY"
	@echo "  make push                Push tagged images to REGISTRY"
	@echo "  make build-multiarch     Build multi-arch images (linux/amd64,linux/arm64) using buildx"
	@echo "  make clean               Remove compose containers, volumes, and dangling images"

build:
	@echo "==> Building Backend ($(VERSION))..."
	docker build -t $(BACKEND_IMAGE):$(VERSION) ./app/backend
	@echo "==> Building Frontend ($(VERSION))..."
	docker build -t $(FRONTEND_IMAGE):$(VERSION) ./app/frontend

build-v1:
	@echo "==> Building v1.0.0 (Theme: Blue #2563eb)..."
	docker build -t $(BACKEND_IMAGE):v1.0.0 ./app/backend
	docker build -t $(FRONTEND_IMAGE):v1.0.0 ./app/frontend

build-v2:
	@echo "==> Building v1.1.0 (Theme: Emerald #10b981)..."
	docker build -t $(BACKEND_IMAGE):v1.1.0 ./app/backend
	docker build -t $(FRONTEND_IMAGE):v1.1.0 ./app/frontend

build-multiarch:
	@echo "==> Building multi-arch images (linux/amd64,linux/arm64)..."
	docker buildx build --platform linux/amd64,linux/arm64 -t $(BACKEND_IMAGE):$(VERSION) ./app/backend
	docker buildx build --platform linux/amd64,linux/arm64 -t $(FRONTEND_IMAGE):$(VERSION) ./app/frontend

tag-version:
	@echo "==> Tagging images with version $(VERSION) for registry $(REGISTRY)..."
	docker tag $(BACKEND_IMAGE):v1.0.0 $(REGISTRY)/gitops-playground-backend:$(VERSION)
	docker tag $(FRONTEND_IMAGE):v1.0.0 $(REGISTRY)/gitops-playground-frontend:$(VERSION)

push:
	@echo "==> Pushing images to $(REGISTRY)..."
	docker push $(BACKEND_IMAGE):$(VERSION)
	docker push $(FRONTEND_IMAGE):$(VERSION)

up run:
	@echo "==> Starting GitOps Playground with docker-compose..."
	docker-compose up -d --build

down stop:
	@echo "==> Stopping GitOps Playground..."
	docker-compose down

logs:
	docker-compose logs -f

test:
	@echo "==> Testing Healthz (Liveness)..."
	@curl -s -f http://localhost:8081/healthz | jq . || curl -s http://localhost:8081/healthz
	@echo ""
	@echo "==> Testing Readyz (Readiness & Redis connectivity)..."
	@curl -s -f http://localhost:8081/readyz | jq . || curl -s http://localhost:8081/readyz
	@echo ""
	@echo "==> Testing Backend /api/info (via direct backend port 8081)..."
	@curl -s -f http://localhost:8081/api/info | jq . || curl -s http://localhost:8081/api/info
	@echo ""
	@echo "==> Testing Backend /api/visits (counter increment)..."
	@curl -s -f http://localhost:8081/api/visits | jq . || curl -s http://localhost:8081/api/visits
	@echo ""
	@echo "==> Testing Frontend Nginx proxy /api/info (via frontend port 8080)..."
	@curl -s -f http://localhost:8080/api/info | jq . || curl -s http://localhost:8080/api/info
	@echo ""
	@echo "==> Testing Frontend Web UI HTTP 200..."
	@curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/

clean:
	docker-compose down -v --remove-orphans
