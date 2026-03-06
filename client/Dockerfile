FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY scripts/ ./scripts/
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

RUN npm ci

COPY client/ ./client/
COPY shared/ ./shared/

ARG VITE_SERVER_URL=

RUN npm run build -w @tankes/shared && VITE_SERVER_URL="$VITE_SERVER_URL" npm run build -w @tankes/client

FROM nginx:1.27-alpine AS runtime

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80