/**
 * File overview:
 * Purpose: Shared imports and builders for split security and regression test modules.
 * Main exports: shared `test` runner bindings, domain helpers, and `buildBaseMatch`.
 * Major callers: security domain test files under this folder.
 * Side effects: none.
 * Read next: README.md
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  createMatchSchema,
  matchActionSchema,
  sessionCreateSchema,
} from "../../src/app/lib/validators.js";
import {
  createMatchAccessToken,
  hasValidMatchAccess,
  isValidManagePin,
  isValidUmpirePin,
} from "../../src/app/lib/match-access.js";
import {
  createDirectorAccessToken,
  hasValidDirectorAccess,
  isValidDirectorPin,
} from "../../src/app/lib/director-access.js";
import {
  getImagePinCheckPayload,
  getImagePinPromptConfig,
  getRequiredImagePinKind,
  IMAGE_PIN_ATTEMPT_LIMIT,
  IMAGE_PIN_KIND,
} from "../../src/app/lib/image-pin-policy.js";
import { PIN_BURST_BLOCK_MS } from "../../src/app/lib/pin-attempt-policy.js";
import { enforceSmartPinRateLimit } from "../../src/app/lib/pin-attempt-server.js";
import {
  applyMatchAction,
  applySafeMatchPatch,
  MatchEngineError,
} from "../../src/app/lib/match-engine.js";
import { validateMatchImageBuffer } from "../../src/app/lib/match-image.js";
import { evaluateSensitiveImagePredictions } from "../../src/app/lib/match-image-moderation.js";
import {
  GV_MATCH_FALLBACK_IMAGE,
  resolveSafeMatchImage,
} from "../../src/app/components/shared/SafeMatchImage.jsx";
import {
  serializePublicMatch,
  serializePublicSession,
} from "../../src/app/lib/public-data.js";
import { getTeamBundle } from "../../src/app/lib/team-utils.js";
import { applySecurityHeaders } from "../../security-headers.mjs";
import {
  buildWinByWicketsText,
  countLegalBalls,
} from "../../src/app/lib/match-scoring.js";
import {
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
  buildSpectatorAnnouncement,
  buildSpectatorOverCompleteAnnouncement,
  buildSpectatorScoreAnnouncement,
  buildUmpireAnnouncement,
  buildUmpireSecondInningsStartSequence,
  buildUmpireStageAnnouncement,
  buildUmpireTapAnnouncement,
  createManualScoreAnnouncementLiveEvent,
  createMatchCorrectionLiveEvent,
  createScoreLiveEvent,
  createUndoLiveEvent,
} from "../../src/app/lib/live-announcements.js";
import {
  getStartedMatchFromPayload,
  getStartedMatchId,
} from "../../src/app/lib/match-start.js";
import {
  hasCompleteTossState,
  normalizeLegacyTossState,
} from "../../src/app/lib/match-toss.js";
import MatchImport from "../../src/models/Match.js";
import { HOME_LIVE_BANNER_MATCH_FILTER } from "../../src/app/lib/home-live-banner.js";
import {
  getWalkieSnapshot,
  hydrateWalkieEnabled,
  registerWalkieParticipant,
  registerWalkieParticipantFromToken,
  requestWalkieEnable,
  respondToWalkieRequest,
  setWalkieEnabled,
} from "../../src/app/lib/walkie-talkie.js";
import { buildBaseMatchFixture } from "../helpers/match-fixtures.js";

const Match = MatchImport.default || MatchImport;

function buildBaseMatch(overrides = {}) {
  return buildBaseMatchFixture(overrides);
}

export {
  Match,
  MatchEngineError,
  PIN_BURST_BLOCK_MS,
  HOME_LIVE_BANNER_MATCH_FILTER,
  GV_MATCH_FALLBACK_IMAGE,
  IMAGE_PIN_ATTEMPT_LIMIT,
  IMAGE_PIN_KIND,
  applyMatchAction,
  applySafeMatchPatch,
  applySecurityHeaders,
  assert,
  buildBaseMatch,
  buildCurrentScoreAnnouncement,
  buildLiveScoreAnnouncementSequence,
  buildSpectatorAnnouncement,
  buildSpectatorOverCompleteAnnouncement,
  buildSpectatorScoreAnnouncement,
  buildUmpireAnnouncement,
  buildUmpireSecondInningsStartSequence,
  buildUmpireStageAnnouncement,
  buildUmpireTapAnnouncement,
  buildWinByWicketsText,
  countLegalBalls,
  createDirectorAccessToken,
  createManualScoreAnnouncementLiveEvent,
  createMatchAccessToken,
  createMatchCorrectionLiveEvent,
  createMatchSchema,
  createScoreLiveEvent,
  createUndoLiveEvent,
  crypto,
  enforceSmartPinRateLimit,
  evaluateSensitiveImagePredictions,
  getImagePinCheckPayload,
  getImagePinPromptConfig,
  getRequiredImagePinKind,
  getStartedMatchFromPayload,
  getStartedMatchId,
  getTeamBundle,
  getWalkieSnapshot,
  hasCompleteTossState,
  hasValidDirectorAccess,
  hasValidMatchAccess,
  hydrateWalkieEnabled,
  isValidDirectorPin,
  isValidManagePin,
  isValidUmpirePin,
  matchActionSchema,
  normalizeLegacyTossState,
  registerWalkieParticipant,
  registerWalkieParticipantFromToken,
  requestWalkieEnable,
  resolveSafeMatchImage,
  respondToWalkieRequest,
  serializePublicMatch,
  serializePublicSession,
  sessionCreateSchema,
  setWalkieEnabled,
  test,
  validateMatchImageBuffer,
};
