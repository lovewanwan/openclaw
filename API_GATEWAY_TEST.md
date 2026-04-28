# API Gateway 测试说明

## 启动服务

在启动 OpenClaw 之前，需要配置 api-gateway 插件并设置环境变量。

### 1. 配置插件

编辑 OpenClaw 配置文件（通常是 `~/.openclaw/config.json` 或项目根目录的配置文件），启用 api-gateway 插件：

```json
{
  "plugins": {
    "entries": {
      "api-gateway": {
        "enabled": true
      }
    }
  }
}
```

### 2. 设置环境变量

```bash
export API_GATEWAY_KEY=testkey
export API_GATEWAY_PORT=3099
```

Windows (PowerShell):
```powershell
$env:API_GATEWAY_KEY="testkey"
$env:API_GATEWAY_PORT="3099"
```

Windows (CMD):
```cmd
set API_GATEWAY_KEY=testkey
set API_GATEWAY_PORT=3099
```

### 3. 启动 OpenClaw

```bash
npm start
# 或
pnpm start
# 或根据项目的启动命令
```

### 4. 运行测试

在另一个终端窗口中：

```bash
node test-api-gateway.js
```

## 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `API_GATEWAY_PORT` | `3099` | 监听端口 |
| `API_GATEWAY_KEY` | 无（不鉴权） | API 密钥，用于 x-api-key 头验证 |
| `CORS_ORIGIN` | `*` | CORS 允许来源 |
| `API_GATEWAY_IP_WHITELIST` | 无（不限制） | IP 白名单，逗号分隔的 CIDR |
| `API_GATEWAY_RATE_LIMIT` | `60` | 每分钟每 IP 请求上限 |
| `AGENT_TIMEOUT_MS` | `300000` | Agent 执行超时（5分钟） |
| `TASK_TTL_MS` | `300000` | 异步任务结果保留时长（5分钟） |

## 测试场景

测试脚本会验证以下功能：

1. **健康检查** - `GET /health` 返回 200 和 `{ status: "ok" }`
2. **认证拦截** - 无 API key 访问受保护路由返回 401
3. **认证通过** - 带正确 API key 可以访问受保护路由
4. **同步 Agent** - `POST /api/agent` 同步执行并返回结果
5. **异步 Agent** - `POST /api/agent` 异步执行返回 taskId
6. **任务轮询** - 查询任务状态并获取最终结果

## 故障排查

### 连接失败

- 确认 OpenClaw 已启动且 api-gateway 插件已加载
- 检查端口 3099 是否被占用：`netstat -an | grep 3099` (Linux/Mac) 或 `netstat -an | findstr 3099` (Windows)
- 查看 OpenClaw 日志确认插件是否成功启动

### 认证失败

- 确认启动服务时设置了 `API_GATEWAY_KEY=testkey`
- 检查环境变量是否在服务启动前设置

### Agent 执行超时

- Agent 执行依赖 OpenClaw 的 subagent 运行时，确保相关配置正确
- 可以增加 `AGENT_TIMEOUT_MS` 环境变量的值
