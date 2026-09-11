#!/usr/bin/env sh
# Build the image and push it to Docker Hub.
#
# Usage:
#   DOCKERHUB_TOKEN=<pat> sh scripts/docker-publish.sh [tag]
#
# `tag` defaults to the version in package.json. `latest` is always pushed too.
# Never hardcode the token here — pass it through the environment.
set -eu

IMAGE="${IMAGE:-huydepzai12345/setting_api}"
USERNAME="${DOCKERHUB_USERNAME:-huydepzai12345}"
TAG="${1:-$(node -p "require('./package.json').version")}"

if [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  printf '%s' "$DOCKERHUB_TOKEN" | docker login -u "$USERNAME" --password-stdin
fi

docker build -t "$IMAGE:$TAG" -t "$IMAGE:latest" .
docker push "$IMAGE:$TAG"
docker push "$IMAGE:latest"

echo "Pushed $IMAGE:$TAG and $IMAGE:latest"
