# Built from the monorepo root: docker build -f apps/api/Dockerfile .
# Not the primary local dev loop (that's `bun run dev` against docker-compose's
# postgres/redis) — this is for `docker compose up --build` / a standalone deploy.
FROM oven/bun:1 AS build
WORKDIR /repo

COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd packages/db generate
RUN bun run --cwd apps/api build

FROM oven/bun:1-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo

EXPOSE 4000
CMD ["bun", "run", "--cwd", "apps/api", "start"]
