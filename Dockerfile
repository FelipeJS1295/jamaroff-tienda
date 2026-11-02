# ─── Jamaroff · imagen de la tienda ────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r app && useradd -r -g app app && mkdir -p /app/uploads && chown app:app /app/uploads
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 3000
# Aplica migraciones pendientes y arranca
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && npx next start -p 3000"]
