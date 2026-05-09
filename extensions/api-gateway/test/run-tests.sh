#!/bin/bash

# API Gateway 测试运行脚本

set -e

echo "================================"
echo "API Gateway 测试套件"
echo "================================"
echo ""

# 检查环境变量
if [ -z "$API_KEY" ]; then
  echo "警告: API_KEY 环境变量未设置，使用默认值 'testkey'"
  export API_KEY="testkey"
fi

if [ -z "$API_BASE" ]; then
  echo "警告: API_BASE 环境变量未设置，使用默认值 'http://localhost:3099'"
  export API_BASE="http://localhost:3099"
fi

echo "测试配置:"
echo "  API_BASE: $API_BASE"
echo "  API_KEY: $API_KEY"
echo ""

# 检查服务是否运行
echo "检查 API Gateway 服务状态..."
if curl -s -f "$API_BASE/health" > /dev/null 2>&1; then
  echo "✓ API Gateway 服务正在运行"
else
  echo "✗ API Gateway 服务未运行"
  echo ""
  echo "请先启动 API Gateway 服务:"
  echo "  cd openclaw"
  echo "  export API_GATEWAY_KEY=$API_KEY"
  echo "  pnpm start"
  exit 1
fi

echo ""
echo "开始运行测试..."
echo "================================"
echo ""

# 进入测试目录
cd "$(dirname "$0")"

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
  echo "安装测试依赖..."
  npm install
  echo ""
fi

# 运行测试
npm test

echo ""
echo "================================"
echo "测试完成"
echo "================================"
