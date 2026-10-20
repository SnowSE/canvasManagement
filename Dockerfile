# Pinned so that rebuilding a tag cannot silently change the package manager.
# An unpinned `npm install -g pnpm` floated 11 -> 12 between two rebuilds of
# tag 4, and pnpm 12 tightened a file mode in a way that broke startup for
# every container uid but node's -- see the chmod in the production stage.
# Override with --build-arg PNPM_VERSION=... to build against an older line.
ARG PNPM_VERSION=12.3.4

FROM node:22-alpine AS builder

WORKDIR /app

ENV CI=true
ENV pnpm_config_ignore_scripts=true

ARG PNPM_VERSION
RUN npm install -g pnpm@$PNPM_VERSION

COPY pnpm-lock.yaml ./
COPY package.json ./
COPY pnpm-workspace.yaml ./
RUN pnpm install --ignore-scripts
COPY . .

RUN mkdir -p storage
RUN rm -rf /app/storage/*
ENV NEXT_PUBLIC_ENABLE_FILE_SYNC=true
RUN pnpm generate:openapi
RUN pnpm run build

FROM golang:alpine AS gh-teacher-builder

RUN apk add --no-cache git
# classroom50's gh teacher cli, used for the Classroom 50 integration
ARG CLASSROOM50_REF=main
RUN git clone --depth 1 --branch ${CLASSROOM50_REF} \
  https://github.com/foundation50/classroom50.git /classroom50
WORKDIR /classroom50/cli/gh-teacher
RUN CGO_ENABLED=0 go build -o gh-teacher .

FROM node:22-alpine AS production

WORKDIR /app

# gh + the gh-teacher extension; authenticated via the GH_TOKEN env var at runtime
RUN apk add --no-cache github-cli git
COPY --chown=node:node --from=gh-teacher-builder /classroom50/cli/gh-teacher/gh-teacher \
  /home/node/.local/share/gh/extensions/gh-teacher/gh-teacher

# .output holds everything the app needs, the live file-change server
# included (bundled by vite.websocket.config.ts), so the image has no
# node_modules and no package manager: pulling an update stays small.
# The operator picks the uid, so that it can own the mounted storage volume.
COPY --chown=node:node --from=builder /app/.output ./.output
COPY --chown=node:node --from=builder /app/public ./public
RUN mkdir -p storage && chown node:node /app storage

# A uid other than node's has no passwd entry, so HOME falls back to an
# unwritable "/", and gh then looks for its extensions under /.local/share/gh
# instead of node's home: the Classroom 50 buttons silently do nothing. That
# tree is world-readable and gh only reads it -- GH_TOKEN supplies the auth.
ENV HOME=/home/node

# Build identity, passed in by build.sh / the deploy workflow. The app reads the
# env vars to know what it is running, and the update checker reads the labels
# off the published image on Docker Hub to see whether something newer exists.
# Last, since it changes on every build: the layers above stay the same.
ARG GIT_SHA=""
ARG BUILD_DATE=""
ARG IMAGE_REPO="snowcollege/canvas_management"
ARG IMAGE_TAG=""
ENV GIT_SHA=$GIT_SHA \
    BUILD_DATE=$BUILD_DATE \
    UPDATE_CHECK_IMAGE=$IMAGE_REPO \
    UPDATE_CHECK_TAG=$IMAGE_TAG
LABEL org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.source="https://github.com/SnowSE/canvasManagement"

CMD [ "node", "--import", "./.output/websocket/websocket-standalone.js", ".output/server/index.mjs" ]
