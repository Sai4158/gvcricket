"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getParticipantId(matchId, role) {
  if (typeof window === "undefined") {
    return "";
  }

  const key = `gv-walkie-${role}-${matchId}`;
  const existing = window.sessionStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const nextId = `${role}:${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
  window.sessionStorage.setItem(key, nextId);
  return nextId;
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
  const listenerPcRef = useRef(null);
  const speakerPeersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const previousTransmissionRef = useRef("");

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
  };

  const stopLocalStream = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    speakerPeersRef.current.forEach((peer) => {
      peer.onicecandidate = null;
      peer.close();
    });
    speakerPeersRef.current.clear();
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

    try {
      if (snapshot?.activeSpeakerId === participantId) {
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
        }

        if (payload.type === "offer" && payload.sdp) {
          await peer.setRemoteDescription({
            type: "offer",
            sdp: payload.sdp,
          });
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await sendSignal(message.fromId, {
            type: "answer",
            sdp: answer.sdp || "",
          });
        } else if (payload.type === "ice-candidate" && payload.candidate) {
          await peer.addIceCandidate({
            candidate: payload.candidate,
            sdpMid: payload.sdpMid || null,
            sdpMLineIndex: payload.sdpMLineIndex ?? null,
          });
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
      } else if (payload.type === "ice-candidate" && payload.candidate) {
        await listenerPcRef.current.addIceCandidate({
          candidate: payload.candidate,
          sdpMid: payload.sdpMid || null,
          sdpMLineIndex: payload.sdpMLineIndex ?? null,
        });
      }
    } catch (nextError) {
      setError(nextError.message || "Walkie signal failed.");
    }
  }, [participantId, sendSignal, snapshot?.activeSpeakerId]);

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
        closeListener();
        stopLocalStream();
      }
    };

    const handleError = () => {
      if (closed || source.readyState === EventSource.CLOSED) {
        return;
      }
      setError("Walkie reconnecting...");
    };

    source.addEventListener("state", handleState);
    source.addEventListener("signal", handleSignal);
    source.addEventListener("participant", handleParticipant);
    source.addEventListener("error", handleError);

    return () => {
      closed = true;
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

    const peer = createPeerConnection();
    const remoteStream = new MediaStream();
    listenerPcRef.current = peer;

    peer.ontrack = (event) => {
      remoteStream.addTrack(event.track);
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
        remoteAudioRef.current.playsInline = true;
      }
      remoteAudioRef.current.srcObject = remoteStream;
      void remoteAudioRef.current.play().catch(() => {});
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
      stopLocalStream();
      closeListener();
    }
  };

  const dismissNotice = () => setNotice("");

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
      hasUmpireAccess &&
      Number(snapshot?.spectatorCount || 0) > 0,
    canTalk:
      Boolean(snapshot?.enabled) &&
      !otherSpeakerBusy &&
      (role === "umpire"
        ? Number(snapshot?.spectatorCount || 0) > 0
        : Number(snapshot?.umpireCount || 0) > 0),
    toggleEnabled,
    startTalking,
    stopTalking,
    dismissNotice,
  };
}
