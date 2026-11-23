# Stage 1: Dependency builder
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Stage 2: Minimal non-root production image
FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=8080 \
    APP_VERSION=v1.0.0 \
    APP_ENV=local \
    THEME_COLOR=#2563eb \
    WELCOME_MESSAGE="Welcome to GitOps Playground!" \
    REDIS_HOST=redis \
    REDIS_PORT=6379

# Copy production node_modules from builder
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

# Use non-root node user provided by node:alpine image
USER node

EXPOSE 8080

CMD ["node", "src/index.js"]
