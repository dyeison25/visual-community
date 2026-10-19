# Contexto: raíz del proyecto; únicamente backend/shared entran en la imagen.
FROM oven/bun:1.3.13 AS build
WORKDIR /app/Backend
COPY Backend/package.json Backend/bun.lock ./
RUN bun install --frozen-lockfile
COPY Backend/tsconfig.json Backend/index.ts ./
COPY Backend/src ./src
COPY shared /app/shared
RUN bun run build

FROM oven/bun:1.3.13 AS dependencies
WORKDIR /app/Backend
COPY Backend/package.json Backend/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.13 AS runtime
WORKDIR /app/Backend
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=dependencies --chown=bun:bun /app/Backend/node_modules ./node_modules
COPY --from=dependencies --chown=bun:bun /app/Backend/package.json ./package.json
COPY --from=build --chown=bun:bun /app/Backend/dist ./dist
USER bun
EXPOSE 8080
CMD ["bun", "dist/index.js"]
