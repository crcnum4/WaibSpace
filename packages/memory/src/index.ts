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
