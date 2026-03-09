"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { duckPageMedia, playUiTone, restorePageMedia } from "../../lib/page-audio";

function getParticipantId(matchId, role) {
  if (typeof window === "undefined") {
    return "";
  }

  return `${role}:${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function createPeerConnection() {
  return new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
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
  const [requestCooldownLeft, setRequestCooldownLeft] = useState(0);
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

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

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

  const closeListener = () => {
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
  };

  const ensureRemoteAudio = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = false;
      audio.volume = 1;
      remoteAudioRef.current = audio;
    }

    return remoteAudioRef.current;
  }, []);

  const primeRemoteAudio = useCallback(() => {
    const audio = ensureRemoteAudio();
    if (!audio || remoteAudioPrimedRef.current) {
      return;
    }

    remoteAudioPrimedRef.current = true;
    try {
      void audio.play().catch(() => {
        remoteAudioPrimedRef.current = false;
      });
    } catch {
      remoteAudioPrimedRef.current = false;
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

  const stopLocalStream = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    speakerPeersRef.current.forEach((peer) => {
      peer.onicecandidate = null;
      peer.close();
    });
    speakerPeersRef.current.clear();
    speakerPendingCandidatesRef.current.clear();
  };

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
    if (!matchId || !participantId || !token) {
      return;
    }

    await sendJson(`/api/matches/${matchId}/walkie/signal`, {
      participantId,
      role,
      token,
      toId,
      payload,
    });
  }, [matchId, participantId, role, sendJson, token]);

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
      },
      video: false,
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
          peer = createPeerConnection();
          stream.getTracks().forEach((track) => peer.addTrack(track, stream));
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
  }, [participantId, sendSignal]);

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
        playUiTone({ frequency: 620, durationMs: 130, type: "triangle", volume: 0.03 });
        closeListener();
        stopLocalStream();
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
  }, [eventSourceUrl, handleIncomingSignal]);

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
      setCountdown(remaining);
    }, 250);

    return () => window.clearInterval(timer);
  }, [participantId, snapshot?.activeSpeakerId, snapshot?.expiresAt]);

  useEffect(() => {
    if (requestCooldownLeft <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRequestCooldownLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [requestCooldownLeft]);

  useEffect(() => {
    const transmissionId = snapshot?.transmissionId || "";
    if (!transmissionId || previousTransmissionRef.current === transmissionId) {
      if (!transmissionId) {
        closeListener();
        stopLocalStream();
      }
      return;
    }

    previousTransmissionRef.current = transmissionId;

    const shouldListen =
      snapshot.activeSpeakerId &&
      snapshot.activeSpeakerId !== participantId &&
      ((role === "umpire" && snapshot.activeSpeakerRole === "spectator") ||
        (role === "spectator" && snapshot.activeSpeakerRole === "umpire"));

    if (!shouldListen) {
      closeListener();
      return;
    }

    duckPageMedia(pageMediaDuckRef, 0.18);
    playUiTone({ frequency: 920, durationMs: 140, type: "sine", volume: 0.035 });

    const peer = createPeerConnection();
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
      });
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignal(snapshot.activeSpeakerId, {
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
      await sendSignal(snapshot.activeSpeakerId, {
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
    ensureRemoteAudio,
    participantId,
    role,
    sendSignal,
    snapshot?.activeSpeakerId,
    snapshot?.activeSpeakerRole,
    snapshot?.transmissionId,
  ]);

  useEffect(() => () => {
    closeListener();
    stopLocalStream();
  }, []);

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

    setClaiming(true);
    setError("");

    try {
      const payload = await sendJson(`/api/matches/${matchId}/walkie/claim`, {
        participantId,
        role,
        token,
      });

      primeRemoteAudio();
      duckPageMedia(pageMediaDuckRef, 0.18);
      playUiTone({ frequency: 920, durationMs: 140, type: "sine", volume: 0.035 });
      await ensureSpeakerStream();
      setSnapshot(payload.walkie || null);
      return true;
    } catch (nextError) {
      setError(nextError.message || "Could not start talking.");
      return false;
    } finally {
      setClaiming(false);
    }
  };

  const stopTalking = async () => {
    if (!matchId || !participantId || !token) {
      return;
    }

    try {
      await sendJson(`/api/matches/${matchId}/walkie/release`, {
        participantId,
        role,
        token,
      });
    } catch {
      // Best effort release; local cleanup still runs.
    } finally {
      playUiTone({ frequency: 620, durationMs: 130, type: "triangle", volume: 0.03 });
      restorePageMedia(pageMediaDuckRef);
      stopLocalStream();
      closeListener();
    }
  };

  const dismissNotice = () => setNotice("");

  const requestEnable = async () => {
    if (!matchId || !participantId || !token || role !== "spectator" || requestCooldownLeft > 0) {
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
      setNotice("Request sent to umpire.");
      return true;
    } catch (nextError) {
      setError(nextError.message || "Could not send walkie request.");
      return false;
    }
  };

  const isSelfTalking = snapshot?.activeSpeakerId === participantId;
  const isBusy = Boolean(snapshot?.busy);
  const otherSpeakerBusy = isBusy && !isSelfTalking;

  return {
    participantId,
    snapshot,
    notice,
    error,
    countdown,
    claiming,
    isSelfTalking,
    isBusy,
    otherSpeakerBusy,
    canEnable:
      role === "umpire" &&
      hasUmpireAccess,
    canRequestEnable:
      role === "spectator" &&
      !snapshot?.enabled &&
      requestCooldownLeft === 0,
    canTalk:
      Boolean(snapshot?.enabled) &&
      !otherSpeakerBusy &&
      (role === "umpire"
        ? Number(snapshot?.spectatorCount || 0) > 0
        : Number(snapshot?.umpireCount || 0) > 0),
    toggleEnabled,
    startTalking,
    stopTalking,
    requestEnable,
    requestCooldownLeft,
    dismissNotice,
  };
}
