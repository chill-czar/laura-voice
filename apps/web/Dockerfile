# Built from the monorepo root: docker build -f apps/web/Dockerfile .
# Not the primary local dev loop (that's `bun run dev`) — this is for
# `docker compose up --build` / a standalone deploy.
FROM oven/bun:1 AS build
WORKDIR /repo

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# have to arrive as build args (docker-compose passes them from the root .env).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL

COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd packages/db generate
RUN bun --cwd apps/web run next build

FROM oven/bun:1-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo

EXPOSE 3000
CMD ["bun", "--cwd", "apps/web", "run", "next", "start"]
