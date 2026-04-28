#!/usr/bin/env node

/**
 * API Gateway Integration Test Script
 *
 * Prerequisites:
 * 1. Start OpenClaw with api-gateway plugin enabled
 * 2. Set environment variable: API_GATEWAY_KEY=testkey
 * 3. Ensure the service is running on http://localhost:3099
 */

const http = require('http');

const BASE_URL = 'http://localhost:3099';
const API_KEY = 'testkey';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${colors.cyan}[TEST]${colors.reset} ${name}`);
}

function logPass(message) {
  log(`  ✓ ${message}`, colors.green);
}

function logFail(message) {
  log(`  ✗ ${message}`, colors.red);
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    if (options.body) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(options.body));
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body, headers: res.headers });
        } catch (err) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test1_HealthCheck() {
  logTest('1. Health Check (GET /health)');
  try {
    const res = await request('/health');
    if (res.status === 200 && res.body?.status === 'ok') {
      logPass(`Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
      return true;
    } else {
      logFail(`Expected 200 with { status: "ok" }, got ${res.status}: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (err) {
    logFail(`Request failed: ${err.message}`);
    return false;
  }
}

async function test2_AuthRequired() {
  logTest('2. Auth Required (POST /api/skills/test without x-api-key)');
  try {
    const res = await request('/api/skills/test', {
      method: 'POST',
      body: { params: {} },
    });
    if (res.status === 401) {
      logPass(`Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
      return true;
    } else {
      logFail(`Expected 401 Unauthorized, got ${res.status}: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (err) {
    logFail(`Request failed: ${err.message}`);
    return false;
  }
}

async function test3_AuthSuccess() {
  logTest('3. Auth Success (POST /api/skills/test with correct x-api-key)');
  try {
    const res = await request('/api/skills/test', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: { params: {} },
    });
    // Skill doesn't exist, so we expect 404 or 500, but NOT 401
    if (res.status !== 401) {
      logPass(`Auth passed. Status: ${res.status} (skill not found is expected)`);
      return true;
    } else {
      logFail(`Auth failed. Got 401: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (err) {
    logFail(`Request failed: ${err.message}`);
    return false;
  }
}

async function test4_AgentSync() {
  logTest('4. Agent Sync Execution (POST /api/agent with goal)');
  try {
    const res = await request('/api/agent', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: { goal: '返回文本你好' },
    });

    if (res.status === 200 && res.body?.success === true) {
      logPass(`Status: ${res.status}, Success: ${res.body.success}`);
      logPass(`Response data: ${JSON.stringify(res.body.data).substring(0, 100)}...`);
      return true;
    } else {
      logFail(`Expected 200 with success=true, got ${res.status}: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (err) {
    logFail(`Request failed: ${err.message}`);
    return false;
  }
}

async function test5_AgentAsync() {
  logTest('5. Agent Async Execution (POST /api/agent with async=true)');
  try {
    const res = await request('/api/agent', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
      body: { goal: '计算 1+1', async: true },
    });

    if (res.status === 202 && res.body?.taskId) {
      logPass(`Status: ${res.status}, TaskId: ${res.body.taskId}`);
      return res.body.taskId;
    } else {
      logFail(`Expected 202 with taskId, got ${res.status}: ${JSON.stringify(res.body)}`);
      return null;
    }
  } catch (err) {
    logFail(`Request failed: ${err.message}`);
    return null;
  }
}

async function test6_TaskPolling(taskId) {
  logTest('6. Task Status Polling and Result Retrieval');
  if (!taskId) {
    logFail('No taskId from previous test, skipping');
    return false;
  }

  try {
    // Poll status
    let attempts = 0;
    const maxAttempts = 30;
    let status = null;

    while (attempts < maxAttempts) {
      const res = await request(`/api/task/${taskId}/status`, {
        headers: { 'x-api-key': API_KEY },
      });

      if (res.status === 200) {
        status = res.body?.status;
        log(`  Polling attempt ${attempts + 1}: status = ${status}`, colors.yellow);

        if (status === 'done' || status === 'error') {
          break;
        }
      }

      await sleep(1000);
      attempts++;
    }

    if (status === 'done') {
      logPass(`Task completed after ${attempts + 1} attempts`);

      // Get result
      const resultRes = await request(`/api/task/${taskId}/result`, {
        headers: { 'x-api-key': API_KEY },
      });

      if (resultRes.status === 200 && resultRes.body?.data) {
        logPass(`Result retrieved: ${JSON.stringify(resultRes.body.data).substring(0, 100)}...`);
        return true;
      } else {
        logFail(`Failed to get result: ${resultRes.status} ${JSON.stringify(resultRes.body)}`);
        return false;
      }
    } else if (status === 'error') {
      logFail(`Task failed with error: ${status}`);
      return false;
    } else {
      logFail(`Task did not complete within ${maxAttempts} seconds`);
      return false;
    }
  } catch (err) {
    logFail(`Request failed: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     API Gateway Integration Test Suite                ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nTarget: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY}\n`);

  const results = [];

  results.push(await test1_HealthCheck());
  results.push(await test2_AuthRequired());
  results.push(await test3_AuthSuccess());
  results.push(await test4_AgentSync());

  const taskId = await test5_AgentAsync();
  results.push(taskId !== null);

  if (taskId) {
    results.push(await test6_TaskPolling(taskId));
  } else {
    results.push(false);
  }

  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`\n${colors.blue}╔════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║                    Test Summary                        ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════╝${colors.reset}`);

  if (passed === total) {
    log(`\n✓ All tests passed! (${passed}/${total})`, colors.green);
    process.exit(0);
  } else {
    log(`\n✗ Some tests failed. (${passed}/${total} passed)`, colors.red);
    process.exit(1);
  }
}

// Check if service is reachable
async function checkService() {
  try {
    await request('/health');
    return true;
  } catch (err) {
    log(`\n${colors.red}✗ Cannot connect to ${BASE_URL}${colors.reset}`, colors.red);
    log(`\nPlease ensure:`, colors.yellow);
    log(`  1. OpenClaw is running with api-gateway plugin enabled`);
    log(`  2. Environment variable API_GATEWAY_KEY=testkey is set`);
    log(`  3. The service is listening on port 3099\n`);
    log(`Start command example:`, colors.cyan);
    log(`  export API_GATEWAY_KEY=testkey`);
    log(`  npm start  # or your OpenClaw start command\n`);
    return false;
  }
}

(async () => {
  if (await checkService()) {
    await runTests();
  } else {
    process.exit(1);
  }
})();
