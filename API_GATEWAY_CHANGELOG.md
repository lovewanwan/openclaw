# API Gateway 更新日志

## 改进内容

### 1. 任务状态返回优化

**修改文件**: `extensions/api-gateway/routes/task.ts`

- ✅ GET `/api/task/:taskId/result` 成功响应返回 `status: "completed"` 而不是 `"done"`
- ✅ 所有错误响应添加 `code` 字段用于错误识别

**示例**:
```json
{
  "taskId": "uuid",
  "status": "completed",
  "data": { ... }
}
```

---

### 2. 标准化 HTTP 状态码

**修改文件**: 
- `extensions/api-gateway/middleware/auth.ts`
- `extensions/api-gateway/middleware/ipWhitelist.ts`
- `extensions/api-gateway/middleware/rateLimiter.ts`
- `extensions/api-gateway/routes/agent.ts`
- `extensions/api-gateway/routes/skills.ts`
- `extensions/api-gateway/routes/task.ts`

#### 状态码映射

| 状态码 | 场景 | 错误码 |
|--------|------|--------|
| 400 | 请求参数错误 | INVALID_REQUEST |
| 401 | API Key 无效 | INVALID_API_KEY |
| 403 | IP 不在白名单 | IP_NOT_WHITELISTED |
| 404 | 资源不存在 | TASK_NOT_FOUND / SKILL_NOT_FOUND |
| 429 | 请求频率超限 | RATE_LIMIT_EXCEEDED |
| 500 | 服务内部错误 | INTERNAL_ERROR / EXECUTION_ERROR / TASK_FAILED |
| 504 | 执行超时 | TIMEOUT |

#### 错误响应格式

所有错误响应统一格式：
```json
{
  "error": "错误描述",
  "code": "ERROR_CODE"
}
```

---

### 3. 流式对话接口

**新增文件**: `extensions/api-gateway/routes/stream.ts`

**接口**: `POST /api/stream/agent`

**功能**:
- 使用 Server-Sent Events (SSE) 实时返回 Agent 执行过程
- 支持实时消息推送
- 自动处理客户端断开连接
- 支持超时控制

**事件类型**:
1. `start` - 会话开始
2. `run_started` - Agent 开始执行
3. `message` - 新消息（实时推送）
4. `complete` - 执行完成
5. `error` - 执行错误

**使用示例**:
```bash
curl -N -X POST http://localhost:3099/api/stream/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"goal": "返回固定文本：hello,world"}'
```

**响应示例**:
```
data: {"type":"start","sessionKey":"session-uuid"}

data: {"type":"run_started","runId":"run-uuid"}

data: {"type":"message","message":{"role":"assistant","content":"..."}}

data: {"type":"complete"}
data: [DONE]
```

---

### 4. 权限修复

**修改文件**: `src/gateway/server-plugins.ts`

**问题**: `runtime.subagent.deleteSession()` 调用 `sessions.delete` 方法时缺少 `operator.admin` 权限

**解决方案**: 在 `deleteSession` 方法中添加 `syntheticScopes: [ADMIN_SCOPE]`

```typescript
async deleteSession(params) {
  await dispatchGatewayMethod(
    "sessions.delete",
    {
      key: params.sessionKey,
      deleteTranscript: params.deleteTranscript ?? true,
    },
    {
      syntheticScopes: [ADMIN_SCOPE],  // 添加 admin scope
    },
  );
}
```

---

## 测试

### 运行测试脚本

```bash
# 设置环境变量
export API_KEY=your-api-key
export API_BASE=http://localhost:3099

# 运行测试
node test-api-gateway-enhanced.js
```

### 测试覆盖

1. ✅ 健康检查 (200)
2. ✅ 认证失败 (401)
3. ✅ 无效请求 (400)
4. ✅ 任务不存在 (404)
5. ✅ 同步 Agent 执行
6. ✅ 异步 Agent 执行
7. ✅ 流式 Agent 执行

---

## 部署

### 1. 重新构建

```bash
pnpm build
# 或
npm run build
```

### 2. 重启服务

```bash
# 停止现有服务
pkill -f openclaw

# 启动服务
pnpm start
# 或
npm start
```

### 3. 验证

```bash
# 健康检查
curl http://localhost:3099/health

# 测试 API
curl -X POST http://localhost:3099/api/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"goal": "返回固定文本：hello,world"}'
```

---

## 兼容性说明

### 破坏性变更

1. **任务状态返回值变更**
   - 旧: `status: "done"`
   - 新: `status: "completed"`
   - 影响: 客户端需要更新状态判断逻辑

### 向后兼容

1. **错误响应添加 code 字段**
   - 旧客户端仍可使用 `error` 字段
   - 新客户端可使用 `code` 字段进行精确错误处理

2. **HTTP 状态码优化**
   - 更符合 RESTful 标准
   - 客户端应根据状态码进行错误处理

---

## 文档

- [API_GATEWAY_REFERENCE.md](./API_GATEWAY_REFERENCE.md) - 完整 API 参考文档
- [API_GATEWAY_TEST.md](./API_GATEWAY_TEST.md) - 测试说明
- [test-api-gateway-enhanced.js](./test-api-gateway-enhanced.js) - 增强测试脚本
