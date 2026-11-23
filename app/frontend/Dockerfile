# Stage 1: Build static assets with Node.js
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# Stage 2: Serve with official unprivileged Nginx image (runs as non-root UID 101)
FROM nginxinc/nginx-unprivileged:1.27-alpine

ENV PORT=8080 \
    BACKEND_URL=http://backend:8080

# Copy built frontend assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy dynamic configuration template for envsubst
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
