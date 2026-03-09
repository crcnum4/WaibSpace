import { describe, it, expect, beforeEach } from "bun:test";
import { BenchmarkCollector } from "../benchmark";
import type { PipelineTrace } from "../trace";

function makeTrace(overrides?: Partial<PipelineTrace>): PipelineTrace {
  return {
    traceId: "test-trace",
    eventType: "user.query",
    startMs: 1000,
    endMs: 1500,
    phases: [
      {
        category: "perception",
        startMs: 1000,
        endMs: 1100,
        durationMs: 100,
        agents: [
          {
            agentId: "input-normalizer",
            agentType: "perception",
            durationMs: 50,
            status: "success",
            confidence: 0.9,
          },
          {
            agentId: "url-parser",
            agentType: "perception",
            durationMs: 80,
            status: "success",
            confidence: 0.95,
          },
        ],
      },
      {
        category: "reasoning",
        startMs: 1100,
        endMs: 1500,
        durationMs: 400,
        agents: [
          {
            agentId: "intent-agent",
            agentType: "reasoning",
            durationMs: 350,
            status: "success",
            confidence: 0.85,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("BenchmarkCollector", () => {
  let collector: BenchmarkCollector;

  beforeEach(() => {
    collector = new BenchmarkCollector();
  });

  it("returns empty summary when no data recorded", () => {
    const summary = collector.getSummary();
    expect(summary.agents).toHaveLength(0);
    expect(summary.pipelineStats.totalTraces).toBe(0);
    expect(summary.pipelineStats.avg).toBe(0);
  });

  it("records a single trace and computes stats", () => {
    collector.record(makeTrace());
    const summary = collector.getSummary();

    expect(summary.pipelineStats.totalTraces).toBe(1);
    expect(summary.pipelineStats.avg).toBe(500); // endMs - startMs = 500
    expect(summary.agents).toHaveLength(3);

    const intent = summary.agents.find((a) => a.agentId === "intent-agent");
    expect(intent).toBeDefined();
    expect(intent!.avg).toBe(350);
    expect(intent!.count).toBe(1);
    expect(intent!.errorRate).toBe(0);
  });

  it("aggregates multiple traces correctly", () => {
    // Record 3 traces with varying durations
    collector.record(makeTrace({ startMs: 0, endMs: 100 }));
    collector.record(makeTrace({ startMs: 0, endMs: 200 }));
    collector.record(makeTrace({ startMs: 0, endMs: 300 }));

    const summary = collector.getSummary();
    expect(summary.pipelineStats.totalTraces).toBe(3);
    expect(summary.pipelineStats.avg).toBe(200);
    expect(summary.pipelineStats.min).toBe(100);
    expect(summary.pipelineStats.max).toBe(300);
  });

  it("tracks error rate per agent", () => {
    const errorTrace = makeTrace();
    errorTrace.phases[0].agents[0].status = "error";
    collector.record(errorTrace);
    collector.record(makeTrace()); // success

    const summary = collector.getSummary();
    const normalizer = summary.agents.find(
      (a) => a.agentId === "input-normalizer",
    );
    expect(normalizer).toBeDefined();
    expect(normalizer!.count).toBe(2);
    expect(normalizer!.errorRate).toBe(0.5);
  });

  it("sorts agents by avg descending (slowest first)", () => {
    collector.record(makeTrace());
    const summary = collector.getSummary();
    const avgs = summary.agents.map((a) => a.avg);
    for (let i = 1; i < avgs.length; i++) {
      expect(avgs[i]).toBeLessThanOrEqual(avgs[i - 1]);
    }
  });

  it("respects maxSamples limit", () => {
    const small = new BenchmarkCollector({ maxSamples: 5 });
    for (let i = 0; i < 10; i++) {
      small.record(makeTrace({ startMs: 0, endMs: (i + 1) * 100 }));
    }
    const summary = small.getSummary();
    // Pipeline should only keep last 5 samples
    expect(summary.pipelineStats.count).toBe(5);
  });

  it("reset clears all data", () => {
    collector.record(makeTrace());
    expect(collector.getSummary().pipelineStats.totalTraces).toBe(1);

    collector.reset();
    const summary = collector.getSummary();
    expect(summary.pipelineStats.totalTraces).toBe(0);
    expect(summary.agents).toHaveLength(0);
  });

  it("computes p50/p95/p99 correctly with many samples", () => {
    // Record 100 traces with pipeline durations 1..100
    for (let i = 1; i <= 100; i++) {
      collector.record(makeTrace({ startMs: 0, endMs: i }));
    }
    const summary = collector.getSummary();
    expect(summary.pipelineStats.p50).toBe(50);
    expect(summary.pipelineStats.p95).toBe(95);
    expect(summary.pipelineStats.p99).toBe(99);
  });
});
