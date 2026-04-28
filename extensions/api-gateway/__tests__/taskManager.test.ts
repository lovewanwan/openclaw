import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTask,
  createTaskId,
  getTask,
  markTaskRunning,
  markTaskDone,
  markTaskError,
  cleanupAllTasks,
  type TaskEntry,
} from "../services/taskManager.js";

describe("taskManager", () => {
  const mockLogger = {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanupAllTasks(mockLogger);
    vi.useRealTimers();
  });

  it("should create task with unique ID", () => {
    const task1 = createTask();
    const task2 = createTask();

    expect(task1.id).toBeTruthy();
    expect(task2.id).toBeTruthy();
    expect(task1.id).not.toBe(task2.id);
    expect(task1.status).toBe("pending");
    expect(task1.controller).toBeInstanceOf(AbortController);
  });

  it("should retrieve task by ID", () => {
    const task = createTask();
    const retrieved = getTask(task.id);

    expect(retrieved).toBe(task);
    expect(getTask("nonexistent")).toBeUndefined();
  });

  it("should mark task as running", () => {
    const task = createTask();
    markTaskRunning(task.id);

    expect(task.status).toBe("running");
  });

  it("should mark task as done and schedule cleanup", () => {
    const task = createTask();
    const result = { data: "test" };
    const ttl = 1000;

    markTaskDone(task.id, result, ttl);

    expect(task.status).toBe("done");
    expect(task.result).toBe(result);
    expect(task.cleanupTimer).toBeDefined();

    vi.advanceTimersByTime(ttl);
    expect(getTask(task.id)).toBeUndefined();
  });

  it("should mark task as error and schedule cleanup", () => {
    const task = createTask();
    const error = "test error";
    const ttl = 1000;

    markTaskError(task.id, error, ttl);

    expect(task.status).toBe("error");
    expect(task.error).toBe(error);
    expect(task.cleanupTimer).toBeDefined();

    vi.advanceTimersByTime(ttl);
    expect(getTask(task.id)).toBeUndefined();
  });

  it("should abort running tasks on cleanup", () => {
    const task1 = createTask();
    const task2 = createTask();
    markTaskRunning(task1.id);
    markTaskDone(task2.id, {}, 5000);

    const abortSpy1 = vi.spyOn(task1.controller, "abort");
    const abortSpy2 = vi.spyOn(task2.controller, "abort");

    cleanupAllTasks(mockLogger);

    expect(abortSpy1).toHaveBeenCalled();
    expect(abortSpy2).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`aborted in-flight task ${task1.id}`),
    );
    expect(getTask(task1.id)).toBeUndefined();
    expect(getTask(task2.id)).toBeUndefined();
  });

  it("should replace cleanup timer when marking done multiple times", () => {
    const task = createTask();
    markTaskDone(task.id, { v: 1 }, 1000);
    const firstTimer = task.cleanupTimer;

    markTaskDone(task.id, { v: 2 }, 2000);
    const secondTimer = task.cleanupTimer;

    expect(secondTimer).not.toBe(firstTimer);
    expect(task.result).toEqual({ v: 2 });
  });
});
