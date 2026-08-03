FROM node:22-alpine AS build

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable
RUN corepack prepare pnpm@10.33.2 --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
RUN pnpm deploy --filter @workspace/api-server --prod --legacy /prod/api-server

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /prod/api-server ./
COPY --from=build /app/artifacts/api-server/tmp/dist ./tmp/dist
COPY --from=build /app/assets ./assets

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./tmp/dist/index.mjs"]
