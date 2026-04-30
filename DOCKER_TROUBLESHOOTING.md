# API Gateway Docker 故障排查指南

## 问题现象

```bash
curl http://localhost:3099/health
# 错误: curl: (56) Recv failure: Connection reset by peer
```

## 诊断步骤

### 1. 检查容器日志

```bash
docker logs openclaw-api
```

查找以下关键信息：
- `[api-gateway] listening on port 3099` - 服务是否成功启动
- 插件加载错误
- TypeScript 编译错误
- 端口绑定错误

### 2. 检查容器内进程

```bash
docker exec openclaw-api ps aux | grep node
```

确认 OpenClaw 进程是否在运行。

### 3. 检查端口监听

```bash
docker exec openclaw-api netstat -tlnp | grep 3099
```

或

```bash
docker exec openclaw-api lsof -i :3099
```

### 4. 检查插件编译产物

```bash
# 检查 dist 目录是否包含编译后的 api-gateway
docker exec openclaw-api ls -la /app/dist/extensions/api-gateway/

# 检查主入口文件
docker exec openclaw-api cat /app/dist/extensions/api-gateway/index.js
```

### 5. 检查插件配置

```bash
# 查看容器内的插件清单
docker exec openclaw-api cat /app/extensions/api-gateway/openclaw.plugin.json

# 检查 OpenClaw 配置
docker exec openclaw-api cat /root/.openclaw/config.json 2>/dev/null || echo "Config not found"
```

## 常见问题和解决方案

### 问题 1: 插件未启用

**症状**: 日志中没有 `[api-gateway]` 相关信息

**解决方案**: 创建配置文件启用插件

```bash
# 方法 1: 通过环境变量启用（推荐）
docker run -d --name openclaw-api \
  -p 3099:3099 \
  -e API_GATEWAY_KEY=testkey \
  -e API_GATEWAY_PORT=3099 \
  -e OPENCLAW_PLUGINS_API_GATEWAY_ENABLED=true \
  openclaw-api:latest

# 方法 2: 挂载配置文件
cat > openclaw-config.json <<EOF
{
  "plugins": {
    "entries": {
      "api-gateway": {
        "enabled": true
      }
    }
  }
}
EOF

docker run -d --name openclaw-api \
  -p 3099:3099 \
  -e API_GATEWAY_KEY=testkey \
  -e API_GATEWAY_PORT=3099 \
  -v $(pwd)/openclaw-config.json:/root/.openclaw/config.json \
  openclaw-api:latest
```

### 问题 2: 端口绑定到 127.0.0.1

**症状**: 容器内可以访问，但宿主机无法访问

**原因**: Express 默认绑定到 localhost，Docker 桥接网络无法访问

**解决方案**: 修改 `server.ts` 绑定到 `0.0.0.0`

编辑 `extensions/api-gateway/server.ts`，在 `app.listen` 调用中指定 host：

```typescript
const port = resolvePort();
await new Promise<void>((resolve, reject) => {
  const srv = app.listen(port, '0.0.0.0', () => {  // 添加 '0.0.0.0'
    server = srv;
    resolve();
  });
  srv.once("error", reject);
});
```

然后重新构建镜像：

```bash
docker build -t openclaw-api:latest .
docker stop openclaw-api && docker rm openclaw-api
docker run -d --name openclaw-api -p 3099:3099 \
  -e API_GATEWAY_KEY=testkey \
  openclaw-api:latest
```

### 问题 3: 插件编译失败

**症状**: `dist/extensions/api-gateway/` 目录不存在或为空

**解决方案**: 检查 TypeScript 编译错误

```bash
# 在宿主机上手动编译测试
cd extensions/api-gateway
npx tsc --noEmit

# 如果有错误，修复后重新构建 Docker 镜像
```

### 问题 4: 依赖缺失

**症状**: 日志显示 `Cannot find module 'express-rate-limit'` 或 `ip-range-check`

**解决方案**: 使用 `OPENCLAW_EXTENSIONS` 构建参数

```bash
docker build --build-arg OPENCLAW_EXTENSIONS="api-gateway" -t openclaw-api:latest .
```

### 问题 5: OpenClaw 默认命令不加载插件

**症状**: 容器启动但插件未加载

**解决方案**: 覆盖容器启动命令

```bash
docker run -d --name openclaw-api \
  -p 3099:3099 \
  -e API_GATEWAY_KEY=testkey \
  openclaw-api:latest \
  node openclaw.mjs gateway --allow-unconfigured --plugins api-gateway
```

## 完整的启动命令示例

```bash
# 停止并删除旧容器
docker stop openclaw-api 2>/dev/null || true
docker rm openclaw-api 2>/dev/null || true

# 启动新容器
docker run -d \
  --name openclaw-api \
  -p 3099:3099 \
  -e API_GATEWAY_KEY=testkey \
  -e API_GATEWAY_PORT=3099 \
  -e CORS_ORIGIN="*" \
  -e OPENCLAW_PLUGINS_API_GATEWAY_ENABLED=true \
  openclaw-api:latest

# 等待启动
sleep 5

# 查看日志
docker logs openclaw-api

# 测试健康检查
curl http://localhost:3099/health
```

## 调试模式启动

如果需要进入容器调试：

```bash
# 交互式启动
docker run -it --rm \
  -p 3099:3099 \
  -e API_GATEWAY_KEY=testkey \
  openclaw-api:latest \
  /bin/bash

# 在容器内手动启动
node openclaw.mjs gateway --allow-unconfigured
```

## 验证插件加载

成功启动后，日志应包含：

```
[api-gateway] listening on port 3099
```

测试端点：

```bash
# 健康检查（无需认证）
curl http://localhost:3099/health
# 预期: {"status":"ok"}

# 认证测试（需要 API key）
curl -X POST http://localhost:3099/api/skills/test \
  -H "Content-Type: application/json" \
  -H "x-api-key: testkey" \
  -d '{"params":{}}'
# 预期: 404 或 500（skill 不存在，但认证通过）
```
