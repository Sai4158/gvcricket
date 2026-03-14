"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  duckPageMedia,
  playUiTone,
  primeUiAudio,
  restorePageMedia,
} from "../../lib/page-audio";

const WALKIE_FINISH_DELAY_MS = 1200;
const WALKIE_SIGNAL_RACE_MESSAGES = new Set([
  "No active walkie transmission.",
  "Active speaker not found.",
  "Participant not found.",
]);

export function shouldReceiveWalkieAudio({ participantId, snapshot }) {
  if (!snapshot?.enabled) {
    return false;
  }

  const activeSpeakerId = snapshot.activeSpeakerId || "";
  if (!activeSpeakerId || activeSpeakerId === participantId) {
    return false;
  }

  return true;
}

function getParticipantId(matchId, role) {
  if (typeof window === "undefined") {
    return "";
  }

  return `${role}:${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

const DEFAULT_ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
];

function createPeerConnection(iceServers) {
  return new RTCPeerConnection({
    bundlePolicy: "max-bundle",
    iceCandidatePoolSize: 2,
    iceServers: Array.isArray(iceServers) && iceServers.length ? iceServers : DEFAULT_ICE_SERVERS,
  });
}

function getAudioEncodingParams(sender) {
  const params = sender.getParameters?.() || {};
  const encodings = params.encodings?.length ? params.encodings : [{}];

  return {
    ...params,
    encodings: encodings.map((encoding) => ({
      ...encoding,
      maxBitrate: 24_000,
      networkPriority: "high",
    })),
  };
}

export default function useWalkieTalkie({
  matchId,
  enabled = true,
  role,
  hasUmpireAccess = false,
  displayName = "",
}) {
  const [participantId, setParticipantId] = useState("");
  const [token, setToken] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishDelayLeft, setFinishDelayLeft] = useState(0);
  const [requestCooldownLeft, setRequestCooldownLeft] = useState(0);
  const [requestState, setRequestState] = useState("idle");
  const [iceServers, setIceServers] = useState(DEFAULT_ICE_SERVERS);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const listenerPcRef = useRef(null);
  const speakerPeersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteAudioPrimedRef = useRef(false);
  const previousTransmissionRef = useRef("");
  const snapshotRef = useRef(null);
  const pageMediaDuckRef = useRef([]);
  const listenerPendingCandidatesRef = useRef([]);
  const speakerPendingCandidatesRef = useRef(new Map());
  const finishTimerRef = useRef(null);
  const finishDeadlineRef = useRef(0);
  const isFinishingRef = useRef(false);
  const releaseInFlightRef = useRef(false);
  const suppressOwnTransmissionEndedRef = useRef(false);
  const tokenRef = useRef("");
  const iceConfigLoadedRef = useRef(false);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    isFinishingRef.current = isFinishing;
  }, [isFinishing]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const loadIceConfig = useCallback(async () => {
    if (!matchId || !participantId || !role || !tokenRef.current || iceConfigLoadedRef.current) {
      return;
    }

    try {
      const params = new URLSearchParams({
        role,
        participantId,
        token: tokenRef.current,
      });
      const response = await fetch(`/api/live/walkie/${matchId}/ice?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return;
      }
      if (Array.isArray(payload.iceServers) && payload.iceServers.length) {
        setIceServers(payload.iceServers);
      }
      iceConfigLoadedRef.current = true;
    } catch {
      // Fall back to bundled public STUN servers.
    }
  }, [matchId, participantId, role]);

  useEffect(() => {
    if (!matchId || !role) {
      return;
    }

    setParticipantId(getParticipantId(matchId, role));
  }, [matchId, role]);

  const eventSourceUrl = useMemo(() => {
    if (!enabled || !matchId || !participantId) {
      return null;
    }

    const params = new URLSearchParams({
      role,
      participantId,
      name: displayName || (role === "umpire" ? "Umpire" : "Spectator"),
    });
    return `/api/live/walkie/${matchId}?${params.toString()}`;
  }, [displayName, enabled, matchId, participantId, role]);

  const closeListener = useCallback(() => {
    if (listenerPcRef.current) {
      listenerPcRef.current.ontrack = null;
      listenerPcRef.current.onicecandidate = null;
      listenerPcRef.current.close();
      listenerPcRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    restorePageMedia(pageMediaDuckRef);
    listenerPendingCandidatesRef.current = [];
  }, []);

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    finishDeadlineRef.current = 0;
    setFinishDelayLeft(0);
  }, []);

  const playWalkieStartTone = useCallback(() => {
    playUiTone({
      frequency: 1040,
      durationMs: 170,
      type: "sine",
      volume: 0.07,
    });
  }, []);

  const playWalkieEndTone = useCallback(() => {
    playUiTone({
      frequency: 660,
      durationMs: 170,
      type: "triangle",
      volume: 0.065,
    });
  }, []);

  const ensureRemoteAudio = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!remoteAudioRef.current) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.setAttribute("playsinline", "");
      audio.preload = "auto";
      audio.muted = false;
      audio.volume = 1;
      audio.style.position = "fixed";
      audio.style.width = "0";
      audio.style.height = "0";
      audio.style.opacity = "0";
      audio.style.pointerEvents = "none";
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }

    return remoteAudioRef.current;
  }, []);

  const primeRemoteAudio = useCallback(() => {
    const audio = ensureRemoteAudio();
    if (!audio) {
      return;
    }

    void primeUiAudio();

    if (remoteAudioPrimedRef.current) {
      return;
    }

    remoteAudioPrimedRef.current = true;
    try {
      void audio.play().catch(() => {
        remoteAudioPrimedRef.current = false;
        setNeedsAudioUnlock(true);
      });
    } catch {
      remoteAudioPrimedRef.current = false;
      setNeedsAudioUnlock(true);
    }
  }, [ensureRemoteAudio]);

  const unlockAudio = useCallback(async () => {
    const audio = ensureRemoteAudio();
    if (!audio) {
      return false;
    }

    try {
      await primeUiAudio();
      await audio.play();
      remoteAudioPrimedRef.current = true;
      setNeedsAudioUnlock(false);
      setError("");
      return true;
    } catch {
      setNeedsAudioUnlock(true);
      return false;
    }
  }, [ensureRemoteAudio]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleGesture = () => {
      primeRemoteAudio();
    };

    window.addEventListener("pointerdown", handleGesture, { passive: true });
    window.addEventListener("touchstart", handleGesture, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };
  }, [primeRemoteAudio]);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    speakerPeersRef.current.forEach((peer) => {
      peer.onicecandidate = null;
      peer.close();
    });
    speakerPeersRef.current.clear();
    speakerPendingCandidatesRef.current.clear();
  }, []);

  const finalizeTransmission = useCallback(
    ({ playTone = false } = {}) => {
      clearFinishTimer();
      releaseInFlightRef.current = false;
      suppressOwnTransmissionEndedRef.current = false;
      setIsFinishing(false);
      if (playTone) {
        playWalkieEndTone();
      }
      restorePageMedia(pageMediaDuckRef);
      stopLocalStream();
      closeListener();
    },
    [clearFinishTimer, closeListener, playWalkieEndTone, stopLocalStream]
  );

  useEffect(() => {
    closeListener();
    stopLocalStream();
    clearFinishTimer();
    previousTransmissionRef.current = "";
    snapshotRef.current = null;
    remoteAudioPrimedRef.current = false;
    setNeedsAudioUnlock(false);
    iceConfigLoadedRef.current = false;
    setIceServers(DEFAULT_ICE_SERVERS);
    setToken("");
    setSnapshot(null);
    setNotice("");
    setError("");
    setClaiming(false);
    setCountdown(30);
    setIsFinishing(false);
    setFinishDelayLeft(0);
    setRequestCooldownLeft(0);
    setRequestState("idle");
  }, [clearFinishTimer, closeListener, enabled, matchId, role, stopLocalStream]);

  const sendJson = useCallback(async (path, body) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({ message: "Request failed." }));
    if (!response.ok) {
      throw new Error(payload.message || "Request failed.");
    }
    return payload;
  }, []);

  const sendSignal = useCallback(async (toId, payload) => {
    const activeToken = tokenRef.current;

    if (!matchId || !participantId || !activeToken) {
      return;
    }

    try {
      await sendJson(`/api/matches/${matchId}/walkie/signal`, {
        participantId,
        role,
        token: activeToken,
        toId,
        payload,
      });
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Request failed.";

      if (WALKIE_SIGNAL_RACE_MESSAGES.has(message)) {
        return;
      }

      throw nextError;
    }
  }, [matchId, participantId, role, sendJson]);

  const respondToRequest = useCallback(
    async (requestId, action) => {
      if (!matchId || role !== "umpire" || !hasUmpireAccess) {
        return false;
      }

      try {
        const payload = await sendJson(`/api/matches/${matchId}/walkie/respond`, {
          requestId,
          action,
        });
        setSnapshot(payload.walkie || null);
        setError("");
        return true;
      } catch (nextError) {
        setError(nextError.message || "Could not update walkie request.");
        return false;
      }
    },
    [hasUmpireAccess, matchId, role, sendJson]
  );

  const ensureSpeakerStream = async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
        sampleSize: 16,
        latency: 0.02,
      },
      video: false,
    });
    stream.getAudioTracks().forEach((track) => {
      try {
        track.contentHint = "speech";
      } catch {
        // contentHint is optional across browsers.
      }
    });
    localStreamRef.current = stream;
    return stream;
  };

  const handleIncomingSignal = useCallback(async (message) => {
    const payload = message.payload || {};
    const currentSnapshot = snapshotRef.current;

    try {
      if (currentSnapshot?.activeSpeakerId === participantId) {
        const stream = await ensureSpeakerStream();
        let peer = speakerPeersRef.current.get(message.fromId);

        if (!peer) {
          peer = createPeerConnection(iceServers);
          stream.getTracks().forEach((track) => {
            const sender = peer.addTrack(track, stream);
            try {
              sender.setParameters?.(getAudioEncodingParams(sender));
            } catch {
              // Best-effort only.
            }
          });
          peer.onicecandidate = (event) => {
            if (event.candidate) {
              void sendSignal(message.fromId, {
                type: "ice-candidate",
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid || "",
                sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
              });
            }
          };
          speakerPeersRef.current.set(message.fromId, peer);
          speakerPendingCandidatesRef.current.set(message.fromId, []);
        }

        if (payload.type === "offer" && payload.sdp) {
          await peer.setRemoteDescription({
            type: "offer",
            sdp: payload.sdp,
          });
          const queuedCandidates =
            speakerPendingCandidatesRef.current.get(message.fromId) || [];
          for (const candidate of queuedCandidates) {
            await peer.addIceCandidate(candidate);
          }
          speakerPendingCandidatesRef.current.set(message.fromId, []);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await sendSignal(message.fromId, {
            type: "answer",
            sdp: answer.sdp || "",
          });
        } else if (payload.type === "ice-candidate" && payload.candidate) {
          const nextCandidate = {
            candidate: payload.candidate,
            sdpMid: payload.sdpMid || null,
            sdpMLineIndex: payload.sdpMLineIndex ?? null,
          };
          if (peer.remoteDescription) {
            await peer.addIceCandidate(nextCandidate);
          } else {
            const queuedCandidates =
              speakerPendingCandidatesRef.current.get(message.fromId) || [];
            queuedCandidates.push(nextCandidate);
            speakerPendingCandidatesRef.current.set(message.fromId, queuedCandidates);
          }
        }

        return;
      }

      if (!listenerPcRef.current) {
        return;
      }

      if (payload.type === "answer" && payload.sdp) {
        await listenerPcRef.current.setRemoteDescription({
          type: "answer",
          sdp: payload.sdp,
        });
        for (const candidate of listenerPendingCandidatesRef.current) {
          await listenerPcRef.current.addIceCandidate(candidate);
        }
        listenerPendingCandidatesRef.current = [];
      } else if (payload.type === "ice-candidate" && payload.candidate) {
        const nextCandidate = {
          candidate: payload.candidate,
          sdpMid: payload.sdpMid || null,
          sdpMLineIndex: payload.sdpMLineIndex ?? null,
        };
        if (listenerPcRef.current.remoteDescription) {
          await listenerPcRef.current.addIceCandidate(nextCandidate);
        } else {
          listenerPendingCandidatesRef.current.push(nextCandidate);
        }
      }
    } catch (nextError) {
      setError(nextError.message || "Walkie signal failed.");
    }
  }, [iceServers, participantId, sendSignal]);

  useEffect(() => {
    if (!eventSourceUrl) {
      return undefined;
    }

    const source = new EventSource(eventSourceUrl);
    let closed = false;

    const parseMessage = (message) => {
      try {
        return JSON.parse(message.data);
      } catch {
        return null;
      }
    };

    const handleOpen = () => {
      setError("");
    };

    const handleState = (message) => {
      const payload = parseMessage(message);
      if (!payload) {
        return;
      }

      if (payload.token) {
        setToken(payload.token);
      }

      if (payload.notification?.message) {
        setNotice(payload.notification.message);
      }

      if (payload.notification?.type === "walkie_requested" && role === "umpire") {
        playUiTone({ frequency: 1080, durationMs: 120, type: "sine", volume: 0.03 });
      }

      if (payload.notification?.type === "walkie_request_accepted" && role !== "umpire") {
        playUiTone({ frequency: 920, durationMs: 120, type: "sine", volume: 0.03 });
      }

      if (payload.notification?.type === "walkie_request_dismissed" && role !== "umpire") {
        playUiTone({ frequency: 520, durationMs: 110, type: "triangle", volume: 0.02 });
      }

      setSnapshot(payload.snapshot || null);
      setError("");
    };

    const handleSignal = (message) => {
      const payload = parseMessage(message);
      if (payload) {
        void handleIncomingSignal(payload);
      }
    };

    const handleParticipant = (message) => {
      const payload = parseMessage(message);
      if (payload?.type === "transmission-ended") {
        const ownTransmissionEnded =
          suppressOwnTransmissionEndedRef.current ||
          releaseInFlightRef.current ||
          isFinishingRef.current;

        if (ownTransmissionEnded) {
          finalizeTransmission({ playTone: false });
          return;
        }

        playWalkieEndTone();
        closeListener();
        stopLocalStream();
        return;
      }

      if (payload?.type === "request-sent") {
        setRequestState("pending");
        setNotice("Request sent. Waiting for the umpire.");
        return;
      }

      if (payload?.type === "request-accepted") {
        setRequestState("accepted");
        setNotice("Umpire enabled walkie-talkie.");
        playUiTone({ frequency: 920, durationMs: 120, type: "sine", volume: 0.03 });
        return;
      }

      if (payload?.type === "request-dismissed") {
        setRequestState("dismissed");
        setNotice("Umpire dismissed the walkie request.");
        playUiTone({ frequency: 520, durationMs: 110, type: "triangle", volume: 0.02 });
        return;
      }

      if (payload?.type === "request-expired") {
        setRequestState("idle");
        setNotice("Walkie request expired.");
      }
    };

    const handleError = () => {
      if (closed || source.readyState === EventSource.CLOSED) {
        return;
      }
    };

    source.addEventListener("open", handleOpen);
    source.addEventListener("state", handleState);
    source.addEventListener("signal", handleSignal);
    source.addEventListener("participant", handleParticipant);
    source.addEventListener("error", handleError);

    return () => {
      closed = true;
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("state", handleState);
      source.removeEventListener("signal", handleSignal);
      source.removeEventListener("participant", handleParticipant);
      source.removeEventListener("error", handleError);
      source.close();
    };
  }, [
    closeListener,
    eventSourceUrl,
    finalizeTransmission,
    handleIncomingSignal,
    loadIceConfig,
    participantId,
    playWalkieEndTone,
    role,
    stopLocalStream,
  ]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadIceConfig();
  }, [loadIceConfig, token]);

  useEffect(() => {
    if (snapshot?.enabled) {
      setRequestState((current) => (current === "pending" ? "accepted" : current));
      return;
    }

    setRequestState((current) => (current === "accepted" ? "idle" : current));
  }, [role, snapshot?.enabled]);

  useEffect(() => {
    if (!snapshot?.expiresAt || snapshot.activeSpeakerId !== participantId) {
      setCountdown(30);
      return;
    }

    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(snapshot.expiresAt).getTime() - Date.now()) / 1000)
      );
      setCountdown((current) => (current === remaining ? current : remaining));
    }, 500);

    return () => window.clearInterval(timer);
  }, [participantId, snapshot?.activeSpeakerId, snapshot?.expiresAt]);

  useEffect(() => {
    if (!isFinishing || !finishDeadlineRef.current) {
      setFinishDelayLeft(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((finishDeadlineRef.current - Date.now()) / 1000)
      );
      setFinishDelayLeft((current) => (current === remaining ? current : remaining));
    }, 250);

    return () => window.clearInterval(timer);
  }, [isFinishing]);

  useEffect(() => {
    if (requestCooldownLeft <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRequestCooldownLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [requestCooldownLeft]);

  const activeSpeakerId = snapshot?.activeSpeakerId || "";
  const activeSpeakerRole = snapshot?.activeSpeakerRole || "";
  const transmissionId = snapshot?.transmissionId || "";
  const shouldListen = shouldReceiveWalkieAudio({
    participantId,
    snapshot,
  });

  useEffect(() => {
    if (!transmissionId || previousTransmissionRef.current === transmissionId) {
      if (!transmissionId) {
        finalizeTransmission({ playTone: false });
      }
      return;
    }

    previousTransmissionRef.current = transmissionId;

    if (!shouldListen) {
      closeListener();
      return;
    }

    duckPageMedia(pageMediaDuckRef, 0.18);
    playWalkieStartTone();

    const peer = createPeerConnection(iceServers);
    const remoteStream = new MediaStream();
    listenerPcRef.current = peer;

    peer.ontrack = (event) => {
      remoteStream.addTrack(event.track);
      const audio = ensureRemoteAudio();
      if (!audio) {
        return;
      }
      audio.srcObject = remoteStream;
      audio.muted = false;
      audio.volume = 1;
      void audio.play().catch(() => {
        remoteAudioPrimedRef.current = false;
        setNeedsAudioUnlock(true);
      });
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignal(activeSpeakerId, {
          type: "ice-candidate",
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid || "",
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
        });
      }
    };

    void (async () => {
      peer.addTransceiver("audio", { direction: "recvonly" });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal(activeSpeakerId, {
        type: "offer",
        sdp: offer.sdp || "",
      });
    })().catch((nextError) => {
      setError(nextError.message || "Walkie audio failed.");
    });

    return () => {
      closeListener();
    };
  }, [
    closeListener,
    ensureRemoteAudio,
    finalizeTransmission,
    participantId,
    playWalkieStartTone,
    role,
    sendSignal,
    activeSpeakerId,
    activeSpeakerRole,
    transmissionId,
    shouldListen,
    stopLocalStream,
    iceServers,
  ]);

  useEffect(
    () => () => {
      finalizeTransmission({ playTone: false });
    },
    [finalizeTransmission]
  );

  const toggleEnabled = async (nextEnabled) => {
    if (!matchId || role !== "umpire" || !hasUmpireAccess) {
      return;
    }

    const payload = await sendJson(`/api/matches/${matchId}/walkie`, {
      enabled: nextEnabled,
    });
    primeRemoteAudio();
    setSnapshot(payload.walkie || null);
  };

  const startTalking = async () => {
    if (!matchId || !participantId || !token || claiming) {
      return false;
    }

    clearFinishTimer();
    setIsFinishing(false);
    suppressOwnTransmissionEndedRef.current = false;

    if (snapshotRef.current?.activeSpeakerId === participantId) {
      return true;
    }

    setClaiming(true);
    setError("");

    try {
      await ensureSpeakerStream();
      const payload = await sendJson(`/api/matches/${matchId}/walkie/claim`, {
        participantId,
        role,
        token,
      });

      await loadIceConfig();
      primeRemoteAudio();
      duckPageMedia(pageMediaDuckRef, 0.18);
      playWalkieStartTone();
      setSnapshot(payload.walkie || null);
      return true;
    } catch (nextError) {
      stopLocalStream();
      setError(nextError.message || "Could not start talking.");
      return false;
    } finally {
      setClaiming(false);
    }
  };

  const stopTalking = useCallback(async () => {
    if (!matchId || !participantId || !token) {
      return;
    }

    if (isFinishingRef.current) {
      return;
    }

    if (snapshotRef.current?.activeSpeakerId !== participantId) {
      finalizeTransmission({ playTone: false });
      return;
    }

    clearFinishTimer();
    setIsFinishing(true);
    finishDeadlineRef.current = Date.now() + WALKIE_FINISH_DELAY_MS;
    setFinishDelayLeft(Math.ceil(WALKIE_FINISH_DELAY_MS / 1000));

    finishTimerRef.current = window.setTimeout(async () => {
      releaseInFlightRef.current = true;
      suppressOwnTransmissionEndedRef.current = true;

      try {
        await sendJson(`/api/matches/${matchId}/walkie/release`, {
          participantId,
          role,
          token,
        });
      } catch {
        // Best effort release; local cleanup still runs.
      } finally {
        finalizeTransmission({ playTone: true });
      }
    }, WALKIE_FINISH_DELAY_MS);
  }, [
    clearFinishTimer,
    finalizeTransmission,
    matchId,
    participantId,
    sendJson,
    token,
    role,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        void stopTalking();
      }
    };

    const handlePageHide = () => {
      void stopTalking();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [stopTalking]);

  const dismissNotice = () => setNotice("");

  const requestEnable = async () => {
    if (
      !matchId ||
      !participantId ||
      !token ||
      !["spectator", "director"].includes(role) ||
      requestCooldownLeft > 0 ||
      requestState === "pending"
    ) {
      return false;
    }

    try {
      await sendJson(`/api/matches/${matchId}/walkie/request`, {
        participantId,
        role,
        token,
      });
      primeRemoteAudio();
      setRequestCooldownLeft(30);
      setRequestState("pending");
      setNotice("Request sent. Waiting for the umpire.");
      return true;
    } catch (nextError) {
      setError(nextError.message || "Could not send walkie request.");
      return false;
    }
  };

  const holdsSpeakerLock = snapshot?.activeSpeakerId === participantId;
  const isSelfTalking = holdsSpeakerLock && !isFinishing;
  const isBusy = Boolean(snapshot?.busy);
  const otherSpeakerBusy = isBusy && !holdsSpeakerLock;
  const isLiveOrFinishing = isSelfTalking || isFinishing;

  return {
    participantId,
    snapshot,
    notice,
    error,
    countdown,
    claiming,
    isSelfTalking,
    isFinishing,
    isLiveOrFinishing,
    finishDelayLeft,
    isBusy,
    otherSpeakerBusy,
    canEnable:
      role === "umpire" &&
      hasUmpireAccess,
    canRequestEnable:
      ["spectator", "director"].includes(role) &&
      !snapshot?.enabled &&
      requestCooldownLeft === 0,
    canTalk:
      Boolean(snapshot?.enabled) &&
      !isFinishing &&
      !otherSpeakerBusy &&
      (role === "umpire"
        ? Number(snapshot?.spectatorCount || 0) > 0
        : Number(snapshot?.umpireCount || 0) > 0),
    toggleEnabled,
    startTalking,
    stopTalking,
    requestEnable,
    requestCooldownLeft,
    requestState,
    pendingRequests: snapshot?.pendingRequests || [],
    dismissNotice,
    needsAudioUnlock,
    unlockAudio,
    acceptRequest: (requestId) => respondToRequest(requestId, "accept"),
    dismissRequest: (requestId) => respondToRequest(requestId, "dismiss"),
  };
}
