/**
 * Tests for enhanced streaming utilities
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  RollingContextWindow,
  AsyncQueue,
  withStreamTimeout,
  withMaxLength,
  bufferStream,
} from "../../src/memory/streamUtils";

describe("RollingContextWindow", () => {
  let window: RollingContextWindow;

  beforeEach(() => {
    window = new RollingContextWindow(100); // 100 char limit
  });

  it("should maintain rolling window within size limit", () => {
    window.add("A".repeat(50));
    window.add("B".repeat(50));
    
    expect(window.getSize()).toBeLessThanOrEqual(100);
  });

  it("should keep most recent content", () => {
    window.add("OLD");
    window.add("NEW".repeat(40)); // Exceeds limit

    const context = window.getContext();
    expect(context).toContain("NEW");
    expect(context).not.toContain("OLD");
  });

  it("should clear window", () => {
    window.add("Test");
    window.clear();
    
    expect(window.getSize()).toBe(0);
    expect(window.getContext()).toBe("");
  });
});

describe("AsyncQueue", () => {
  it("should enqueue and dequeue items", async () => {
    const queue = new AsyncQueue<string>();
    
    await queue.enqueue("item1");
    await queue.enqueue("item2");
    
    expect(queue.size()).toBe(2);
    expect(queue.dequeue()).toBe("item1");
    expect(queue.size()).toBe(1);
  });

  it("should process items automatically with processor", async () => {
    const processed: string[] = [];
    
    const queue = new AsyncQueue<string>(async (item) => {
      processed.push(item);
    });
    
    await queue.enqueue("item1");
    await queue.enqueue("item2");
    
    // Give processor time to run
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(processed.length).toBe(2);
    expect(queue.isEmpty()).toBe(true);
  });

  it("should clear queue", async () => {
    const queue = new AsyncQueue<string>();
    await queue.enqueue("item1");
    await queue.enqueue("item2");
    
    queue.clear();
    
    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);
  });
});

describe("withStreamTimeout", () => {
  it("should timeout slow streams", async () => {
    const slowStream = new ReadableStream({
      async start(controller) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        controller.enqueue("too late");
        controller.close();
      },
    });

    const timeoutStream = withStreamTimeout(slowStream, 500);
    const reader = timeoutStream.getReader();

    await expect(reader.read()).rejects.toThrow(/timeout/i);
  }, 3000);

  it("should not timeout fast streams", async () => {
    const fastStream = new ReadableStream({
      start(controller) {
        controller.enqueue("quick");
        controller.close();
      },
    });

    const timeoutStream = withStreamTimeout(fastStream, 1000);
    const reader = timeoutStream.getReader();

    const result = await reader.read();
    expect(result.value).toBe("quick");
    expect(result.done).toBe(false);
  });
});

describe("withMaxLength", () => {
  it("should reject streams exceeding max length", async () => {
    const longStream = new ReadableStream({
      start(controller) {
        controller.enqueue("A".repeat(500));
        controller.enqueue("B".repeat(500));
        controller.enqueue("C".repeat(500));
        controller.close();
      },
    });

    const limitedStream = withMaxLength(longStream, 1000);
    const reader = limitedStream.getReader();

    // Read until error
    let errored = false;
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch (error) {
      errored = true;
      expect((error as Error).message).toContain("exceeded max length");
    }

    expect(errored).toBe(true);
  });

  it("should allow streams within limit", async () => {
    const shortStream = new ReadableStream({
      start(controller) {
        controller.enqueue("Short");
        controller.close();
      },
    });

    const limitedStream = withMaxLength(shortStream, 1000);
    const reader = limitedStream.getReader();

    const result = await reader.read();
    expect(result.value).toBe("Short");
  });
});

describe("bufferStream", () => {
  it("should buffer chunks", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue("A");
        controller.enqueue("B");
        controller.enqueue("C");
        controller.enqueue("D");
        controller.close();
      },
    });

    const buffered = bufferStream(stream, 2);
    const reader = buffered.getReader();

    const batch1 = await reader.read();
    expect(batch1.value).toEqual(["A", "B"]);

    const batch2 = await reader.read();
    expect(batch2.value).toEqual(["C", "D"]);

    const done = await reader.read();
    expect(done.done).toBe(true);
  });

  it("should emit remaining items on stream end", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue("A");
        controller.enqueue("B");
        controller.enqueue("C"); // Only 3 items, buffer is 2
        controller.close();
      },
    });

    const buffered = bufferStream(stream, 2);
    const reader = buffered.getReader();

    await reader.read(); // ["A", "B"]
    const remaining = await reader.read(); // ["C"]
    
    expect(remaining.value).toEqual(["C"]);
  });
});
