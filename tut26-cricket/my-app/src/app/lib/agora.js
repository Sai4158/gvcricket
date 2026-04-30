/**
 * File overview:
 * Purpose: Provides shared Agora logic for routes, APIs, and feature code.
 * Main exports: getAgoraCredentials, createAgoraRtcToken, createAgoraSignalingToken.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { RtcRole, RtcTokenBuilder, RtmTokenBuilder } from "agora-token";
import {
  buildAgoraRtcUserId,
  buildAgoraRtcChannelName,
  buildAgoraSignalingChannelName,
  buildAgoraUserId,
} from "./agora-channels";

const AGORA_RTC_TOKEN_TTL_SECONDS = 60 * 15;
const AGORA_SIGNALING_TOKEN_TTL_SECONDS = 60 * 30;
const AGORA_APP_ID_PATTERN = /^[a-fA-F0-9]{32}$/;
const AGORA_APP_CERT_PATTERN = /^[a-fA-F0-9]{32}$/;

export function getAgoraCredentials() {
  const appId = String(process.env.AGORA_APP_ID || "").trim();
  const appCertificate = String(process.env.AGORA_APP_CERTIFICATE || "").trim();

  if (!appId || !appCertificate) {
    throw new Error("Agora credentials are not configured.");
  }

  if (!AGORA_APP_ID_PATTERN.test(appId) || !AGORA_APP_CERT_PATTERN.test(appCertificate)) {
    throw new Error("Agora credentials are invalid.");
  }

  return {
    appId,
    appCertificate,
  };
}

export {
  buildAgoraRtcChannelName,
  buildAgoraSignalingChannelName,
  buildAgoraRtcUserId,
  buildAgoraUserId,
};

export function createAgoraRtcToken({ matchId, participantId, role, rtcSessionId = "" }) {
  const { appId, appCertificate } = getAgoraCredentials();
  const channelName = buildAgoraRtcChannelName(matchId);
  const userId = buildAgoraRtcUserId(matchId, participantId, role, rtcSessionId);

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


