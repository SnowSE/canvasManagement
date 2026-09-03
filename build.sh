#!/bin/bash
set -e

# Docker Hub namespace (org or user) the images are pushed to.
# Login (DOCKERHUB_USERNAME/DOCKERHUB_TOKEN secrets) uses your personal account, which must have push access to this org.
DOCKERHUB_ORG="snowcollege"
MAJOR_VERSION="4"
MINOR_VERSION="0"
VERSION="$MAJOR_VERSION.$MINOR_VERSION"

# Baked into the image so the running app can tell users when a newer image
# has been published (see src/features/local/version). CI sets GIT_SHA from
# github.sha; local builds fall back to the checked-out commit.
GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo "")}"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

TAG_FLAG=false
PUSH_FLAG=false

while getopts ":tp" opt; do
  case ${opt} in
    t)
      TAG_FLAG=true
      ;;
    p)
      PUSH_FLAG=true
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      echo "Usage: $0 [-t] [-p]"
      exit 1
      ;;
  esac
done


docker build \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg IMAGE_REPO="$DOCKERHUB_ORG/canvas_management" \
  --build-arg IMAGE_TAG="$MAJOR_VERSION" \
  -t canvas_management:$VERSION .


if [ "$TAG_FLAG" = true ]; then
  echo "Tagging images..."
  echo "$DOCKERHUB_ORG/canvas_management:$VERSION"
  echo "$DOCKERHUB_ORG/canvas_management:$MAJOR_VERSION"
  echo "$DOCKERHUB_ORG/canvas_management:latest"

  docker image tag canvas_management:"$VERSION" $DOCKERHUB_ORG/canvas_management:"$VERSION"
  docker image tag canvas_management:"$VERSION" $DOCKERHUB_ORG/canvas_management:"$MAJOR_VERSION"
  docker image tag canvas_management:"$VERSION" $DOCKERHUB_ORG/canvas_management:latest
fi

if [ "$PUSH_FLAG" = true ]; then
  echo "Pushing images..."
  echo "$DOCKERHUB_ORG/canvas_management:$VERSION"
  echo "$DOCKERHUB_ORG/canvas_management:$MAJOR_VERSION"
  echo "$DOCKERHUB_ORG/canvas_management:latest"

  docker push -q $DOCKERHUB_ORG/canvas_management:"$VERSION"
  docker push -q $DOCKERHUB_ORG/canvas_management:"$MAJOR_VERSION"
  docker push -q $DOCKERHUB_ORG/canvas_management:latest
fi

if [ "$TAG_FLAG" = false ] && [ "$PUSH_FLAG" = false ]; then
  echo ""
  echo "Build complete."
  echo "To tag, run with -t flag."
  echo "To push, run with -p flag."
  echo "Or manually run:"
  echo ""
  echo "docker image tag canvas_management:$VERSION $DOCKERHUB_ORG/canvas_management:$VERSION"
  echo "docker image tag canvas_management:$VERSION $DOCKERHUB_ORG/canvas_management:$MAJOR_VERSION"
  echo "docker image tag canvas_management:latest $DOCKERHUB_ORG/canvas_management:latest"
  echo "docker push -q $DOCKERHUB_ORG/canvas_management:$VERSION"
  echo "docker push -q $DOCKERHUB_ORG/canvas_management:$MAJOR_VERSION"
  echo "docker push -q $DOCKERHUB_ORG/canvas_management:latest"
fi
