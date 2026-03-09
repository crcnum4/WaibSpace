import { createLogger } from "@waibspace/logger";
import type { PipelineTrace } from "./trace";

const log = createLogger("agent-benchmark");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PercentileStats {
  count: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface AgentBenchmark extends PercentileStats {
  agentId: string;
  errorRate: number;
  lastRecordedAt: number;
}

export interface BenchmarkSummary {
  agents: AgentBenchmark[];
  pipelineStats: PercentileStats & { totalTraces: number };
  collectedSince: number;
}

// ---------------------------------------------------------------------------
// Internal storage
// ---------------------------------------------------------------------------

interface AgentSamples {
  durations: number[];
  errors: number;
  lastRecordedAt: number;
}

// ---------------------------------------------------------------------------
// Percentile helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(values: number[]): PercentileStats {
  if (values.length === 0) {
    return { count: 0, avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    count: sorted.length,
    avg: Math.round(sum / sorted.length),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// ---------------------------------------------------------------------------
// BenchmarkCollector — singleton that accumulates trace data
// ---------------------------------------------------------------------------

export class BenchmarkCollector {
  private agents = new Map<string, AgentSamples>();
  private pipelineDurations: number[] = [];
  private collectedSince = Date.now();

  /** Maximum number of duration samples to retain per agent. */
  private readonly maxSamples: number;

  constructor(opts?: { maxSamples?: number }) {
    this.maxSamples = opts?.maxSamples ?? 1000;
  }

  /**
   * Record metrics from a completed pipeline trace.
   * Call this from the orchestrator after `logTrace()`.
   */
  record(trace: PipelineTrace): void {
    const pipelineDuration = trace.endMs - trace.startMs;
    this.pushSample(this.pipelineDurations, pipelineDuration);

    for (const phase of trace.phases) {
      for (const agent of phase.agents) {
        let samples = this.agents.get(agent.agentId);
        if (!samples) {
          samples = { durations: [], errors: 0, lastRecordedAt: 0 };
          this.agents.set(agent.agentId, samples);
        }
        this.pushSample(samples.durations, agent.durationMs);
        if (agent.status !== "success") {
          samples.errors++;
        }
        samples.lastRecordedAt = Date.now();
      }
    }
  }

  /**
   * Return aggregate benchmark stats for all agents and the pipeline overall.
   */
  getSummary(): BenchmarkSummary {
    const agents: AgentBenchmark[] = [];

    for (const [agentId, samples] of this.agents) {
      const stats = computeStats(samples.durations);
      agents.push({
        agentId,
        ...stats,
        errorRate:
          samples.durations.length > 0
            ? Math.round((samples.errors / samples.durations.length) * 10000) / 10000
            : 0,
        lastRecordedAt: samples.lastRecordedAt,
      });
    }

    // Sort by avg descending so slowest agents appear first
    agents.sort((a, b) => b.avg - a.avg);

    const pipelineStats = computeStats(this.pipelineDurations);

    return {
      agents,
      pipelineStats: { ...pipelineStats, totalTraces: this.pipelineDurations.length },
      collectedSince: this.collectedSince,
    };
  }

  /**
   * Log a human-readable benchmark summary.
   */
  logSummary(): void {
    const summary = this.getSummary();
    if (summary.pipelineStats.totalTraces === 0) {
      log.info("No benchmark data collected yet");
      return;
    }

    log.info("Agent benchmark summary", {
      totalTraces: summary.pipelineStats.totalTraces,
      pipeline: {
        avg: `${summary.pipelineStats.avg}ms`,
        p50: `${summary.pipelineStats.p50}ms`,
        p95: `${summary.pipelineStats.p95}ms`,
        p99: `${summary.pipelineStats.p99}ms`,
      },
      agents: summary.agents.map((a) => ({
        id: a.agentId,
        avg: `${a.avg}ms`,
        p95: `${a.p95}ms`,
        errorRate: `${(a.errorRate * 100).toFixed(1)}%`,
        count: a.count,
      })),
    });
  }

  /**
   * Reset all collected data.
   */
  reset(): void {
    this.agents.clear();
    this.pipelineDurations = [];
    this.collectedSince = Date.now();
  }

  // Keep arrays bounded
  private pushSample(arr: number[], value: number): void {
    arr.push(value);
    if (arr.length > this.maxSamples) {
      arr.shift();
    }
  }
}
