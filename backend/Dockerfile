FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY prisma ./prisma
COPY src ./src
# `npm run build` runs scripts/fix-prisma-esm-imports.cjs after tsc, so the
# scripts directory must be present in the build stage.
COPY scripts ./scripts
COPY tsconfig.json prisma.config.ts ./
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY prisma ./prisma
COPY prisma.config.ts ./
# Owned by the runtime user so file logging works when enabled; the logger also
# degrades to console-only if this is ever read-only.
RUN mkdir -p /app/logs && chown -R app:app /app/logs
USER app
EXPOSE 3000
CMD ["node", "--experimental-specifier-resolution=node", "dist/server.js"]
