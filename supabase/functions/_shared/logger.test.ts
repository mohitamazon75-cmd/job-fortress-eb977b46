/**
 * Tests for _shared/logger.ts — structured JSON logger.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createLogger } from "./logger.ts";

function captureConsole(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (msg: unknown) => lines.push(String(msg));
  console.error = (msg: unknown) => lines.push(String(msg));
  return {
    lines,
    restore: () => {
      console.log = origLog;
      console.error = origErr;
    },
  };
}

Deno.test("info log contains required fields", () => {
  const cap = captureConsole();
  try {
    const log = createLogger({ fn: "test-fn", requestId: "req-123" });
    log.info("hello", { scan_id: "abc" });
    assertEquals(cap.lines.length, 1);
    const parsed = JSON.parse(cap.lines[0]);
    assertEquals(parsed.fn, "test-fn");
    assertEquals(parsed.request_id, "req-123");
    assertEquals(parsed.event, "hello");
    assertEquals(parsed.level, "info");
    assertEquals(parsed.scan_id, "abc");
  } finally {
    cap.restore();
  }
});

Deno.test("error log normalises Error instances", () => {
  const cap = captureConsole();
  try {
    const log = createLogger({ fn: "test-fn" });
    log.error("boom", { stage: "x" }, new Error("kaboom"));
    const parsed = JSON.parse(cap.lines[0]);
    assertEquals(parsed.error.name, "Error");
    assertEquals(parsed.error.message, "kaboom");
    assertStringIncludes(parsed.error.stack, "kaboom");
  } finally {
    cap.restore();
  }
});

Deno.test("child logger inherits and extends base fields", () => {
  const cap = captureConsole();
  try {
    const log = createLogger({ fn: "test-fn", requestId: "r1" });
    const child = log.child({ stage: "agent2a" });
    child.info("started");
    const parsed = JSON.parse(cap.lines[0]);
    assertEquals(parsed.fn, "test-fn");
    assertEquals(parsed.request_id, "r1");
    assertEquals(parsed.stage, "agent2a");
  } finally {
    cap.restore();
  }
});

Deno.test("auto-generates request_id when omitted", () => {
  const log = createLogger({ fn: "test-fn" });
  // crypto.randomUUID format: 8-4-4-4-12 hex
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(log.requestId)) throw new Error(`bad uuid: ${log.requestId}`);
});
