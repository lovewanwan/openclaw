# API Gateway 代码与文档一致性修复

## 修复内容

### 1. MCP 接口错误响应添加 code 字段

**文件**: `extensions/api-gateway/routes/mcp.ts`

**修改前**:
```typescript
res.status(504).json({ error: "MCP tool execution timed out" });
res.status(500).json({ error: msg });
```

**修改后**:
```typescript
res.status(504).json({ error: "MCP tool execution timed out", code: "TIMEOUT" });
res.status(404).json({ error: `MCP tool not found: ${serverName}/${toolName}`, code: "TOOL_NOT_FOUND" });
res.status(500).json({ error: msg, code: "INTERNAL_ERROR" });
```

---

### 2. Agent 同步响应格式调整

**文件**: `extensions/api-gateway/routes/agent.ts`

**文档要求**:
```json
{
  "success": true,
  "data": {
    "result": "Agent 最终输出的文本或结构化内容",
    "steps": 3
  }
}
```

**修改内容**:
1. 修改 `runAgent` 函数返回类型，添加 `steps` 字段
2. 统计 assistant 消息数量作为步骤数
3. 提取最后一条 assistant 消息的 content 作为 result
4. 同步和异步模式都使用统一的响应格式

**修改后代码**:
```typescript
// 提取结果文本
const resultText = lastAssistant
  ? ((lastAssistant as Record<string, unknown>)?.content as string) || JSON.stringify(lastAssistant)
  : "No result";

res.json({
  success: true,
  data: {
    result: resultText,
    steps: result.steps || 0
  }
});
```

---

### 3. 任务状态值标准化

**文件**: 
- `extensions/api-gateway/services/taskManager.ts`
- `extensions/api-gateway/routes/task.ts`

**文档要求**: `pending | running | completed | failed`

**修改前**: `pending | running | done | error`

**修改内容**:
1. TaskStatus 类型定义修改
2. `markTaskDone` 设置状态为 `completed`
3. `markTaskError` 设置状态为 `failed`
4. task.ts 路由判断 `failed` 状态

---

## 完整的 API 响应格式

### Skill 接口

**成功 (200)**:

```json
{
  "success": true,
  "data": { ... }
}
```

### MCP 接口

**成功 (200)**:
```json
{
  "success": true,
  "data": { ... }
}
```

**错误响应**:
- 404: {"error": "MCP tool not found: server/tool", "code": "TOOL_NOT_FOUND"}
- 500: {"error": "...", "code": "INTERNAL_ERROR"}
- 504: {"error": "MCP tool execution timed out", "code": "TIMEOUT"}

### Agent 接口

**同步成功 (200)**:
```json
{
  "success": true,
  "data": {
    "result": "执行结果文本",
    "steps": 3
  }
}
```

**异步接受 (202)**:
```json
{
  "taskId": "uuid"
}
```

### 任务查询接口

**状态查询**:
```json
{
  "taskId": "uuid",
  "status": "pending" | "running" | "completed" | "failed"
}
```

**结果查询 - 完成 (200)**:
```json
{
  "taskId": "uuid",
  "status": "completed",
  "data": {
    "result": "执行结果",
    "steps": 3
  }
}
```

**结果查询 - 失败 (500)**:
```json
{
  "taskId": "uuid",
  "status": "failed",
  "error": "错误描述"
}
```

---

## 测试验证

修改完成后，请运行以下测试：

```bash
# 1. 测试 MCP 接口
curl -X POST http://localhost:3099/api/mcp/filesystem/read_file \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{"params": {"path": "/nonexistent"}}'

# 2. 测试 Agent 同步
curl -X POST http://localhost:3099/api/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{"goal": "返回固定文本：hello,world"}'

# 3. 测试 Agent 异步
curl -X POST http://localhost:3099/api/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{"goal": "返回固定文本：hello,world", "async": true}'

# 4. 查询任务状态
curl http://localhost:3099/api/task/{taskId}/status \
  -H "x-api-key: your-key"

# 5. 查询任务结果
curl http://localhost:3099/api/task/{taskId}/result \
  -H "x-api-key: your-key"
```

---

## 部署步骤

```bash
# 1. 重新构建
cd openclaw
pnpm build

# 2. 重启服务
pnpm start
```

