export { MemoryStore } from "./memory-store";
export { MemoryUpdatePipeline } from "./update-pipeline";
export { ObservationProcessor } from "./observation-processor";
export type { ObservationProcessorOptions } from "./observation-processor";
export { PatternDetector, hourToBucket } from "./pattern-detector";
export type {
  PatternDetectorOptions,
  DetectedPattern,
  ActionRecord,
  TimeOfDayBucket,
} from "./pattern-detector";
export { ConversationContextStore } from "./conversation-context-store";
export type { ConversationContextStoreOptions } from "./conversation-context-store";
export { ContactProfileStore, parseFromHeader } from "./contact-profile-store";
export type { ContactProfile, SenderSummary } from "./contact-profile-store";
export { EngagementTracker } from "./engagement-tracker";
export type {
  SurfaceInteraction,
  EngagementMetrics,
  EngagementScore,
} from "./engagement-tracker";
export { BehavioralTracker } from "./behavioral-tracker";
export type {
  BehaviorObservation,
  BehaviorAggregate,
  BehavioralTrackerOptions,
} from "./behavioral-tracker";
export { BehavioralModel } from "./behavioral-model";
export type {
  LearnedPreference,
  BehavioralModelOptions,
} from "./behavioral-model";
export { ShortTermMemoryManager } from "./short-term-memory";
export type { ShortTermStore } from "./short-term-memory";
export { MidTermMemory } from "./midterm-memory";
export type { MidTermEntry } from "./midterm-memory";
export { LongTermMemory } from "./longterm-memory";
export type { LongTermEntry } from "./longterm-memory";
export { resolveMemoryDomains } from "./domain-resolver";
export { buildMemoryContext, extractKeywords } from "./context-builder";
export { MemoryCompactor } from "./memory-compactor";
export type {
  CompactorMessage,
  CompactionInsight,
  LongTermExtract,
  StructuredCompletionFn,
  CompactionStats,
} from "./memory-compactor";
