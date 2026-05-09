#!/usr/bin/env node

const API_BASE = process.env.API_BASE || 'http://localhost:3099';
const API_KEY = process.env.API_KEY || 'testkey';

async function testHealthCheck() {
  console.log('\n=== 测试 1: 健康检查 ===');
  const res = await fetch(`${API_BASE}/health`);
  const data = await res.json();
  console.log(`状态码: ${res.status}`);
  console.log('响应:', data);
  return res.status === 200 && data.status === 'ok';
}

async function testAuthFailure() {
  console.log('\n=== 测试 2: 认证失败 (401) ===');
  const res = await fetch(`${API_BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: 'test' })
  });
  const data = await res.json();
  console.log(`状态码: ${res.status}`);
  console.log('响应:', data);
  return res.status === 401 && data.code === 'INVALID_API_KEY';
}

async function testInvalidRequest() {
  console.log('\n=== 测试 3: 无效请求 (400) ===');
  const res = await fetch(`${API_BASE}/api/agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({})
  });
  const data = await res.json();
  console.log(`状态码: ${res.status}`);
  console.log('响应:', data);
  return res.status === 400 && data.code === 'INVALID_REQUEST';
}

async function testTaskNotFound() {
  console.log('\n=== 测试 4: 任务不存在 (404) ===');
  const res = await fetch(`${API_BASE}/api/task/nonexistent/result`, {
    headers: { 'x-api-key': API_KEY }
  });
  const data = await res.json();
  console.log(`状态码: ${res.status}`);
  console.log('响应:', data);
  return res.status === 404 && data.code === 'TASK_NOT_FOUND';
}

async function testSyncAgent() {
  console.log('\n=== 测试 5: 同步 Agent ===');
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
  console.log(`状态码: ${res.status}`);
  console.log('响应:', JSON.stringify(data, null, 2));
  return res.status === 200 && data.success === true;
}

async function testAsyncAgent() {
  console.log('\n=== 测试 6: 异步 Agent ===');

  const submitRes = await fetch(`${API_BASE}/api/agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      goal: '返回固定文本：hello,world',
      async: true
    })
  });
  const submitData = await submitRes.json();
  console.log(`提交状态码: ${submitRes.status}`);
  console.log('提交响应:', submitData);

  if (submitRes.status !== 202 || !submitData.taskId) {
    return false;
  }

  const taskId = submitData.taskId;
  console.log(`\n等待任务完成 (taskId: ${taskId})...`);

  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const resultRes = await fetch(`${API_BASE}/api/task/${taskId}/result`, {
      headers: { 'x-api-key': API_KEY }
    });
    const resultData = await resultRes.json();

    console.log(`轮询 ${i + 1}: 状态=${resultData.status}`);

    if (resultData.status === 'completed') {
      console.log('任务完成!');
      console.log('结果:', JSON.stringify(resultData, null, 2));
      return true;
    }

    if (resultData.status === 'error') {
      console.log('任务失败:', resultData.error);
      return false;
    }
  }

  console.log('任务超时');
  return false;
}

async function testStreamAgent() {
  console.log('\n=== 测试 7: 流式 Agent ===');
  console.log('注意: 流式接口需要支持 SSE 的客户端');
  console.log('可以使用以下命令测试:');
  console.log(`curl -N -X POST ${API_BASE}/api/stream/agent \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "x-api-key: ${API_KEY}" \\`);
  console.log(`  -d '{"goal": "返回固定文本：hello,world"}'`);
  return true;
}

async function runTests() {
  console.log('OpenClaw API Gateway 测试');
  console.log('========================');
  console.log(`API Base: ${API_BASE}`);
  console.log(`API Key: ${API_KEY}`);

  const tests = [
    { name: '健康检查', fn: testHealthCheck },
    { name: '认证失败', fn: testAuthFailure },
    { name: '无效请求', fn: testInvalidRequest },
    { name: '任务不存在', fn: testTaskNotFound },
    { name: '同步Agent', fn: testSyncAgent },
    { name: '异步Agent', fn: testAsyncAgent },
    { name: '流式Agent', fn: testStreamAgent }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
      console.log(`\n✓ ${test.name}: ${passed ? '通过' : '失败'}`);
    } catch (error) {
      results.push({ name: test.name, passed: false, error });
      console.log(`\n✗ ${test.name}: 错误`);
      console.error(error.message);
    }
  }

  console.log('\n\n测试总结');
  console.log('========');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`通过: ${passed}/${total}`);

  results.forEach(r => {
    const icon = r.passed ? '✓' : '✗';
    console.log(`${icon} ${r.name}`);
  });

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(console.error);
