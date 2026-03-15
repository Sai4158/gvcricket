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
