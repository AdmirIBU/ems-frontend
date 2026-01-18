# Build the Vite app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
ENV \
	npm_config_fetch_retries=5 \
	npm_config_fetch_retry_mintimeout=20000 \
	npm_config_fetch_retry_maxtimeout=120000 \
	npm_config_network_timeout=600000

# Install devDependencies so `tsc` exists during the build
RUN --mount=type=cache,target=/root/.npm \
	npm ci --include=dev --no-audit --no-fund
COPY . .
RUN npm run build

# Serve with a tiny Node static server + reverse proxy
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
	PORT=80 \
	API_PROXY_TARGET=http://backend:5000

COPY --from=builder /app/dist ./dist
COPY server.mjs ./server.mjs
EXPOSE 80
CMD ["node", "server.mjs"]
