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
COPY scripts ./scripts

RUN chmod +x /app/dist/*.js && \
    for command in octura octura-record-prompt octura-project-create octura-project-list octura-project-show octura-capture-add octura-session-start octura-session-append octura-session-close octura-record-add octura-record-list octura-record-get octura-record-review octura-record-supersede octura-mcp octura-doctor octura-demo-seed; do \
      target="/app/dist/${command}.js"; \
      if [ "$command" = "octura" ]; then target="/app/dist/cli.js"; fi; \
      ln -s "$target" "/usr/local/bin/$command"; \
    done

USER node
EXPOSE 3000

CMD ["node", "dist/server.js"]
