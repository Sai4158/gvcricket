/**
 * File overview:
 * Purpose: Renders Live UI for the app's screens and flows.
 * Main exports: createWalkieRuntimeUiApi.
 * Major callers: Feature routes and sibling components.
 * Side effects: none.
 * Read next: ./README.md
 */

import { playUiTone } from "../../../lib/page-audio";
import { shouldMaintainWalkieSignaling } from "./walkie-talkie-gates";
import { clearTimer } from "./walkie-talkie-support";

export function createWalkieRuntimeUiApi({
  connectCueLoopTimerRef,
  cooldownTimerRef,
  enabled,
  manualSignalingActiveRef,
  matchId,
  noticeRef,
  pageVisibleRef,
  requestResetMs,
  requestResetRef,
  setManualSignalingActiveState,
  setNotice,
  setRequestCooldownLeft,
  setRequestState,
  shouldMaintainSignalingRef,
  signalingPropActiveRef,
} = {}) {
  const setManualSignalingActive = (nextActive) => {
    const next = Boolean(nextActive);
    if (manualSignalingActiveRef.current === next) {
      return;
    }
    manualSignalingActiveRef.current = next;
    shouldMaintainSignalingRef.current = shouldMaintainWalkieSignaling({
      enabled,
      matchId,
      pageVisible: pageVisibleRef.current,
      signalingActive: signalingPropActiveRef.current,
      manualSignalingActive: next,
    });
    setManualSignalingActiveState(next);
  };

  const enableManualSignaling = () => {
    if (!enabled || !matchId) {
      return;
    }
    setManualSignalingActive(true);
  };

  const dismissNotice = () => {
    noticeRef.current = "";
    setNotice("");
  };

  const updateNotice = (next) => {
    const safe = String(next || "");
    if (noticeRef.current === safe) return;
    noticeRef.current = safe;
    setNotice(safe);
  };

  const stopConnectingCueLoop = () => {
    clearTimer(connectCueLoopTimerRef);
  };

  const startConnectingCueLoop = () => {
    if (typeof window === "undefined" || connectCueLoopTimerRef.current) {
      return;
    }

    const playConnectPattern = () => {
      playUiTone({ frequency: 880, durationMs: 180, type: "sine", volume: 0.09 });
      window.setTimeout(() => {
        playUiTone({ frequency: 980, durationMs: 180, type: "sine", volume: 0.095 });
      }, 170);
      window.setTimeout(() => {
        playUiTone({ frequency: 1080, durationMs: 180, type: "sine", volume: 0.1 });
      }, 340);
    };

    const loop = () => {
      playConnectPattern();
      connectCueLoopTimerRef.current = window.setTimeout(loop, 980);
    };

    loop();
  };

  const scheduleRequestReset = () => {
    clearTimer(requestResetRef);
    requestResetRef.current = window.setTimeout(() => {
      setRequestState((current) => (current === "pending" ? current : "idle"));
      requestResetRef.current = null;
    }, requestResetMs);
  };

  const setCooldown = (seconds) => {
    clearTimer(cooldownTimerRef, window.clearInterval);
    const next = Math.max(0, Number(seconds || 0));
    setRequestCooldownLeft(next);
    if (!next) return;
    const until = Date.now() + next * 1000;
    cooldownTimerRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRequestCooldownLeft(left);
      if (!left) clearTimer(cooldownTimerRef, window.clearInterval);
    }, 250);
  };

  return {
    dismissNotice,
    enableManualSignaling,
    scheduleRequestReset,
    setCooldown,
    setManualSignalingActive,
    startConnectingCueLoop,
    stopConnectingCueLoop,
    updateNotice,
  };
}


