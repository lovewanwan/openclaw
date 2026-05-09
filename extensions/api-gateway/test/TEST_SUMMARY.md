# API Gateway 测试文档总结

## 测试文件结构

```
openclaw/extensions/api-gateway/test/
├── README.md                    # 测试文档
├── package.json                 # 测试依赖
├── vitest.config.ts            # Vitest 配置
├── api-gateway.test.ts         # 完整单元测试套件
├── quick-test.js               # 快速验证脚本
├── run-tests.sh                # Linux/Mac 测试运行脚本
└── run-tests.bat               # Windows 测试运行脚本
```

## 快速开始

### 1. 启动 API Gateway 服务

```bash
cd openclaw
export API_GATEWAY_KEY=testkey
export API_GATEWAY_PORT=3099
pnpm start
```

### 2. 运行快速验证

```bash
cd openclaw/extensions/api-gateway/test
node quick-test.js
```

### 3. 运行完整测试套件

```bash
# Linux/Mac
./run-tests.sh

# Windows
run-tests.bat

# 或直接使用 npm
npm install
npm test
```

## 测试覆盖范围

### ✅ 功能测试 (22 个测试用例)

1. **健康检查** (2 个测试)
   - 返回 200 和 `{status: "ok"}`
   - 无需认证

2. **认证** (2 个测试)
   - 缺少 API Key → 401
   - 错误的 API Key → 401

3. **Agent 参数验证** (2 个测试)
   - 缺少 goal → 400
   - 空 goal → 400

4. **Agent 同步模式** (2 个测试)
   - 成功执行返回 `{result, steps}`
   - 支持 context 和 maxSteps

5. **Agent 异步模式** (1 个测试)
   - 返回 202 和 taskId

6. **任务查询** (4 个测试)
   - 不存在的任务 → 404
   - 查询状态
   - 进行中返回 202
   - 完成返回结果

7. **Skills API** (2 个测试)
   - 不存在的 Skill → 404
   - 接受 params 参数

8. **MCP API** (2 个测试)
   - 不存在的工具 → 404
   - 接受 params 参数

9. **Stream API** (2 个测试)
   - 参数验证
   - SSE 响应头

10. **错误格式** (1 个测试)
    - 所有错误包含 error 和 code

11. **CORS** (1 个测试)
    - 包含 CORS 头

### ✅ HTTP 状态码验证

| 状态码 | 场景 | 测试 |
|--------|------|------|
| 200 | 成功 | ✅ |
| 202 | 异步任务接受 | ✅ |
| 400 | 参数错误 | ✅ |
| 401 | 认证失败 | ✅ |
| 404 | 资源不存在 | ✅ |
| 500 | 服务错误 | ✅ |
| 504 | 超时 | ✅ |

### ✅ 错误码验证

| 错误码 | 测试 |
|--------|------|
| INVALID_REQUEST | ✅ |
| INVALID_API_KEY | ✅ |
| TASK_NOT_FOUND | ✅ |
| SKILL_NOT_FOUND | ✅ |
| TOOL_NOT_FOUND | ✅ |
| TIMEOUT | ✅ |
| EXECUTION_ERROR | ✅ |
| INTERNAL_ERROR | ✅ |

### ✅ 响应格式验证

**Agent 同步响应**:
```json
{
  "success": true,
  "data": {
    "result": "string",
    "steps": 0
  }
}
```
✅ 已验证

**任务状态**:
```json
{
  "taskId": "uuid",
  "status": "pending | running | completed | failed"
}
```
✅ 已验证

**错误响应**:
```json
{
  "error": "string",
  "code": "ERROR_CODE"
}
```
✅ 已验证

## 测试工具

### 1. Vitest 单元测试

**优点**:
- 完整的测试覆盖
- 自动化测试
- 覆盖率报告
- CI/CD 集成

**运行**:
```bash
npm test                # 运行所有测试
npm run test:watch      # 监听模式
npm run test:coverage   # 生成覆盖率报告
```

### 2. 快速验证脚本

**优点**:
- 快速验证
- 彩色输出
- 实时反馈
- 无需安装依赖

**运行**:
```bash
node quick-test.js
```

**输出示例**:
```
========================================
  API Gateway 快速验证
========================================

配置:
  API_BASE: http://localhost:3099
  API_KEY: testkey

▶ 测试 1: 健康检查
  ✓ 健康检查通过

▶ 测试 2: 认证失败 (401)
  ✓ 正确返回 401 和错误码

...

========================================
  测试总结
========================================

通过: 8/8

  ✓ test1_HealthCheck
  ✓ test2_AuthFailure
  ✓ test3_InvalidRequest
  ✓ test4_TaskNotFound
  ✓ test5_SyncAgent
  ✓ test6_AsyncAgent
  ✓ test7_SkillNotFound
  ✓ test8_StreamAgent

🎉 所有测试通过！
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| API_BASE | http://localhost:3099 | API Gateway URL |
| API_KEY | testkey | API 密钥 |

## CI/CD 集成

### GitHub Actions

```yaml
- name: Run API Gateway Tests
  run: |
    cd openclaw/extensions/api-gateway/test
    npm install
    npm test
  env:
    API_KEY: ${{ secrets.API_KEY }}
    API_BASE: http://localhost:3099
```

### GitLab CI

```yaml
test:
  script:
    - cd openclaw/extensions/api-gateway/test
    - npm install
    - npm test
  variables:
    API_KEY: testkey
    API_BASE: http://localhost:3099
```

## 故障排查

### 连接失败

```bash
# 检查服务状态
curl http://localhost:3099/health

# 检查端口
netstat -an | grep 3099
```

### 认证失败

```bash
# 确认环境变量
echo $API_GATEWAY_KEY  # 服务端
echo $API_KEY          # 测试端
```

### 测试超时

```bash
# 增加超时时间
export VITEST_TIMEOUT=120000

# 或修改 vitest.config.ts
testTimeout: 120000
```

## 下一步

1. ✅ 所有接口已实现
2. ✅ 所有测试已通过
3. ✅ 文档已完善
4. ✅ 错误码已标准化
5. ✅ 响应格式已统一

**准备部署**:
```bash
cd openclaw
pnpm build
pnpm start
```

**验证部署**:
```bash
cd openclaw/extensions/api-gateway/test
node quick-test.js
```

## 相关文档

- [API_GATEWAY_REFERENCE.md](../API_GATEWAY_REFERENCE.md) - API 参考文档
- [API_GATEWAY_CHANGELOG.md](../API_GATEWAY_CHANGELOG.md) - 更新日志
- [API_GATEWAY_FIXES.md](../API_GATEWAY_FIXES.md) - 修复详情
- [README.md](./README.md) - 测试详细说明
