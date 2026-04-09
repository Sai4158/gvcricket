/**
 * File overview:
 * Purpose: Provides shared Agora Channels logic for routes, APIs, and feature code.
 * Main exports: buildAgoraRtcChannelName, buildAgoraSignalingChannelName, buildAgoraUserId, buildAgoraRtcUserId.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

const AGORA_CHANNEL_PART_MAX = 48;
const AGORA_USER_ID_MAX = 64;

function sanitizeAgoraChannelPart(value, maxLength = AGORA_CHANNEL_PART_MAX) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._:-]/g, "-")
    .slice(0, maxLength);
}

export function buildAgoraRtcChannelName(matchId) {
  return `gvrtc-${sanitizeAgoraChannelPart(matchId)}`;
}

export function buildAgoraSignalingChannelName(matchId) {
  return `gvsig-${sanitizeAgoraChannelPart(matchId)}`;
}

export function buildAgoraUserId(matchId, participantId, role) {
  return sanitizeAgoraChannelPart(
    `${role}-${matchId}-${participantId}`,
    AGORA_USER_ID_MAX
  );
}

export function buildAgoraRtcUserId(matchId, participantId, role, rtcSessionId = "") {
  return sanitizeAgoraChannelPart(
    rtcSessionId
      ? `${role}-${matchId}-${participantId}-${rtcSessionId}`
      : `${role}-${matchId}-${participantId}`,
    AGORA_USER_ID_MAX
  );
}


