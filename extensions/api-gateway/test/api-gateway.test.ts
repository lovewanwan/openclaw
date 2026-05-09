import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE = process.env.API_BASE || 'http://localhost:3099';
const API_KEY = process.env.API_KEY || 'testkey';

describe('API Gateway Tests', () => {
  describe('Health Check', () => {
    it('should return 200 and status ok', async () => {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ status: 'ok' });
    });

    it('should not require authentication', async () => {
      const res = await fetch(`${API_BASE}/health`);
      expect(res.status).toBe(200);
    });
  });

  describe('Authentication', () => {
    it('should return 401 when API key is missing', async () => {
      const res = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: 'test' })
      });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({
        error: 'Unauthorized',
        code: 'INVALID_API_KEY'
      });
    });

    it('should return 401 when API key is incorrect', async () => {
      const res = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'wrong-key'
        },
        body: JSON.stringify({ goal: 'test' })
      });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.code).toBe('INVALID_API_KEY');
    });
  });

  describe('Agent API - Validation', () => {
    it('should return 400 when goal is missing', async () => {
      const res = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({})
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toEqual({
        error: 'goal is required',
        code: 'INVALID_REQUEST'
      });
    });

    it('should return 400 when goal is empty string', async () => {
      const res = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({ goal: '   ' })
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe('INVALID_REQUEST');
    });
  });

  describe('Agent API - Sync Mode', () => {
    it('should execute agent synchronously and return result with steps', async () => {
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

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('result');
      expect(data.data).toHaveProperty('steps');
      expect(typeof data.data.result).toBe('string');
      expect(typeof data.data.steps).toBe('number');
      expect(data.data.steps).toBeGreaterThanOrEqual(0);
    }, 60000); // 60s timeout

    it('should accept context and maxSteps parameters', async () => {
      const res = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          goal: '返回固定文本：test',
          context: 'test context',
          maxSteps: 5
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    }, 60000);
  });

  describe('Agent API - Async Mode', () => {
    it('should return 202 with taskId for async execution', async () => {
      const res = await fetch(`${API_BASE}/api/agent`, {
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
      const data = await res.json();

      expect(res.status).toBe(202);
      expect(data).toHaveProperty('taskId');
      expect(typeof data.taskId).toBe('string');
      expect(data.taskId.length).toBeGreaterThan(0);
    });
  });

  describe('Task API', () => {
    let taskId: string;

    beforeAll(async () => {
      // Create an async task
      const res = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          goal: '返回固定文本：task test',
          async: true
        })
      });
      const data = await res.json();
      taskId = data.taskId;
    });

    it('should return 404 for non-existent task', async () => {
      const res = await fetch(`${API_BASE}/api/task/nonexistent-id/status`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data).toEqual({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    });

    it('should return task status', async () => {
      const res = await fetch(`${API_BASE}/api/task/${taskId}/status`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('taskId', taskId);
      expect(data).toHaveProperty('status');
      expect(['pending', 'running', 'completed', 'failed']).toContain(data.status);
    });

    it('should return 202 when task is still running', async () => {
      const res = await fetch(`${API_BASE}/api/task/${taskId}/result`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();

      if (res.status === 202) {
        expect(data).toHaveProperty('taskId', taskId);
        expect(['pending', 'running']).toContain(data.status);
      }
    });

    it('should eventually return completed task result', async () => {
      // Poll for completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const res = await fetch(`${API_BASE}/api/task/${taskId}/result`, {
          headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();

        if (res.status === 200 && data.status === 'completed') {
          expect(data).toHaveProperty('taskId', taskId);
          expect(data).toHaveProperty('status', 'completed');
          expect(data).toHaveProperty('data');
          expect(data.data).toHaveProperty('result');
          expect(data.data).toHaveProperty('steps');
          completed = true;
        } else if (res.status === 500 && data.status === 'failed') {
          expect(data).toHaveProperty('error');
          completed = true;
        }

        attempts++;
      }

      expect(completed).toBe(true);
    }, 60000);
  });

  describe('Skills API', () => {
    it('should return 404 for non-existent skill', async () => {
      const res = await fetch(`${API_BASE}/api/skills/nonexistent-skill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({ params: {} })
      });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'SKILL_NOT_FOUND');
    });

    it('should accept params object', async () => {
      const res = await fetch(`${API_BASE}/api/skills/test-skill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          params: { key: 'value' }
        })
      });

      // Will return 404 or 500 depending on whether skill exists
      expect([404, 500, 504]).toContain(res.status);
    });
  });

  describe('MCP API', () => {
    it('should return 404 for non-existent MCP tool', async () => {
      const res = await fetch(`${API_BASE}/api/mcp/nonexistent/tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({ params: {} })
      });
      const data = await res.json();

      expect([404, 500]).toContain(res.status);
      if (res.status === 404) {
        expect(data).toHaveProperty('code', 'TOOL_NOT_FOUND');
      }
    });

    it('should accept params object', async () => {
      const res = await fetch(`${API_BASE}/api/mcp/test-server/test-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          params: { key: 'value' }
        })
      });

      // Will return 404, 500, or 504 depending on whether tool exists
      expect([404, 500, 504]).toContain(res.status);
    });
  });

  describe('Stream API', () => {
    it('should return 400 when goal is missing', async () => {
      const res = await fetch(`${API_BASE}/api/stream/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({})
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toEqual({
        error: 'goal is required',
        code: 'INVALID_REQUEST'
      });
    });

    it('should return SSE stream with correct headers', async () => {
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

      expect(res.headers.get('content-type')).toBe('text/event-stream');
      expect(res.headers.get('cache-control')).toBe('no-cache');
      expect(res.headers.get('connection')).toBe('keep-alive');
    }, 10000);
  });

  describe('Error Response Format', () => {
    it('all errors should include error and code fields', async () => {
      const testCases = [
        {
          name: 'Missing API key',
          request: () => fetch(`${API_BASE}/api/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal: 'test' })
          }),
          expectedStatus: 401
        },
        {
          name: 'Invalid request',
          request: () => fetch(`${API_BASE}/api/agent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': API_KEY
            },
            body: JSON.stringify({})
          }),
          expectedStatus: 400
        },
        {
          name: 'Task not found',
          request: () => fetch(`${API_BASE}/api/task/nonexistent/result`, {
            headers: { 'x-api-key': API_KEY }
          }),
          expectedStatus: 404
        }
      ];

      for (const testCase of testCases) {
        const res = await testCase.request();
        const data = await res.json();

        expect(res.status).toBe(testCase.expectedStatus);
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('code');
        expect(typeof data.error).toBe('string');
        expect(typeof data.code).toBe('string');
      }
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const res = await fetch(`${API_BASE}/health`);

      expect(res.headers.has('access-control-allow-origin')).toBe(true);
      expect(res.headers.has('access-control-allow-methods')).toBe(true);
      expect(res.headers.has('access-control-allow-headers')).toBe(true);
    });
  });
});
