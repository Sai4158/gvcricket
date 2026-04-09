"use client";

/**
 * File overview:
 * Purpose: Encapsulates Live browser state, effects, and runtime coordination.
 * Main exports: module side effects only.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */

export {
  classifyWalkieSignalingSetupError,
  isWalkieNetworkError,
} from "./walkie/useWalkieTalkieRuntime";
export { mergeWalkieSnapshots } from "./walkie/useWalkieTalkieRuntime";
export {
  shouldMaintainWalkieAudioTransport,
  shouldMaintainWalkieSignaling,
  shouldPlayWalkieRemoteAudio,
  shouldReceiveWalkieAudio,
} from "./walkie/useWalkieTalkieRuntime";
export { default } from "./walkie/useWalkieTalkieRuntime";


