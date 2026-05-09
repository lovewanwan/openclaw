# API Gateway 单元测试

## 测试覆盖

本测试套件覆盖以下功能：

### 1. 健康检查
- ✅ 返回 200 状态码和 `{status: "ok"}`
- ✅ 无需认证即可访问

### 2. 认证测试
- ✅ 缺少 API Key 返回 401
- ✅ 错误的 API Key 返回 401
- ✅ 错误响应包含 `code: "INVALID_API_KEY"`

### 3. Agent API - 参数验证
- ✅ 缺少 goal 参数返回 400
- ✅ goal 为空字符串返回 400
- ✅ 错误响应包含 `code: "INVALID_REQUEST"`

### 4. Agent API - 同步模式
- ✅ 成功执行返回 200
- ✅ 响应格式：`{success: true, data: {result: string, steps: number}}`
- ✅ 支持 context 和 maxSteps 参数

### 5. Agent API - 异步模式
- ✅ 返回 202 和 taskId
- ✅ taskId 为非空字符串

### 6. 任务查询 API
- ✅ 不存在的任务返回 404
- ✅ 查询状态返回正确的状态值：`pending | running | completed | failed`
- ✅ 进行中的任务返回 202
- ✅ 完成的任务返回 200 和结果数据
- ✅ 失败的任务返回 500 和错误信息

### 7. Skills API
- ✅ 不存在的 Skill 返回 404
- ✅ 错误响应包含 `code: "SKILL_NOT_FOUND"`
- ✅ 接受 params 对象参数

### 8. MCP API
- ✅ 不存在的工具返回 404
- ✅ 错误响应包含 `code: "TOOL_NOT_FOUND"`
- ✅ 接受 params 对象参数

### 9. Stream API
- ✅ 缺少 goal 返回 400
- ✅ 返回正确的 SSE 响应头
- ✅ Content-Type: text/event-stream

### 10. 错误响应格式
- ✅ 所有错误响应包含 `error` 和 `code` 字段
- ✅ 错误码符合文档规范

### 11. CORS 支持
- ✅ 响应包含 CORS 头

---

## 运行测试

### 前置条件

1. **启动 API Gateway 服务**

```bash
# 设置环境变量
export API_GATEWAY_KEY=testkey
export API_GATEWAY_PORT=3099

# 启动服务
cd openclaw
pnpm start
```

2. **验证服务运行**

```bash
curl http://localhost:3099/health
# 应该返回: {"status":"ok"}
```

### 运行测试

#### Linux/Mac

```bash
cd openclaw/extensions/api-gateway/test

# 设置环境变量（可选）
export API_KEY=testkey
export API_BASE=http://localhost:3099

# 运行测试
chmod +x run-tests.sh
./run-tests.sh
```

#### Windows

```cmd
cd openclaw\extensions\api-gateway\test

REM 设置环境变量（可选）
set API_KEY=testkey
set API_BASE=http://localhost:3099

REM 运行测试
run-tests.bat
```

#### 直接使用 npm

```bash
cd openclaw/extensions/api-gateway/test

# 安装依赖
npm install

# 运行测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `API_BASE` | `http://localhost:3099` | API Gateway 基础 URL |
| `API_KEY` | `testkey` | API 密钥 |

---

## 测试输出示例

```
 ✓ Health Check (2)
   ✓ should return 200 and status ok
   ✓ should not require authentication

 ✓ Authentication (2)
   ✓ should return 401 when API key is missing
   ✓ should return 401 when API key is incorrect

 ✓ Agent API - Validation (2)
   ✓ should return 400 when goal is missing
   ✓ should return 400 when goal is empty string

 ✓ Agent API - Sync Mode (2)
   ✓ should execute agent synchronously and return result with steps
   ✓ should accept context and maxSteps parameters

 ✓ Agent API - Async Mode (1)
   ✓ should return 202 with taskId for async execution

 ✓ Task API (4)
   ✓ should return 404 for non-existent task
   ✓ should return task status
   ✓ should return 202 when task is still running
   ✓ should eventually return completed task result

 ✓ Skills API (2)
   ✓ should return 404 for non-existent skill
   ✓ should accept params object

 ✓ MCP API (2)
   ✓ should return 404 for non-existent MCP tool
   ✓ should accept params object

 ✓ Stream API (2)
   ✓ should return 400 when goal is missing
   ✓ should return SSE stream with correct headers

 ✓ Error Response Format (1)
   ✓ all errors should include error and code fields

 ✓ CORS Headers (1)
   ✓ should include CORS headers

Test Files  1 passed (1)
     Tests  22 passed (22)
  Start at  10:30:00
  Duration  45.23s
```

---

## 故障排查

### 测试失败：连接被拒绝

**问题**: `ECONNREFUSED`

**解决方案**:
1. 确认 API Gateway 服务正在运行
2. 检查端口是否正确（默认 3099）
3. 验证防火墙设置

```bash
# 检查服务状态
curl http://localhost:3099/health

# 检查端口占用
netstat -an | grep 3099  # Linux/Mac
netstat -an | findstr 3099  # Windows
```

### 测试失败：认证错误

**问题**: 所有测试返回 401

**解决方案**:
1. 确认启动服务时设置了 `API_GATEWAY_KEY`
2. 确认测试使用的 `API_KEY` 与服务配置一致

```bash
# 启动服务时
export API_GATEWAY_KEY=testkey

# 运行测试时
export API_KEY=testkey
```

### 测试超时

**问题**: Agent 测试超时

**解决方案**:
1. 增加测试超时时间（默认 60 秒）
2. 检查 Agent 执行是否正常
3. 查看服务日志

---

## 持续集成

### GitHub Actions 示例

```yaml
name: API Gateway Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd openclaw
          pnpm install
      
      - name: Start API Gateway
        run: |
          cd openclaw
          export API_GATEWAY_KEY=testkey
          pnpm start &
          sleep 10
      
      - name: Run tests
        run: |
          cd openclaw/extensions/api-gateway/test
          npm install
          npm test
        env:
          API_KEY: testkey
          API_BASE: http://localhost:3099
```

---

## 贡献

添加新测试时，请确保：

1. 测试名称清晰描述测试内容
2. 使用适当的断言验证响应
3. 包含正面和负面测试用例
4. 添加必要的超时设置
5. 更新本 README 文档

---

## 许可证

与 OpenClaw 项目相同
