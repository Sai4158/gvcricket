"use client";

import { useEffect, useMemo, useState } from "react";
import { FaLink, FaTrashAlt, FaYoutube } from "react-icons/fa";
import { Card } from "../DirectorConsoleChrome";
import YouTubeLiveStreamCard from "../../../shared/YouTubeLiveStreamCard";
import { normalizeYouTubeLiveStream } from "../../../../lib/youtube-live-stream";

export default function DirectorLiveStreamPanel({
  canManageSession,
  liveMatch,
  managedSession,
  onMatchUpdated,
}) {
  const matchId = String(liveMatch?._id || "");
  const sessionId = String(managedSession?.session?._id || liveMatch?.sessionId || "");
  const [draftUrl, setDraftUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const savedStream = liveMatch?.liveStream || null;

  useEffect(() => {
    setDraftUrl(String(savedStream?.inputUrl || savedStream?.watchUrl || ""));
    setMessage("");
    setError("");
  }, [savedStream?.inputUrl, savedStream?.watchUrl, matchId]);

  const previewStream = useMemo(() => {
    const normalized = normalizeYouTubeLiveStream(draftUrl);
    return normalized.ok ? normalized.value : null;
  }, [draftUrl]);

  const spectatorUrl = sessionId ? `/session/${sessionId}/view` : "";
  const inputHasChanged =
    String(draftUrl || "").trim() !==
    String(savedStream?.inputUrl || savedStream?.watchUrl || "").trim();

  const handlePaste = async () => {
    try {
      const nextValue = await navigator.clipboard.readText();
      if (nextValue) {
        setDraftUrl(nextValue.trim());
        setError("");
        setMessage("");
      }
    } catch {
      setError("Clipboard paste is not available here.");
    }
  };

  const handleSave = async () => {
    const normalized = normalizeYouTubeLiveStream(draftUrl);
    if (!normalized.ok) {
      setError(normalized.message);
      setMessage("");
      return;
    }

    if (!matchId) {
      setError("Choose a live session first.");
      setMessage("");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/matches/${matchId}/live-stream`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          liveStreamUrl: draftUrl.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Could not save the live stream.");
        return;
      }

      onMatchUpdated?.(payload);
      setDraftUrl(String(payload?.liveStream?.inputUrl || payload?.liveStream?.watchUrl || draftUrl.trim()));
      setMessage("Saved. Spectators now see this stream above the score.");
    } catch {
      setError("Could not save the live stream.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!matchId) {
      setError("Choose a live session first.");
      setMessage("");
      return;
    }

    setIsRemoving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/matches/${matchId}/live-stream`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || "Could not remove the live stream.");
        return;
      }

      onMatchUpdated?.(payload);
      setDraftUrl("");
      setMessage("Removed. Spectator and result pages no longer show the stream.");
    } catch {
      setError("Could not remove the live stream.");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card
      title="YouTube live stream"
      subtitle="Attach the match stream for spectator and result pages"
      icon={<FaYoutube />}
      accent="amber"
      help={{
        title: "YouTube live stream",
        body: "Paste any YouTube live, watch, share, embed, or shorts link. Director save updates the same match stream used on spectator and result pages.",
      }}
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(28,16,18,0.38),rgba(10,10,14,0.52))] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            YouTube link
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="url"
              value={draftUrl}
              onChange={(event) => {
                setDraftUrl(event.target.value);
                setError("");
                setMessage("");
              }}
              placeholder="Paste YouTube live link"
              disabled={!canManageSession || isSaving || isRemoving}
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-red-400/30"
            />
            <button
              type="button"
              onClick={draftUrl.trim() ? () => setDraftUrl("") : handlePaste}
              disabled={!canManageSession || isSaving || isRemoving}
              className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {draftUrl.trim() ? "Clear" : "Paste"}
            </button>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            Any saved stream shows above the score on spectator and stays on the result page after the match ends.
          </p>
        </div>

        {previewStream || savedStream ? (
          <YouTubeLiveStreamCard
            stream={previewStream || savedStream}
            minimal
            className="border-white/10"
          />
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={
              !canManageSession ||
              !draftUrl.trim() ||
              !previewStream ||
              !inputHasChanged ||
              isSaving ||
              isRemoving
            }
            className="rounded-[22px] bg-[#ff0033] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : savedStream ? "Update stream" : "Save stream"}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={!canManageSession || !savedStream || isSaving || isRemoving}
            className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </button>
          <a
            href={spectatorUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center justify-center gap-2 rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
              spectatorUrl
                ? "border-white/10 bg-white/5 text-white hover:bg-white/8"
                : "pointer-events-none border-white/8 bg-white/3 text-zinc-500"
            }`}
          >
            <FaLink className="text-xs" />
            Open spectator
          </a>
        </div>
      </div>
    </Card>
  );
}
