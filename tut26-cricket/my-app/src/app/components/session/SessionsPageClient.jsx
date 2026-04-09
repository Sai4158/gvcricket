"use client";

/**
 * File overview:
 * Purpose: Renders Session UI for the app's screens and flows.
 * Main exports: SessionsPageClient.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaCheck,
  FaInfoCircle,
  FaPlus,
  FaSearch,
  FaSlidersH,
  FaTrash,
  FaTimes,
} from "react-icons/fa";
import DarkSelect from "../shared/DarkSelect";
import InfoModal from "./InfoModal";
import PinModal from "./PinModal";
import LoadingButton from "../shared/LoadingButton";
import PendingLink from "../shared/PendingLink";
import SiteFooter from "../shared/SiteFooter";
import SessionCard from "./SessionCard";
import LiquidSportText from "../home/LiquidSportText";
import ImagePinModal from "../shared/ImagePinModal";
import { ModalBase } from "../match/MatchBaseModals";
import MatchImageUploader from "../match/MatchImageUploader";
import { verifyImageActionPin } from "../../lib/image-pin-client";
import { buildPinRequestError } from "../../lib/pin-attempt-client";
import { useRouteFeedback } from "../shared/RouteFeedbackProvider";

const SORT_OPTIONS = [
  { value: "live-newest", label: "Live first" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "recent-ended", label: "Recently ended" },
  { value: "a-z", label: "A to Z" },
  { value: "z-a", label: "Z to A" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "12", label: "12" },
  { value: "24", label: "24" },
  { value: "36", label: "36" },
  { value: "48", label: "48" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
];
const SESSION_SELECTION_HOLD_MS = 3000;

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function getTimestampMs(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildSearchText(session) {
  return [
    session.name,
    session.teamAName,
    session.teamBName,
    session.date,
    session.isLive ? "live live now" : "completed ended final score",
    session.result,
    session.updatedAt,
    session.createdAt,
  ]
    .map(normalizeSearchValue)
    .filter(Boolean)
    .join(" ");
}

function sortSessions(items, sortValue) {
  const sessions = [...items];
  const byUpdatedDesc = (left, right) =>
    right.__updatedAtMs - left.__updatedAtMs;

  switch (sortValue) {
    case "newest":
      return sessions.sort(byUpdatedDesc);
    case "oldest":
      return sessions.sort((left, right) => -byUpdatedDesc(left, right));
    case "recent-ended":
      return sessions.sort((left, right) => {
        if (left.isLive !== right.isLive) return left.isLive ? 1 : -1;
        return byUpdatedDesc(left, right);
      });
    case "a-z":
      return sessions.sort((left, right) =>
        left.__sortName.localeCompare(right.__sortName)
      );
    case "z-a":
      return sessions.sort((left, right) =>
        right.__sortName.localeCompare(left.__sortName)
      );
    case "live-newest":
    default:
      return sessions.sort((left, right) => {
        if (left.isLive !== right.isLive) return left.isLive ? -1 : 1;
        return byUpdatedDesc(left, right);
      });
  }
}

function EmptyState({ title, text, href, label }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,24,0.97),rgba(8,8,12,0.99))] px-6 py-12 text-center shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">{text}</p>
      {href && label ? (
        <Link
          href={href}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(10,17,26,0.96),rgba(11,31,41,0.96)_58%,rgba(15,118,110,0.78))] px-5 py-3 text-sm font-semibold text-cyan-50 shadow-[0_16px_30px_rgba(8,47,73,0.22)] transition hover:-translate-y-0.5 hover:border-cyan-200/28 hover:brightness-110"
        >
          <FaPlus />
          {label}
        </Link>
      ) : null}
    </div>
  );
}

function ActionSummaryModal({ summary, onClose }) {
  if (!summary) {
    return null;
  }

  const toneClasses =
    summary.tone === "danger"
      ? "border-rose-300/16 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.12),transparent_28%),linear-gradient(180deg,rgba(26,10,14,0.98),rgba(10,8,12,0.98))]"
      : "border-emerald-300/16 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),linear-gradient(180deg,rgba(10,24,18,0.98),rgba(8,10,12,0.98))]";
  const badgeClasses =
    summary.tone === "danger"
      ? "border-rose-300/20 bg-rose-400/12 text-rose-100"
      : "border-emerald-300/20 bg-emerald-400/12 text-emerald-100";

  return (
    <ModalBase title={summary.title} onExit={onClose} panelClassName="max-w-md">
      <div
        className={`rounded-[24px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${toneClasses}`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm shadow-[0_14px_30px_rgba(0,0,0,0.18)] ${badgeClasses}`}
          >
            <FaCheck />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-white">{summary.heading}</p>
            {summary.description ? (
              <p className="mt-1 text-sm leading-6 text-zinc-300">
                {summary.description}
              </p>
            ) : null}
          </div>
        </div>

        {summary.items?.length ? (
          <div className="mt-4 space-y-2">
            {summary.items.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-sm text-zinc-100"
              >
                {item}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
      >
        Close
      </button>
    </ModalBase>
  );
}

function describeSessionFieldChange(label, previousValue, nextValue) {
  if (previousValue === nextValue) {
    return "";
  }

  if (!previousValue) {
    return `${label}: ${nextValue}`;
  }

  return `${label}: ${previousValue} -> ${nextValue}`;
}

export default function SessionsPageClient({
  initialSessions,
  initialTotalCount = 0,
  refreshToken = "",
}) {
  const [sessions, setSessions] = useState(initialSessions ?? []);
  const [totalCount, setTotalCount] = useState(Number(initialTotalCount || 0));
  const [pinPrompt, setPinPrompt] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [managePinPrompt, setManagePinPrompt] = useState(null);
  const [manageSessionContext, setManageSessionContext] = useState(null);
  const [manageForm, setManageForm] = useState({
    name: "",
    teamAName: "",
    teamBName: "",
  });
  const [manageSubmitting, setManageSubmitting] = useState(false);
  const [manageError, setManageError] = useState("");
  const [imageActionContext, setImageActionContext] = useState(null);
  const [imageDeleteContext, setImageDeleteContext] = useState(null);
  const [imageReplaceContext, setImageReplaceContext] = useState(null);
  const [imageActionError, setImageActionError] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [selectionError, setSelectionError] = useState("");
  const [bulkDeletePromptOpen, setBulkDeletePromptOpen] = useState(false);
  const [actionSummary, setActionSummary] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("live-newest");
  const [filterBy, setFilterBy] = useState("all");
  const [pageSizeValue, setPageSizeValue] = useState("24");
  const [page, setPage] = useState(1);
  const [isGoingHome, setIsGoingHome] = useState(false);
  const router = useRouter();
  const { startNavigation } = useRouteFeedback();
  const deferredSearchQuery = useDeferredValue(normalizeSearchValue(searchInput));
  const secretHoldTimerRef = useRef(null);
  const suppressCardOpenUntilRef = useRef(0);

  const setSecretHoldSelectionLock = useCallback((locked) => {
    if (typeof document === "undefined") {
      return;
    }

    [document.body, document.documentElement].forEach((node) => {
      if (!node) {
        return;
      }

      if (locked) {
        node.style.setProperty("user-select", "none");
        node.style.setProperty("-webkit-user-select", "none");
        node.style.setProperty("-webkit-touch-callout", "none");
      } else {
        node.style.removeProperty("user-select");
        node.style.removeProperty("-webkit-user-select");
        node.style.removeProperty("-webkit-touch-callout");
      }
    });
  }, []);

  useEffect(() => {
    setSessions(initialSessions ?? []);
  }, [initialSessions]);

  useEffect(() => {
    setTotalCount(Number(initialTotalCount || 0));
  }, [initialTotalCount]);

  useEffect(() => {
    setSelectedSessionIds((current) =>
      current.filter((sessionId) =>
        (initialSessions ?? []).some((session) => session._id === sessionId)
      )
    );
  }, [initialSessions]);

  useEffect(() => {
    setSearchQuery(deferredSearchQuery);
    setPage(1);
  }, [deferredSearchQuery]);

  useEffect(() => {
    setPage(1);
  }, [filterBy, pageSizeValue, sortBy]);

  useEffect(() => {
    return () => {
      if (secretHoldTimerRef.current) {
        window.clearTimeout(secretHoldTimerRef.current);
        secretHoldTimerRef.current = null;
      }
      setSecretHoldSelectionLock(false);
    };
  }, [setSecretHoldSelectionLock]);

  const indexedSessions = useMemo(
    () =>
      sessions.map((session) => {
        const updatedAtMs = getTimestampMs(session.updatedAt || session.createdAt);
        return {
          ...session,
          __searchText: buildSearchText(session),
          __sortName: normalizeSearchValue(session.name || ""),
          __updatedAtMs: updatedAtMs,
        };
      }),
    [sessions]
  );

  const searchTerms = useMemo(
    () => searchQuery.split(/\s+/).filter(Boolean),
    [searchQuery]
  );

  const filteredSessions = useMemo(() => {
    const searched = searchTerms.length
      ? indexedSessions.filter((session) =>
          searchTerms.every((term) => session.__searchText.includes(term))
        )
      : indexedSessions;

    const filtered = searched.filter((session) => {
      if (filterBy === "live") return session.isLive;
      if (filterBy === "completed") return !session.isLive;
      return true;
    });

    return sortSessions(filtered, sortBy);
  }, [filterBy, indexedSessions, searchTerms, sortBy]);

  const pageSize = Number(pageSizeValue);
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredSessions.length ? (currentPage - 1) * pageSize : 0;
  const paginatedSessions = filteredSessions.slice(pageStart, pageStart + pageSize);
  const showingFrom = filteredSessions.length ? pageStart + 1 : 0;
  const showingTo = filteredSessions.length
    ? Math.min(filteredSessions.length, pageStart + pageSize)
    : 0;
  const totalSessionCount =
    Number.isFinite(totalCount) && totalCount > 0 ? totalCount : sessions.length;
  const filteredSessionCount = filteredSessions.length;
  const totalSessionsLabel = `${totalSessionCount} ${
    totalSessionCount === 1 ? "session" : "sessions"
  }`;
  const filteredSessionsLabel = `${filteredSessionCount} ${
    filteredSessionCount === 1 ? "session" : "sessions"
  }`;
  const isFilteredView = filterBy !== "all" || Boolean(searchQuery);
  const imageReplaceSession = imageReplaceContext
    ? sessions.find((session) => session._id === imageReplaceContext.sessionId) || null
    : null;
  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.includes(session._id)),
    [selectedSessionIds, sessions]
  );
  const selectedSessionForManage =
    selectedSessions.length === 1 ? selectedSessions[0] : null;

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!selectionMode) {
      return;
    }

    if (!selectedSessionIds.length) {
      setSelectionMode(false);
      setSelectionError("");
    }
  }, [selectedSessionIds.length, selectionMode]);

  const handleOpenUmpirePin = useCallback((nextSession) => {
    setPinError("");
    setPinPrompt({ mode: "umpire", session: nextSession });
  }, []);

  const handleOpenDirectorPin = useCallback((nextSession) => {
    setPinError("");
    setPinPrompt({ mode: "director", session: nextSession });
  }, []);

  const mergeMatchImageUpdateIntoSession = useCallback((sessionId, updatedMatch) => {
    setSessions((current) =>
      current.map((session) =>
        session._id === sessionId
          ? {
              ...session,
              matchImageUrl: updatedMatch?.matchImageUrl || "",
              matchImages: Array.isArray(updatedMatch?.matchImages)
                ? updatedMatch.matchImages
                : [],
              updatedAt: updatedMatch?.updatedAt || session.updatedAt,
            }
          : session
      )
    );
  }, []);

  const mergeSessionUpdateIntoList = useCallback((updatedSession) => {
    if (!updatedSession?._id) {
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session._id === updatedSession._id
          ? {
              ...session,
              ...updatedSession,
            }
          : session
      )
    );
  }, []);

  const removeSessionsFromList = useCallback((sessionIds) => {
    const normalizedIds = Array.isArray(sessionIds)
      ? sessionIds.map((value) => String(value || "")).filter(Boolean)
      : [];
    if (!normalizedIds.length) {
      return;
    }

    const removedIdSet = new Set(normalizedIds);
    setSessions((current) =>
      current.filter((session) => !removedIdSet.has(String(session._id || "")))
    );
    setTotalCount((current) =>
      Math.max(0, Number(current || 0) - removedIdSet.size)
    );
  }, []);

  const handleOpenImageActions = useCallback((session, image) => {
    if (!session?.match) {
      return;
    }

    setImageActionError("");
    setImageActionContext({
      sessionId: session._id,
      matchId: session.match,
      image,
    });
  }, []);

  const closeImageActionFlows = useCallback(() => {
    setImageActionContext(null);
    setImageDeleteContext(null);
    setImageReplaceContext(null);
    setImageActionError("");
  }, []);

  const clearSecretHoldTimer = useCallback(() => {
    if (secretHoldTimerRef.current) {
      window.clearTimeout(secretHoldTimerRef.current);
      secretHoldTimerRef.current = null;
    }
    setSecretHoldSelectionLock(false);
  }, [setSecretHoldSelectionLock]);

  const clearSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedSessionIds([]);
    setSelectionError("");
    setBulkDeletePromptOpen(false);
  }, []);

  const toggleSessionSelection = useCallback((sessionId) => {
    setSelectionError("");
    setSelectedSessionIds((current) => {
      if (current.includes(sessionId)) {
        return current.filter((value) => value !== sessionId);
      }

      if (current.length >= 15) {
        setSelectionError("You can select up to 15 sessions at once.");
        return current;
      }

      return [...current, sessionId];
    });
  }, []);

  const startSelectionMode = useCallback((session) => {
    if (!session?._id) {
      return;
    }

    suppressCardOpenUntilRef.current = Date.now() + 1200;
    setSelectionMode(true);
    setSelectionError("");
    setSelectedSessionIds((current) => {
      if (current.includes(session._id)) {
        return current;
      }
      if (current.length >= 15) {
        setSelectionError("You can select up to 15 sessions at once.");
        return current;
      }
      return [...current, session._id];
    });
  }, []);

  const handleSecretManageHoldStart = useCallback(
    (session, event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("button,a,input,textarea,select,label")
      ) {
        return;
      }

      clearSecretHoldTimer();
      if (event.pointerType && event.pointerType !== "mouse") {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setSecretHoldSelectionLock(true);
      }
      secretHoldTimerRef.current = window.setTimeout(() => {
        setSecretHoldSelectionLock(false);
        setManagePinPrompt({
          mode: "select",
          session,
        });
      }, SESSION_SELECTION_HOLD_MS);
    },
    [clearSecretHoldTimer, setSecretHoldSelectionLock]
  );

  const handleSecretManageHoldEnd = useCallback(() => {
    clearSecretHoldTimer();
  }, [clearSecretHoldTimer]);

  const shouldBlockCardOpen = useCallback(
    () => selectionMode || Date.now() < suppressCardOpenUntilRef.current,
    [selectionMode]
  );

  const handleGoHome = useCallback(() => {
    setIsGoingHome(true);
    startNavigation("Opening home...");
    router.replace("/");
  }, [router, startNavigation]);

  const reloadSessionsFromServer = useCallback(async ({ forceFresh = false } = {}) => {
    const requestUrl = forceFresh
      ? `/api/sessions?fresh=1&t=${Date.now()}`
      : "/api/sessions";
    const response = await fetch(requestUrl, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store",
      },
    });

    if (!response.ok) {
      throw new Error("Could not refresh sessions.");
    }

    const payload = await response
      .json()
      .catch(() => []);

    if (!Array.isArray(payload)) {
      throw new Error("Could not refresh sessions.");
    }

    const nextTotalCount = Number(
      response.headers.get("X-Total-Count") || payload.length || 0
    );

    setSessions(payload);
    setTotalCount(Number.isFinite(nextTotalCount) ? nextTotalCount : payload.length);
    return payload;
  }, []);

  useEffect(() => {
    if (!String(refreshToken || "").trim()) {
      return;
    }

    void reloadSessionsFromServer();
  }, [refreshToken, reloadSessionsFromServer]);

  const openSessionManager = useCallback((session, pin) => {
    setManageSessionContext({ sessionId: session._id, pin });
    setManageForm({
      name: session.name || "",
      teamAName: session.teamAName || "",
      teamBName: session.teamBName || "",
    });
    setManageError("");
  }, []);

  const handleManagePinSubmit = useCallback(
    async (pin) => {
      if (!managePinPrompt?.session?._id) {
        return;
      }

      const response = await fetch("/api/media/pin-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const payload = await response
        .json()
        .catch(() => ({ message: "Incorrect PIN." }));

      if (!response.ok) {
        throw buildPinRequestError(response, payload, "Incorrect PIN.");
      }

      const session = managePinPrompt.session;
      setManagePinPrompt(null);
      if (managePinPrompt.mode === "select") {
        startSelectionMode(session);
        return;
      }
      openSessionManager(session, pin);
    },
    [managePinPrompt, openSessionManager, startSelectionMode]
  );

  const closeSessionManager = useCallback(() => {
    setManageSessionContext(null);
    setManageError("");
    setManageSubmitting(false);
  }, []);

  const handleManageFieldChange = useCallback((field, value) => {
    setManageForm((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const handleManageSessionSave = useCallback(async () => {
    if (!manageSessionContext?.sessionId || manageSubmitting) {
      return;
    }

    setManageSubmitting(true);
    setManageError("");

    try {
      const previousSession =
        sessions.find((session) => session._id === manageSessionContext.sessionId) || null;
      const response = await fetch(
        `/api/sessions/${manageSessionContext.sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin: manageSessionContext.pin,
            name: manageForm.name.trim(),
            teamAName: manageForm.teamAName.trim(),
            teamBName: manageForm.teamBName.trim(),
          }),
        }
      );
      const payload = await response
        .json()
        .catch(() => ({ message: "Could not update session." }));

      if (!response.ok) {
        throw new Error(payload.message || "Could not update session.");
      }

      const changedItems = [
        describeSessionFieldChange(
          "Game name",
          previousSession?.name || "",
          payload.name || manageForm.name.trim()
        ),
        describeSessionFieldChange(
          "Team A",
          previousSession?.teamAName || "",
          payload.teamAName || manageForm.teamAName.trim()
        ),
        describeSessionFieldChange(
          "Team B",
          previousSession?.teamBName || "",
          payload.teamBName || manageForm.teamBName.trim()
        ),
      ].filter(Boolean);

      mergeSessionUpdateIntoList({
        ...previousSession,
        ...payload,
      });

      closeSessionManager();
      setActionSummary({
        title: "Session Updated",
        heading: payload.name || previousSession?.name || "Session updated",
        description: changedItems.length
          ? "These changes were saved."
          : "The session details were saved.",
        items: changedItems,
        tone: "success",
      });
      void reloadSessionsFromServer({ forceFresh: true }).catch(() => {});
    } catch (error) {
      setManageError(error.message || "Could not update session.");
    } finally {
      setManageSubmitting(false);
    }
  }, [closeSessionManager, manageForm.name, manageForm.teamAName, manageForm.teamBName, manageSessionContext, manageSubmitting, mergeSessionUpdateIntoList, reloadSessionsFromServer, sessions]);

  const handleManageSessionDelete = useCallback(async () => {
    if (!manageSessionContext?.sessionId || manageSubmitting) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this session and its match permanently?"
    );
    if (!confirmed) {
      return;
    }

    setManageSubmitting(true);
    setManageError("");

    try {
      const deletedSession =
        sessions.find((session) => session._id === manageSessionContext.sessionId) || null;
      const response = await fetch(
        `/api/sessions/${manageSessionContext.sessionId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: manageSessionContext.pin }),
        }
      );
      const payload = await response
        .json()
        .catch(() => ({ message: "Could not delete session." }));

      if (!response.ok) {
        throw new Error(payload.message || "Could not delete session.");
      }

      removeSessionsFromList([manageSessionContext.sessionId]);
      setPage(1);
      closeSessionManager();
      setActionSummary({
        title: "Session Deleted",
        heading: deletedSession?.name || "Session removed",
        description: "The session and any linked match were deleted.",
        items: deletedSession
          ? [
              deletedSession.teamAName && deletedSession.teamBName
                ? `${deletedSession.teamAName} vs ${deletedSession.teamBName}`
                : "",
            ].filter(Boolean)
          : [],
        tone: "danger",
      });
      void reloadSessionsFromServer({ forceFresh: true }).catch(() => {});
    } catch (error) {
      setManageError(error.message || "Could not delete session.");
    } finally {
      setManageSubmitting(false);
    }
  }, [closeSessionManager, manageSessionContext, manageSubmitting, reloadSessionsFromServer, removeSessionsFromList, sessions]);

  const handleBulkDeleteSessions = useCallback(
    async (pin) => {
      if (!selectedSessionIds.length) {
        throw new Error("Select at least 1 session.");
      }
      const selectedSessionSnapshot = sessions.filter((session) =>
        selectedSessionIds.includes(session._id)
      );

      const response = await fetch("/api/sessions/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionIds: selectedSessionIds,
          pin,
        }),
      });
      const payload = await response
        .json()
        .catch(() => ({ message: "Could not delete the selected sessions." }));

      if (!response.ok) {
        throw buildPinRequestError(
          response,
          payload,
          "Could not delete the selected sessions.",
        );
      }

      const deletedIds = Array.isArray(payload.deletedSessionIds)
        ? payload.deletedSessionIds.map((value) => String(value))
        : [];
      const removedIds = deletedIds.length ? deletedIds : selectedSessionIds;

      removeSessionsFromList(removedIds);
      setPage(1);
      clearSelectionMode();
      setBulkDeletePromptOpen(false);
      setActionSummary({
        title: "Sessions Deleted",
        heading: `${removedIds.length} session${removedIds.length === 1 ? "" : "s"} removed`,
        description: "The selected sessions were deleted.",
        items: selectedSessionSnapshot
          .map((session) => session.name || "")
          .filter(Boolean)
          .slice(0, 6),
        tone: "danger",
      });
      void reloadSessionsFromServer({ forceFresh: true }).catch(() => {});
    },
    [clearSelectionMode, reloadSessionsFromServer, removeSessionsFromList, selectedSessionIds, sessions]
  );

  const handleDeleteSessionImage = useCallback(
    async (pin) => {
      if (!imageDeleteContext?.matchId) {
        throw new Error("Match image is not ready.");
      }

      await verifyImageActionPin({
        pin,
        usesManagePin: true,
      });

      const response = await fetch(
        `/api/matches/${imageDeleteContext.matchId}/image`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin,
            imageId: imageDeleteContext.image?.id || "",
          }),
        }
      );
      const payload = await response
        .json()
        .catch(() => ({ message: "Could not remove the image." }));

      if (!response.ok) {
        throw buildPinRequestError(
          response,
          payload,
          "Could not remove the image.",
        );
      }

      mergeMatchImageUpdateIntoSession(imageDeleteContext.sessionId, payload);
      closeImageActionFlows();
    },
    [closeImageActionFlows, imageDeleteContext, mergeMatchImageUpdateIntoSession]
  );

  const handlePinSubmit = async (pin) => {
    if (!pinPrompt?.session?.match || !pinPrompt.session.isLive) return;

    setPinSubmitting(true);
    setPinError("");

    try {
      if (pinPrompt.mode === "director") {
        const response = await fetch("/api/director/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });

        if (!response.ok) {
          const payload = await response
            .json()
            .catch(() => ({ message: "Incorrect PIN." }));
          throw buildPinRequestError(response, payload, "Incorrect PIN.");
        }

        const directorSessionId = pinPrompt.session._id;
        startNavigation("Opening director mode...");
        router.push(`/director?session=${directorSessionId}&manage=1`);
        setPinPrompt(null);
        return;
      }

      const response = await fetch(`/api/matches/${pinPrompt.session.match}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ message: "Incorrect PIN." }));
        throw buildPinRequestError(response, payload, "Incorrect PIN.");
      }

      const needsToss = !pinPrompt.session.tossReady;
      startNavigation(needsToss ? "Opening toss..." : "Opening umpire mode...");
      router.push(
        needsToss ? `/toss/${pinPrompt.session.match}` : `/match/${pinPrompt.session.match}`
      );
      setPinPrompt(null);
    } catch (error) {
      setPinError(error.message);
      throw error;
    } finally {
      setPinSubmitting(false);
    }
  };

  if (!sessions.length) {
    return (
      <main id="top" className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_22%),radial-gradient(circle_at_82%_14%,rgba(14,165,233,0.1),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%),linear-gradient(180deg,#16181d_0%,#090a0f_100%)] px-5 py-8 text-zinc-100">
        <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
          <EmptyState
            title="No sessions yet"
            text="Create a new match to start scoring, track live sessions, and keep results in one place."
            href="/session/new"
            label="Create session"
          />
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main
      id="top"
      className={`min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_20%),radial-gradient(circle_at_86%_10%,rgba(14,165,233,0.1),transparent_20%),radial-gradient(circle_at_16%_88%,rgba(16,185,129,0.08),transparent_20%),linear-gradient(180deg,#1b1d23_0%,#09090d_100%)] px-4 pb-10 text-zinc-100 sm:px-6 lg:px-8 ${
        selectionMode ? "pt-28 sm:pt-32" : "pt-6"
      }`}
    >
      <div className="mx-auto max-w-[1680px]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <LoadingButton
            type="button"
            onClick={handleGoHome}
            loading={isGoingHome}
            pendingLabel="Opening..."
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200/18 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))]"
          >
            <FaArrowLeft />
            <span>Back</span>
          </LoadingButton>
          <PendingLink
            href="/session/new"
            pendingLabel="Opening new session..."
            pendingClassName="pending-shimmer"
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,rgba(20,22,28,0.96),rgba(9,10,15,0.98))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(0,0,0,0.26)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200/26 hover:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_34%),linear-gradient(180deg,rgba(24,26,33,0.98),rgba(11,12,18,1))]"
          >
            {({ pending, spinner }) => (
              <>
                {pending ? spinner : <FaPlus className="text-sky-300" />}
                <span>{pending ? "Opening..." : "New Session"}</span>
              </>
            )}
          </PendingLink>
        </div>

        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.06),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.05),transparent_24%),linear-gradient(180deg,rgba(13,14,20,0.98),rgba(8,8,12,0.99))] px-5 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <LiquidSportText
                  as="h1"
                  text="All Sessions"
                  variant="hero-bright"
                  simplifyMotion
                  className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl"
                  lineClassName="leading-[0.94]"
                />
                <button
                  onClick={() => setIsInfoModalOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] text-zinc-300 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-cyan-300/18 hover:text-cyan-200"
                  aria-label="Session status help"
                >
                  <FaInfoCircle size={18} />
                </button>
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                {isFilteredView
                  ? `${filteredSessionsLabel} visible of ${totalSessionsLabel}`
                  : `${totalSessionsLabel} total`}
              </p>
            </div>
          </div>

          <div className="sticky top-4 z-10 mt-6 rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.06),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.05),transparent_22%),linear-gradient(180deg,rgba(16,16,20,0.9),rgba(8,8,12,0.94))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <label className="relative flex min-w-0 flex-1 items-center">
                <FaSearch className="pointer-events-none absolute left-4 text-zinc-500" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search sessions, teams, or date"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] pl-11 pr-4 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/24 focus:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] focus:shadow-[0_0_0_1px_rgba(34,211,238,0.18)] sm:text-sm"
                  aria-label="Search sessions"
                  autoComplete="off"
                />
              </label>

              <div className="shrink-0">
                <DarkSelect
                  value={sortBy}
                  onChange={(value) => {
                    setSortBy(value);
                    setPage(1);
                  }}
                  options={SORT_OPTIONS}
                  ariaLabel="Sort sessions"
                  leadingIcon={FaSlidersH}
                  compact
                  iconOnly
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {FILTER_OPTIONS.map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => {
                    setFilterBy(pill.value);
                    setPage(1);
                  }}
                  className={`press-feedback rounded-full px-4 py-2 text-sm font-semibold transition ${
                    filterBy === pill.value
                      ? "border border-cyan-200/24 bg-[linear-gradient(135deg,rgba(245,252,255,0.96),rgba(211,238,248,0.9)_60%,rgba(245,158,11,0.26))] text-black shadow-[0_10px_20px_rgba(255,255,255,0.14)]"
                      : "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] text-zinc-300 hover:-translate-y-0.5 hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))]"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

        </section>

        <div className="mt-8">
          {!filteredSessions.length ? (
            <EmptyState
              title={searchQuery ? "No matching sessions" : "No sessions in this view"}
              text={
                searchQuery
                  ? "Try a different session name, team name, or date."
                  : filterBy === "live"
                  ? "No live sessions right now. Completed matches will still appear in All."
                  : "There are no completed sessions yet."
              }
              href="/session/new"
              label="Create New Match"
            />
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5 2xl:gap-6">
                {paginatedSessions.map((session) => (
                  <div
                    key={session._id}
                    className="h-full select-none [touch-action:pan-y]"
                    style={{ WebkitTouchCallout: "none" }}
                    onPointerDown={(event) =>
                      handleSecretManageHoldStart(session, event)
                    }
                    onPointerUp={handleSecretManageHoldEnd}
                    onPointerLeave={handleSecretManageHoldEnd}
                    onPointerCancel={handleSecretManageHoldEnd}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <SessionCard
                      session={session}
                      onUmpireClick={handleOpenUmpirePin}
                      onDirectorClick={handleOpenDirectorPin}
                      shouldBlockCardOpen={shouldBlockCardOpen}
                      onImageHold={handleOpenImageActions}
                      selectionMode={selectionMode}
                      selected={selectedSessionIds.includes(session._id)}
                      onSelectToggle={toggleSessionSelection}
                    />
                  </div>
                ))}
              </div>

              <section className="mt-8 rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.06),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.05),transparent_22%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      Showing {showingFrom}-{showingTo} of{" "}
                      {isFilteredView ? filteredSessionsLabel : totalSessionsLabel}
                    </p>
                    {isFilteredView ? (
                      <p className="mt-1 text-sm text-zinc-500">
                        {totalSessionsLabel} in database
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-zinc-500">
                      Page {currentPage} of {totalPages}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-[140px]">
                      <DarkSelect
                        value={pageSizeValue}
                        onChange={(value) => {
                          setPageSizeValue(value);
                          setPage(1);
                        }}
                        options={PAGE_SIZE_OPTIONS}
                        ariaLabel="Sessions per page"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={currentPage <= 1}
                        className="press-feedback rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={currentPage >= totalPages}
                        className="press-feedback rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {selectionMode ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4 sm:top-4 sm:px-6">
          <div className="pointer-events-auto w-full max-w-5xl overflow-hidden rounded-[26px] border border-cyan-300/12 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_22%),linear-gradient(180deg,rgba(14,14,18,0.96),rgba(8,8,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
            <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-cyan-200/16 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                    Selection
                  </span>
                  <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white">
                    {selectedSessionIds.length} selected
                  </span>
                  {selectionError ? (
                    <span className="text-xs font-medium text-rose-300">
                      {selectionError}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">Up to 15</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                {selectedSessionForManage ? (
                  <button
                    type="button"
                    onClick={() =>
                      setManagePinPrompt({
                        mode: "manage",
                        session: selectedSessionForManage,
                      })
                    }
                    className="press-feedback rounded-2xl border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(12,24,34,0.96),rgba(8,47,73,0.82))] px-4 py-2.5 text-sm font-semibold text-cyan-50"
                  >
                    Manage
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setBulkDeletePromptOpen(true)}
                  disabled={!selectedSessionIds.length}
                  className="press-feedback inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/18 bg-[linear-gradient(180deg,rgba(82,15,28,0.98),rgba(127,29,29,0.9))] px-4 py-2.5 text-sm font-semibold text-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaTrash />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={clearSelectionMode}
                  className="press-feedback inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-200 transition hover:bg-white/[0.08]"
                  aria-label="Close selection mode"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {pinPrompt ? (
          <PinModal
            onPinSubmit={handlePinSubmit}
            onExit={() => {
              setPinPrompt(null);
              setPinError("");
            }}
            isSubmitting={pinSubmitting}
            error={pinError}
            mode={pinPrompt.mode}
            theme={pinPrompt.mode === "director" ? "emerald" : "sky"}
            title={
              pinPrompt.mode === "director" ? "Director Mode PIN" : "Umpire Mode PIN"
            }
            description={
              pinPrompt.mode === "director"
                ? "Enter the director PIN to join director mode for this live match. More than one director can open the same match."
                : "Enter the PIN to access scoring controls."
            }
            submitLabel={
              pinPrompt.mode === "director" ? "Join Director Mode" : "Enter Umpire Mode"
            }
            rateLimitScope={
              pinPrompt.mode === "director"
                ? "director-auth"
                : pinPrompt.session?.match
                  ? `match-auth:${pinPrompt.session.match}`
                  : "match-auth"
            }
          />
        ) : null}
        {managePinPrompt ? (
          <ImagePinModal
            isOpen={Boolean(managePinPrompt)}
            title={
              managePinPrompt.mode === "select"
                ? "Select Sessions"
                : "Manage Session"
            }
            subtitle={
              managePinPrompt.mode === "select"
                ? "Enter the 6-digit manage PIN to unlock session selection."
                : "Enter the 6-digit manage PIN to edit or delete this session."
            }
            confirmLabel={
              managePinPrompt.mode === "select" ? "Unlock Selection" : "Continue"
            }
            digitCount={6}
            pinLabel="Manage PIN"
            placeholder="- - - - - -"
            rateLimitScope="session-manage-pin"
            onConfirm={handleManagePinSubmit}
            onClose={() => {
              setManagePinPrompt(null);
            }}
          />
        ) : null}
        {bulkDeletePromptOpen ? (
          <ImagePinModal
            isOpen={bulkDeletePromptOpen}
            title="Delete Sessions"
            subtitle={`Enter the 6-digit manage PIN to delete ${selectedSessionIds.length} selected session${selectedSessionIds.length === 1 ? "" : "s"}.`}
            summaryTitle="Selected Sessions"
            summaryItems={selectedSessions
              .map((session) => {
                const teams =
                  session.teamAName && session.teamBName
                    ? `${session.teamAName} vs ${session.teamBName}`
                    : "";
                return [session.name, teams].filter(Boolean).join(" · ");
              })
              .filter(Boolean)}
            confirmLabel="Delete Sessions"
            digitCount={6}
            pinLabel="Manage PIN"
            placeholder="- - - - - -"
            rateLimitScope="session-bulk-delete-pin"
            onConfirm={handleBulkDeleteSessions}
            onClose={() => setBulkDeletePromptOpen(false)}
          />
        ) : null}
        {manageSessionContext ? (
          <ModalBase
            title="Session Manager"
            onExit={closeSessionManager}
            panelClassName="max-w-md"
          >
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Game Name
                </span>
                <input
                  type="text"
                  value={manageForm.name}
                  onChange={(event) =>
                    handleManageFieldChange("name", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-emerald-300/28 focus:bg-white/[0.06]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Team A
                </span>
                <input
                  type="text"
                  value={manageForm.teamAName}
                  onChange={(event) =>
                    handleManageFieldChange("teamAName", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-emerald-300/28 focus:bg-white/[0.06]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Team B
                </span>
                <input
                  type="text"
                  value={manageForm.teamBName}
                  onChange={(event) =>
                    handleManageFieldChange("teamBName", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-emerald-300/28 focus:bg-white/[0.06]"
                />
              </label>
              {manageError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {manageError}
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LoadingButton
                  type="button"
                  onClick={handleManageSessionSave}
                  disabled={
                    !manageForm.name.trim() ||
                    !manageForm.teamAName.trim() ||
                    !manageForm.teamBName.trim()
                  }
                  loading={manageSubmitting}
                  pendingLabel="Saving..."
                  className="rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#059669_100%)] px-5 py-3 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Changes
                </LoadingButton>
                <button
                  type="button"
                  onClick={() => void handleManageSessionDelete()}
                  disabled={manageSubmitting}
                  className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-5 py-3 font-semibold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete Session
                </button>
              </div>
            </div>
          </ModalBase>
        ) : null}
        {imageActionContext ? (
          <ModalBase
            title="Match Images"
            onExit={closeImageActionFlows}
            panelClassName="max-w-sm"
          >
            <div className="space-y-3">
              {imageActionError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {imageActionError}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setImageReplaceContext({
                    ...imageActionContext,
                    mode: "add",
                  });
                  setImageActionContext(null);
                }}
                className="w-full rounded-2xl border border-emerald-300/16 bg-[linear-gradient(180deg,rgba(10,18,18,0.98),rgba(9,32,28,0.96)_56%,rgba(6,95,70,0.74))] px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:brightness-110"
              >
                Add Image
              </button>
              {imageActionContext.image?.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setImageReplaceContext({
                        ...imageActionContext,
                        mode: "replace",
                      });
                      setImageActionContext(null);
                    }}
                    className="w-full rounded-2xl border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(10,16,26,0.96),rgba(8,47,73,0.78))] px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:brightness-110"
                  >
                    Replace This Image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageDeleteContext(imageActionContext);
                      setImageActionContext(null);
                    }}
                    className="w-full rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
                  >
                    Delete This Image
                  </button>
                </>
              ) : null}
            </div>
          </ModalBase>
        ) : null}
        {imageReplaceContext ? (
          <ModalBase
            onExit={undefined}
            hideHeader
            panelClassName="max-w-md"
            bodyClassName="max-h-[calc(100vh-7rem)]"
          >
            <MatchImageUploader
              matchId={String(imageReplaceContext.matchId)}
              existingImages={Array.isArray(imageReplaceSession?.matchImages) ? imageReplaceSession.matchImages : []}
              existingImageUrl={
                imageReplaceContext.mode === "replace"
                  ? imageReplaceContext.image?.url || ""
                  : ""
              }
              existingImageCount={Array.isArray(imageReplaceSession?.matchImages) ? imageReplaceSession.matchImages.length : 0}
              targetImageId={
                imageReplaceContext.mode === "replace"
                  ? imageReplaceContext.image?.id || ""
                  : ""
              }
              appendOnUpload={imageReplaceContext.mode !== "replace"}
              onUploaded={(updatedMatch) => {
                mergeMatchImageUpdateIntoSession(
                  imageReplaceContext.sessionId,
                  updatedMatch
                );
              }}
              onComplete={() => {
                closeImageActionFlows();
              }}
              onRequestClose={closeImageActionFlows}
              title="Match Gallery"
              description="Manage session images."
              primaryLabel="Save Images"
              promptForUploadPin
            />
          </ModalBase>
        ) : null}
        {imageDeleteContext ? (
          <ImagePinModal
            isOpen={Boolean(imageDeleteContext)}
            title="Delete image"
            subtitle="Enter the 6-digit manage PIN to remove this image."
            confirmLabel="Delete image"
            digitCount={6}
            pinLabel="Manage PIN"
            placeholder="- - - - - -"
            rateLimitScope={
              imageDeleteContext?.matchId
                ? `match-image-delete:${imageDeleteContext.matchId}`
                : "match-image-delete"
            }
            onConfirm={handleDeleteSessionImage}
            onClose={closeImageActionFlows}
          />
        ) : null}
        {isInfoModalOpen ? (
          <InfoModal onExit={() => setIsInfoModalOpen(false)} />
        ) : null}
        {actionSummary ? (
          <ActionSummaryModal
            summary={actionSummary}
            onClose={() => setActionSummary(null)}
          />
        ) : null}
      </AnimatePresence>
      <SiteFooter className="mt-16" />
    </main>
  );
}


