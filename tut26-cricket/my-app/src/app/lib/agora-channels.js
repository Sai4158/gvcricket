function sanitizeAgoraChannelPart(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._:-]/g, "-")
    .slice(0, 60);
}

export function buildAgoraRtcChannelName(matchId) {
  return `gv-walkie-rtc-${sanitizeAgoraChannelPart(matchId)}`;
}

export function buildAgoraSignalingChannelName(matchId) {
  return `gv-walkie-sig-${sanitizeAgoraChannelPart(matchId)}`;
}

export function buildAgoraUserId(matchId, participantId, role) {
  return sanitizeAgoraChannelPart(`${role}-${matchId}-${participantId}`).slice(0, 64);
}
