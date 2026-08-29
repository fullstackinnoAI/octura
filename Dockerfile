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

RUN chmod +x /app/dist/octura-*.js
RUN ln -s /app/dist/octura-doctor.js /usr/local/bin/octura-doctor
RUN ln -s /app/dist/octura-demo-seed.js /usr/local/bin/octura-demo-seed
RUN ln -s /app/dist/octura-project-create.js /usr/local/bin/octura-project-create
RUN ln -s /app/dist/octura-project-list.js /usr/local/bin/octura-project-list
RUN ln -s /app/dist/octura-record-add.js /usr/local/bin/octura-record-add
RUN ln -s /app/dist/octura-record-list.js /usr/local/bin/octura-record-list
RUN ln -s /app/dist/octura-record-review.js /usr/local/bin/octura-record-review
RUN ln -s /app/dist/octura-spec-kit-import.js /usr/local/bin/octura-spec-kit-import

USER node
EXPOSE 3000

CMD ["node", "dist/server.js"]
