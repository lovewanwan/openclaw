#!/usr/bin/env node

/**
 * API Gateway 快速验证脚本
 * 手动测试所有关键接口
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3099';
const API_KEY = process.env.API_KEY || 'testkey';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${colors.cyan}▶ ${name}${colors.reset}`);
}

function logSuccess(message) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`  ℹ ${message}`, 'blue');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test1_HealthCheck() {
  logTest('测试 1: 健康检查');

  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();

    if (res.status === 200 && data.status === 'ok') {
      logSuccess('健康检查通过');
      return true;
    } else {
      logError(`状态码: ${res.status}, 响应: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`请求失败: ${error.message}`);
    return false;
  }
}

async function test2_AuthFailure() {
  logTest('测试 2: 认证失败 (401)');

  try {
    const res = await fetch(`${API_BASE}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: 'test' })
    });
    const data = await res.json();

    if (res.status === 401 && data.code === 'INVALID_API_KEY') {
      logSuccess('正确返回 401 和错误码');
      return true;
    } else {
      logError(`状态码: ${res.status}, 响应: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`请求失败: ${error.message}`);
    return false;
  }
}

async function test3_InvalidRequest() {
  logTest('测试 3: 无效请求 (400)');

  try {
    const res = await fetch(`${API_BASE}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({})
    });
    const data = await res.json();

    if (res.status === 400 && data.code === 'INVALID_REQUEST') {
      logSuccess('正确返回 400 和错误码');
      return true;
    } else {
      logError(`状态码: ${res.status}, 响应: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`请求失败: ${error.message}`);
    return false;
  }
}

async function test4_TaskNotFound() {
  logTest('测试 4: 任务不存在 (404)');

  try {
    const res = await fetch(`${API_BASE}/api/task/nonexistent-id/result`, {
      headers: { 'x-api-key': API_KEY }
    });
    const data = await res.json();

    if (res.status === 404 && data.code === 'TASK_NOT_FOUND') {
      logSuccess('正确返回 404 和错误码');
      return true;
    } else {
      logError(`状态码: ${res.status}, 响应: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`请求失败: ${error.message}`);
    return false;
  }
}

async function test5_SyncAgent() {
  logTest('测试 5: 同步 Agent 执行');

  try {
    logInfo('发送请求...');
    const res = await fetch(`${API_BASE}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        goal: '返回固定文本：hello,world'
      })
    });
    const data = await res.json();

    if (res.status === 200 && data.success === true) {
      if (data.data && typeof data.data.result === 'string' && typeof data.data.steps === 'number') {
        logSuccess(`执行成功: result="${data.data.result.substring(0, 50)}...", steps=${data.data.steps}`);
        return true;
      } else {
        logError(`响应格式错误: ${JSON.stringify(data)}`);
        return false;
      }
    } else {
      logError(`状态码: ${res.status}, 响应: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`请求失败: ${error.message}`);
    return false;
  }
}

async function test6_AsyncAgent() {
  logTest('测试 6: 异步 Agent 执行');

  try {
    // 提交异步任务
    logInfo('提交异步任务...');
    const submitRes = await fetch(`${API_BASE}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        goal: '返回固定文本：async test',
        async: true
      })
    });
    const submitData = await submitRes.json();

    if (submitRes.status !== 202 || !submitData.taskId) {
      logError(`提交失败: ${JSON.stringify(submitData)}`);
      return false;
    }

    const taskId = submitData.taskId;
    logSuccess(`任务已提交: ${taskId}`);

    // 轮询任务状态
    logInfo('等待任务完成...');
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await sleep(1000);

      const resultRes = await fetch(`${API_BASE}/api/task/${taskId}/result`, {
        headers: { 'x-api-key': API_KEY }
      });
      const resultData = await resultRes.json();

      if (resultRes.status === 200 && resultData.status === 'completed') {
        logSuccess(`任务完成: result="${resultData.data.result.substring(0, 50)}...", steps=${resultData.data.steps}`);
        return true;
      } else if (resultRes.status === 500 && resultData.status === 'failed') {
        logError(`任务失败: ${resultData.error}`);
        return false;
      }

      attempts++;
      if (attempts % 5 === 0) {
        logInfo(`轮询中... (${attempts}/${maxAttempts})`);
      }
    }

    logError('任务超时');
    return false;
  } catch (error) {
    logError(`请求失败: ${error.message}`);
    return false;
  }
}

async function test7_SkillNotFound() {
  logTest('测试 7: Skill 不存在 (404)');

  try {
    const res = await fetch(`${API_BASE}/api/skills/nonexistent-skill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ params: {} })
    });
    const data = await res.json();

    if (res.status === 404 && data.code === 'SKILL_NOT_FOUND') {
      logSuccess('正确返回 404 和错误码');
      return true;
    } else {
      logError(`状态码: ${res.status}, 响应: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    logError(`请求失败: ${error.message}`);
    return false;
  }
}

async function test8_StreamAgent() {
  logTest('测试 8: 流式 Agent (SSE)');

  try {
    const res = await fetch(`${API_BASE}/api/stream/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        goal: '返回固定文本：stream test'
      })
    });

    const contentType = res.headers.get('content-type');
    const cacheControl = res.headers.get('cache-control');

    if (contentType === 'text/event-stream' && cacheControl === 'no-cache') {
      logSuccess('SSE 响应头正确');
      logInfo('注意: 流式响应需要客户端支持，此处仅验证响应头');
      return true;
    } else {
      logError(`Content-Type: ${contentType}, Cache-Control: ${cacheControl}`);
      return false;
    }
  } catch (error) {
    logError(`请求失败: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  log('\n========================================', 'cyan');
  log('  API Gateway 快速验证', 'cyan');
  log('========================================', 'cyan');
  log(`\n配置:`);
  log(`  API_BASE: ${API_BASE}`);
  log(`  API_KEY: ${API_KEY}\n`);

  const tests = [
    test1_HealthCheck,
    test2_AuthFailure,
    test3_InvalidRequest,
    test4_TaskNotFound,
    test5_SyncAgent,
    test6_AsyncAgent,
    test7_SkillNotFound,
    test8_StreamAgent
  ];

  const results = [];

  for (const test of tests) {
    try {
      const passed = await test();
      results.push({ name: test.name, passed });
    } catch (error) {
      log(`\n  ✗ 测试异常: ${error.message}`, 'red');
      results.push({ name: test.name, passed: false });
    }
  }

  // 总结
  log('\n========================================', 'cyan');
  log('  测试总结', 'cyan');
  log('========================================', 'cyan');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  log(`\n通过: ${passed}/${total}\n`);

  results.forEach(r => {
    const icon = r.passed ? '✓' : '✗';
    const color = r.passed ? 'green' : 'red';
    log(`  ${icon} ${r.name}`, color);
  });

  log('');

  if (passed === total) {
    log('🎉 所有测试通过！', 'green');
    process.exit(0);
  } else {
    log('❌ 部分测试失败', 'red');
    process.exit(1);
  }
}

// 运行测试
runAllTests().catch(error => {
  log(`\n致命错误: ${error.message}`, 'red');
  process.exit(1);
});
