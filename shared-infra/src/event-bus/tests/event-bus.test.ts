import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBusEngine } from "../core/event-bus-engine";

describe("EventBus Engine - Critical Edge Cases & Production Features", () => {
  let bus: EventBusEngine;

  beforeEach(() => {
    bus = new EventBusEngine({
      enableLogging: false,
      enableTracing: false,
      defaultListenerTimeoutMs: 500,
    });
  });

  it("Edge Case 1: Isolates listener errors so one throwing listener doesn't affect others", async () => {
    const fn1 = vi.fn().mockImplementation(() => {
      throw new Error("Listener 1 Crash");
    });
    const fn2 = vi.fn();

    bus.on("user.created", fn1, { maxRetries: 0 });
    bus.on("user.created", fn2);

    await bus.publish("user.created", { userId: "u123" });

    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
    expect(bus.getDLQ().getEntries().length).toBe(1);
  });

  it("Edge Case 2: Executes priority-ordered listeners in correct order", async () => {
    const order: string[] = [];

    bus.on("order.created", () => { order.push("low"); }, { priority: 10 });
    bus.on("order.created", () => { order.push("high"); }, { priority: 100 });
    bus.on("order.created", () => { order.push("medium"); }, { priority: 50 });

    await bus.publish("order.created", { orderId: "o1" });

    expect(order).toEqual(["high", "medium", "low"]);
  });

  it("Edge Case 3: Wildcard topic pattern matching (* and #)", async () => {
    const wildcardSingle = vi.fn();
    const wildcardMulti = vi.fn();

    bus.on("user.*", wildcardSingle);
    bus.on("auth.#", wildcardMulti);

    await bus.publish("user.created", { id: 1 });
    await bus.publish("auth.login.session.started", { session: "s1" });

    expect(wildcardSingle).toHaveBeenCalledOnce();
    expect(wildcardMulti).toHaveBeenCalledOnce();
  });

  it("Edge Case 4: Prevents infinite event cascade loops", async () => {
    const smallBus = new EventBusEngine({
      maxCascadeDepth: 3,
      enableLogging: false,
      enableTracing: false,
    });

    smallBus.on("ping", async () => { await smallBus.publish("pong", {}); });
    smallBus.on("pong", async () => { await smallBus.publish("ping", {}); });

    await smallBus.publish("ping", {});

    const dlq = smallBus.getDLQ().getEntries();
    expect(dlq.length).toBeGreaterThan(0);
    expect(String(dlq[0].error)).toMatch(/Maximum cascade depth 3 exceeded/);
  });

  it("Edge Case 5: Times out hanging listeners without blocking publish completion", async () => {
    const slowFn = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => setTimeout(resolve, 2000));
    });

    bus.on("slow.event", slowFn, { timeoutMs: 100, maxRetries: 0 });

    const start = Date.now();
    await bus.publish("slow.event", {});
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(bus.getDLQ().getEntries()[0]?.error).toContain("timed out after 100ms");
  });

  it("Edge Case 6: Automatically unsubscribes once() listeners after single execution", async () => {
    const fn = vi.fn();

    bus.once("single.event", fn);

    await bus.publish("single.event", { a: 1 });
    await bus.publish("single.event", { a: 2 });

    expect(fn).toHaveBeenCalledOnce();
    expect(bus.getListenersCount("single.event")).toBe(0);
  });

  it("Edge Case 7: Routes failed events to DLQ after retries", async () => {
    const failingFn = vi.fn().mockImplementation(() => {
      throw new Error("Persistent Failure");
    });

    bus.on("failing.event", failingFn, { maxRetries: 2, retryDelayMs: 10 });

    await bus.publish("failing.event", { test: true });

    expect(failingFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    const dlq = bus.getDLQ().getEntries();
    expect(dlq.length).toBe(1);
    expect(dlq[0]?.error).toBe("Persistent Failure");
  });

  it("Edge Case 8: Evaluates conditional filter predicate prior to listener execution", async () => {
    const fn = vi.fn();

    bus.on("data.updated", fn, {
      filter: (env) => (env.payload as any)?.role === "admin",
    });

    await bus.publish("data.updated", { role: "guest" });
    expect(fn).not.toHaveBeenCalled();

    await bus.publish("data.updated", { role: "admin" });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("Edge Case 9: Records event history in ring buffer", async () => {
    await bus.publish("event.1", { id: 1 });
    await bus.publish("event.2", { id: 2 });

    const history = bus.getHistory();
    expect(history.length).toBe(2);
    expect(history[0]?.headers.eventName).toBe("event.1");
    expect(history[1]?.headers.eventName).toBe("event.2");
  });

  it("Edge Case 10: Gracefully drains in-flight async listener promises", async () => {
    let completed = false;
    bus.on("async.task", async () => {
      await new Promise((r) => setTimeout(r, 50));
      completed = true;
    });

    bus.emit("async.task", {});
    expect(completed).toBe(false);

    await bus.drain();
    expect(completed).toBe(true);
  });
});
