import { RtcRole, RtcTokenBuilder, RtmTokenBuilder } from "agora-token";
import {
  buildAgoraRtcChannelName,
  buildAgoraSignalingChannelName,
  buildAgoraUserId,
} from "./agora-channels";

const AGORA_RTC_TOKEN_TTL_SECONDS = 60 * 15;
const AGORA_SIGNALING_TOKEN_TTL_SECONDS = 60 * 30;

export function getAgoraCredentials() {
  const appId = process.env.AGORA_APP_ID || "";
  const appCertificate = process.env.AGORA_APP_CERTIFICATE || "";

  if (!appId || !appCertificate) {
    throw new Error("Agora credentials are not configured.");
  }

  return {
    appId,
    appCertificate,
  };
}

export { buildAgoraRtcChannelName, buildAgoraSignalingChannelName, buildAgoraUserId };

export function createAgoraRtcToken({ matchId, participantId, role }) {
  const { appId, appCertificate } = getAgoraCredentials();
  const channelName = buildAgoraRtcChannelName(matchId);
  const userId = buildAgoraUserId(matchId, participantId, role);

  return {
    appId,
    channelName,
    userId,
    token: RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      userId,
      RtcRole.PUBLISHER,
      AGORA_RTC_TOKEN_TTL_SECONDS,
      AGORA_RTC_TOKEN_TTL_SECONDS
    ),
    expiresInSeconds: AGORA_RTC_TOKEN_TTL_SECONDS,
  };
}

export function createAgoraSignalingToken({ matchId, participantId, role }) {
  const { appId, appCertificate } = getAgoraCredentials();
  const userId = buildAgoraUserId(matchId, participantId, role);

  return {
    appId,
    channelName: buildAgoraSignalingChannelName(matchId),
    userId,
    token: RtmTokenBuilder.buildToken(
      appId,
      appCertificate,
      userId,
      AGORA_SIGNALING_TOKEN_TTL_SECONDS
    ),
    expiresInSeconds: AGORA_SIGNALING_TOKEN_TTL_SECONDS,
  };
}
