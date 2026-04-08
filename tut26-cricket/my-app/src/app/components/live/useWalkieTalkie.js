"use client";

/**
 * File overview:
 * Purpose: Stable public entry for the walkie-talkie hook.
 * Main exports: useWalkieTalkie and walkie helper re-exports.
 * Major callers: live, match, session-view, and director screens.
 * Side effects: none in this wrapper.
 * Read next: ./walkie/README.md
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
