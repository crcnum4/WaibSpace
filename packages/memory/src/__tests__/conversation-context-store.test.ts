import { describe, it, expect, beforeEach } from "bun:test";
import { ConversationContextStore } from "../conversation-context-store";
import type { ConversationTurn } from "@waibspace/types";

function makeTurn(
  role: "user" | "assistant",
  content: string,
  timestamp = Date.now(),
): ConversationTurn {
  return { role, content, timestamp, traceId: `trace-${timestamp}` };
}

describe("ConversationContextStore", () => {
  let store: ConversationContextStore;

  beforeEach(() => {
    store = new ConversationContextStore({ maxTurns: 5 });
  });

  it("stores and retrieves turns for a session", () => {
    store.addTurn("s1", makeTurn("user", "Show me emails from Alice"));
    store.addTurn("s1", makeTurn("assistant", "Here are Alice's emails"));

    const history = store.getHistory("s1");
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe("Show me emails from Alice");
    expect(history[1].content).toBe("Here are Alice's emails");
  });

  it("returns empty array for unknown session", () => {
    expect(store.getHistory("nonexistent")).toEqual([]);
  });

  it("enforces sliding window (maxTurns)", () => {
    for (let i = 0; i < 8; i++) {
      store.addTurn("s1", makeTurn("user", `message ${i}`));
    }
    const history = store.getHistory("s1");
    expect(history).toHaveLength(5);
    expect(history[0].content).toBe("message 3");
    expect(history[4].content).toBe("message 7");
  });

  it("respects limit parameter on getHistory", () => {
    for (let i = 0; i < 5; i++) {
      store.addTurn("s1", makeTurn("user", `msg ${i}`));
    }
    const last2 = store.getHistory("s1", 2);
    expect(last2).toHaveLength(2);
    expect(last2[0].content).toBe("msg 3");
    expect(last2[1].content).toBe("msg 4");
  });

  it("isolates sessions", () => {
    store.addTurn("s1", makeTurn("user", "hello from s1"));
    store.addTurn("s2", makeTurn("user", "hello from s2"));

    expect(store.getHistory("s1")).toHaveLength(1);
    expect(store.getHistory("s2")).toHaveLength(1);
    expect(store.getHistory("s1")[0].content).toBe("hello from s1");
    expect(store.getHistory("s2")[0].content).toBe("hello from s2");
  });

  it("clears a session", () => {
    store.addTurn("s1", makeTurn("user", "test"));
    store.clearSession("s1");
    expect(store.getHistory("s1")).toEqual([]);
    expect(store.sessionCount()).toBe(0);
  });

  it("reports session count", () => {
    expect(store.sessionCount()).toBe(0);
    store.addTurn("s1", makeTurn("user", "a"));
    store.addTurn("s2", makeTurn("user", "b"));
    expect(store.sessionCount()).toBe(2);
  });

  it("returns a copy of history (not a reference)", () => {
    store.addTurn("s1", makeTurn("user", "original"));
    const history = store.getHistory("s1");
    history.push(makeTurn("user", "injected"));
    expect(store.getHistory("s1")).toHaveLength(1);
  });
});
