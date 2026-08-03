FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ARG PORT=5173
ARG BASE_PATH=/
ARG VITE_API_BASE_URL=

RUN corepack enable
RUN corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/escala-generator/package.json artifacts/escala-generator/package.json
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY scripts/package.json scripts/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN PORT=$PORT BASE_PATH=$BASE_PATH VITE_API_BASE_URL=$VITE_API_BASE_URL pnpm --filter @workspace/escala-generator run build

FROM nginx:1.29.3-alpine AS runtime

COPY artifacts/escala-generator/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/escala-generator/tmp/dist/public/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
