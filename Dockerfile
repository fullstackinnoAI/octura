FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist
COPY public ./public

RUN chmod +x /app/dist/cli.js && ln -s /app/dist/cli.js /usr/local/bin/octura

USER node
EXPOSE 3000

CMD ["node", "dist/server.js"]
