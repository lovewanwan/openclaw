#!/bin/bash

# OpenClaw API Gateway Docker 启动脚本

set -e

IMAGE_NAME="openclaw-api:latest"
CONTAINER_NAME="openclaw-api"
PORT=3099
API_KEY="${API_GATEWAY_KEY:-testkey}"

echo "==> Stopping existing container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "==> Starting OpenClaw API Gateway..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$PORT:$PORT" \
  -e API_GATEWAY_KEY="$API_KEY" \
  -e API_GATEWAY_PORT="$PORT" \
  -e API_GATEWAY_HOST="0.0.0.0" \
  -e CORS_ORIGIN="*" \
  "$IMAGE_NAME"

echo "==> Waiting for container to start..."
sleep 3

echo "==> Container logs:"
docker logs "$CONTAINER_NAME" 2>&1 | tail -20

echo ""
echo "==> Testing health endpoint..."
sleep 2

if curl -f -s http://localhost:$PORT/health > /dev/null 2>&1; then
  echo "✓ Health check passed!"
  curl http://localhost:$PORT/health
  echo ""
else
  echo "✗ Health check failed!"
  echo ""
  echo "Full logs:"
  docker logs "$CONTAINER_NAME"
  exit 1
fi

echo ""
echo "==> API Gateway is running!"
echo "    Container: $CONTAINER_NAME"
echo "    Port: $PORT"
echo "    API Key: $API_KEY"
echo ""
echo "Test commands:"
echo "  curl http://localhost:$PORT/health"
echo "  curl -X POST http://localhost:$PORT/api/agent -H 'x-api-key: $API_KEY' -H 'Content-Type: application/json' -d '{\"goal\":\"返回你好\"}'"
echo ""
echo "View logs:"
echo "  docker logs -f $CONTAINER_NAME"
echo ""
echo "Stop container:"
echo "  docker stop $CONTAINER_NAME"
