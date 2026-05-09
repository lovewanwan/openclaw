# API Gateway 接口文档

## 基础信息

**Base URL**: `http://your-host:3099/api`

**认证方式**: 通过 `x-api-key` 请求头传递 API Key

## HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 202 | 异步任务已接受 |
| 400 | 请求参数错误 |
| 401 | API Key 缺失或不匹配 |
| 403 | IP 不在白名单中 |
| 404 | 资源不存在（Skill/工具/任务） |
| 429 | 请求频率超限 |
| 500 | 服务内部错误 |
| 504 | Agent 执行超时 |

## 错误响应格式

所有错误响应都包含以下字段：

```json
{
  "error": "错误描述",
  "code": "ERROR_CODE"
}
```

### 错误码列表

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| INVALID_REQUEST | 400 | 请求参数无效 |
| INVALID_API_KEY | 401 | API Key 无效 |
| IP_NOT_WHITELISTED | 403 | IP 地址不在白名单中 |
| TASK_NOT_FOUND | 404 | 任务不存在 |
| SKILL_NOT_FOUND | 404 | Skill 不存在 |
| RATE_LIMIT_EXCEEDED | 429 | 超过请求频率限制 |
| TASK_FAILED | 500 | 任务执行失败 |
| EXECUTION_ERROR | 500 | 执行错误 |
| INTERNAL_ERROR | 500 | 内部错误 |
| TIMEOUT | 504 | 执行超时 |

---

## 1. 健康检查

### GET /health

检查服务健康状态（无需认证）

**响应示例**:
```json
{
  "status": "ok"
}
```

---

## 2. Agent 接口

### POST /api/agent

执行 Agent 任务（同步或异步）

**请求头**:
```
Content-Type: application/json
x-api-key: your-api-key
```

**请求体**:
```json
{
  "goal": "任务目标描述",
  "context": "可选的上下文信息",
  "maxSteps": 10,
  "async": false
}
```

**参数说明**:
- goal (必填): 任务目标描述
- context (可选): 额外的上下文信息
- maxSteps (可选): 最大执行步骤数
- async (可选): 是否异步执行，默认 false


#### 同步执行响应

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "role": "assistant",
    "content": "执行结果..."
  }
}
```

**超时响应 (504)**:
```json
{
  "error": "Agent execution timed out",
  "code": "TIMEOUT"
}
```

#### 异步执行响应

**接受响应 (202)**:
```json
{
  "taskId": "uuid-task-id"
}
```

---

## 3. 流式 Agent 接口

### POST /api/stream/agent

执行 Agent 任务并实时返回流式响应（Server-Sent Events）

**请求体**: 同 /api/agent

**响应格式**: text/event-stream

**事件类型**:

1. start - 会话开始
2. run_started - Agent 开始执行
3. message - 新消息
4. complete - 执行完成
5. error - 执行错误

**示例**:
```bash
curl -N -X POST http://localhost:3099/api/stream/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"goal": "返回固定文本：hello,world"}'
```

---

## 4. 任务查询接口

### GET /api/task/:taskId/result

查询任务结果

**任务完成 (200)**:
```json
{
  "taskId": "uuid",
  "status": "completed",
  "data": { ... }
}
```

**任务进行中 (202)**:
```json
{
  "taskId": "uuid",
  "status": "pending"
}
```

**任务失败 (500)**:
```json
{
  "taskId": "uuid",
  "status": "error",
  "error": "错误描述",
  "code": "TASK_FAILED"
}
```

---

## 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| API_GATEWAY_PORT | 3099 | 监听端口 |
| API_GATEWAY_KEY | 无 | API 密钥 |
| API_GATEWAY_RATE_LIMIT | 60 | 每分钟请求上限 |
| AGENT_TIMEOUT_MS | 300000 | 执行超时(5分钟) |

