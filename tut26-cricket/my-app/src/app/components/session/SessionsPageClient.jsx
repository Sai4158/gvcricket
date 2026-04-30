"use client";

/**
 * File overview:
 * Purpose: Renders Session UI for the app's screens and flows.
 * Main exports: SessionsPageClient.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Reading guide:
 * - top: session list constants and small helpers
 * - middle: page state, filters, paging, and modal state
 * - bottom: click handlers, requests, and page UI
 * Read next: ./README.md
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
  FaYoutube,
} from "react-icons/fa";
import { LuClipboardPaste } from "react-icons/lu";
import DarkSelect from "../shared/DarkSelect";
import LoadingButton from "../shared/LoadingButton";
import PendingLink from "../shared/PendingLink";
import SessionCard from "./SessionCard";
import { verifyImageActionPin } from "../../lib/image-pin-client";
import { buildPinRequestError } from "../../lib/pin-attempt-client";
import { normalizeYouTubeLiveStream } from "../../lib/youtube-live-stream";
import { useRouteFeedback } from "../shared/RouteFeedbackProvider";

const InfoModal = dynamic(() => import("./InfoModal"), { ssr: false });
const PinModal = dynamic(() => import("./PinModal"), { ssr: false });
const SiteFooter = dynamic(() => import("../shared/SiteFooter"));
const ImagePinModal = dynamic(() => import("../shared/ImagePinModal"), {
  ssr: false,
});
const ModalBase = dynamic(
  () => import("../match/MatchBaseModals").then((module) => module.ModalBase),
  { ssr: false },
);
const MatchImageUploader = dynamic(
  () => import("../match/MatchImageUploader"),
  {
    ssr: false,
  },
);
const LiquidSportText = dynamic(() => import("../home/LiquidSportText"), {
  loading: () => (
    <span className="relative z-10 block text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
      All Sessions
    </span>
  ),
});

const SORT_OPTIONS = [
  { value: "live-newest", label: "Live first" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "recent-ended", label: "Recently ended" },
  { value: "a-z", label: "A to Z" },
  { value: "z-a", label: "Z to A" },
];

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "28", label: "Show 28" },
  { value: "48", label: "Show 48" },
  { value: "58", label: "Show 58" },
  { value: "68", label: "Show 68" },
];
const SESSIONS_PAGE_SIZE = 28;
const EMPTY_MANAGE_FORM = {
  name: "",
  teamAName: "",
  teamBName: "",
  liveStreamUrl: "",
};

// Small helpers for search and sorting.
function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildVisiblePageNumbers(currentPage, totalPages, maxVisible = 5) {
  const safeCurrent = Math.max(1, Number(currentPage || 1));
  const safeTotal = Math.max(1, Number(totalPages || 1));
  const windowSize = Math.max(1, Math.min(maxVisible, safeTotal));
  const halfWindow = Math.floor(windowSize / 2);
  let start = Math.max(1, safeCurrent - halfWindow);
  let end = start + windowSize - 1;

  if (end > safeTotal) {
    end = safeTotal;
    start = Math.max(1, end - windowSize + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

// Card shown when there are no sessions to show.
function EmptyState({ title, text, href, label }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,24,0.97),rgba(8,8,12,0.99))] px-6 py-12 text-center shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
        {text}
      </p>
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

function SessionsGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5 2xl:gap-6">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={`session-skeleton-${index}`}
          className="overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.05),transparent_20%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] p-6 shadow-[0_20px_44px_rgba(0,0,0,0.24)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="h-8 w-40 animate-pulse rounded-2xl bg-white/10" />
              <div className="mt-4 h-5 w-52 animate-pulse rounded-xl bg-white/8" />
              <div className="mt-3 h-4 w-32 animate-pulse rounded-xl bg-white/6" />
            </div>
            <div className="w-20 shrink-0">
              <div className="ml-auto h-12 w-20 animate-pulse rounded-2xl bg-amber-300/12" />
              <div className="mt-2 ml-auto h-4 w-16 animate-pulse rounded-xl bg-white/6" />
            </div>
          </div>
          <div className="mt-10 h-[172px] animate-pulse rounded-[26px] border border-white/6 bg-white/[0.03]" />
          <div className="mt-5 h-14 animate-pulse rounded-[20px] bg-emerald-400/10" />
        </div>
      ))}
    </div>
  );
}

// Small modal that shows what action just finished.
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
            <p className="text-base font-semibold text-white">
              {summary.heading}
            </p>
            {summary.description ? (
              <p className="mt-1 text-sm leading-6 text-zinc-300">
                {summary.description}
              </p>
            ) : null}
          </div>
        </div>

        {summary.items?.length ? (
          <div className="mt-4 space-y-2">
            {summary.items.map((item, index) => (
              <div
                key={`summary-item-${String(item)}-${index}`}
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

// Build a simple "old -> new" line for session edits.
function describeSessionFieldChange(label, previousValue, nextValue) {
  if (previousValue === nextValue) {
    return "";
  }

  if (!previousValue) {
    return `${label}: ${nextValue}`;
  }

  return `${label}: ${previousValue} -> ${nextValue}`;
}

// Main sessions page.
// Read this component in this order:
// 1. state declarations
// 2. derived lists and pagination
// 3. handlers for pin, manage, delete, and navigation
// 4. final JSX layout
export default function SessionsPageClient({
  initialPayload,
  refreshToken = "",
}) {
  const hasInitialPayload = Array.isArray(initialPayload?.sessions);
  const initialSessions = useMemo(
    () =>
      Array.isArray(initialPayload?.sessions) ? initialPayload.sessions : [],
    [initialPayload?.sessions],
  );
  const initialTotalCount = useMemo(
    () => Number(initialPayload?.totalCount || 0),
    [initialPayload?.totalCount],
  );
  const initialUnfilteredTotalCount = useMemo(
    () =>
      Number(initialPayload?.unfilteredTotalCount || initialTotalCount || 0),
    [initialPayload?.unfilteredTotalCount, initialTotalCount],
  );
  const initialPage = useMemo(
    () => Math.max(1, Number(initialPayload?.page || 1)),
    [initialPayload?.page],
  );
  const initialPageSize = useMemo(
    () =>
      String(Math.min(68, Math.max(28, Number(initialPayload?.limit || 28)))),
    [initialPayload?.limit],
  );
  const initialTotalPages = useMemo(
    () => Math.max(1, Number(initialPayload?.totalPages || 1)),
    [initialPayload?.totalPages],
  );
  const initialCountsPending = useMemo(
    () => Boolean(initialPayload?.countsPending),
    [initialPayload?.countsPending],
  );

  // Main page state.
  const [sessions, setSessions] = useState(initialSessions ?? []);
  const [totalCount, setTotalCount] = useState(Number(initialTotalCount || 0));
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState(
    Number(initialUnfilteredTotalCount || 0),
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [pageSizeValue, setPageSizeValue] = useState(initialPageSize);
  const [hasNextPage, setHasNextPage] = useState(
    Boolean(initialPayload?.hasNextPage),
  );
  const [hasPreviousPage, setHasPreviousPage] = useState(
    Boolean(initialPayload?.hasPreviousPage),
  );
  const [paginationPendingState, setPaginationPendingState] = useState(null);
  const [isRefreshingList, setIsRefreshingList] = useState(!hasInitialPayload);
  const [hasLoadedFirstPage, setHasLoadedFirstPage] =
    useState(hasInitialPayload);
  const [countsPending, setCountsPending] = useState(initialCountsPending);
  const [pinPrompt, setPinPrompt] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [managePinPrompt, setManagePinPrompt] = useState(null);
  const [manageSessionContext, setManageSessionContext] = useState(null);
  const [manageForm, setManageForm] = useState(EMPTY_MANAGE_FORM);
  const [manageInitialForm, setManageInitialForm] = useState(EMPTY_MANAGE_FORM);
  const [manageWasEdited, setManageWasEdited] = useState(false);
  const [manageSubmitting, setManageSubmitting] = useState(false);
  const [manageError, setManageError] = useState("");
  const [manageDiscardPromptOpen, setManageDiscardPromptOpen] = useState(false);
  const [imageDeleteContext, setImageDeleteContext] = useState(null);
  const [imageReplaceContext, setImageReplaceContext] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [selectionError, setSelectionError] = useState("");
  const [bulkDeletePromptOpen, setBulkDeletePromptOpen] = useState(false);
  const [actionSummary, setActionSummary] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("live-newest");
  const [filterBy, setFilterBy] = useState("all");
  const [isGoingHome, setIsGoingHome] = useState(false);
  const router = useRouter();
  const { startNavigation } = useRouteFeedback();
  const suppressCardOpenUntilRef = useRef(0);
  const hasMountedFiltersRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const hasPrimedInitialLoadRef = useRef(false);
  const previousPageSizeRef = useRef(initialPageSize);
  const sessionsTopRef = useRef(null);

  useEffect(() => {
    setSessions(initialSessions ?? []);
    setTotalCount(Number(initialTotalCount || 0));
    setUnfilteredTotalCount(Number(initialUnfilteredTotalCount || 0));
    setCurrentPage(initialPage);
    setTotalPages(initialTotalPages);
    setPageSizeValue(initialPageSize);
    setHasNextPage(Boolean(initialPayload?.hasNextPage));
    setHasPreviousPage(Boolean(initialPayload?.hasPreviousPage));
    setCountsPending(Boolean(initialPayload?.countsPending));
  }, [
    initialPage,
    initialPageSize,
    initialPayload?.countsPending,
    initialPayload?.hasNextPage,
    initialPayload?.hasPreviousPage,
    initialSessions,
    initialTotalCount,
    initialTotalPages,
    initialUnfilteredTotalCount,
  ]);

  useEffect(() => {
    setSelectedSessionIds((current) =>
      current.filter((sessionId) =>
        sessions.some((session) => session._id === sessionId),
      ),
    );
  }, [sessions]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const nextQuery = normalizeSearchValue(searchInput);
      setSearchQuery((current) => {
        if (current === nextQuery) {
          return current;
        }
        setCurrentPage(1);
        return nextQuery;
      });
    }, 300);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [searchInput]);

  const totalSessionCount =
    Number.isFinite(totalCount) && totalCount > 0
      ? totalCount
      : sessions.length;
  const overallSessionCount =
    Number.isFinite(unfilteredTotalCount) && unfilteredTotalCount > 0
      ? unfilteredTotalCount
      : totalSessionCount;
  const totalSessionsLabel = `${totalSessionCount} ${
    totalSessionCount === 1 ? "session" : "sessions"
  }`;
  const showingFrom = sessions.length
    ? (currentPage - 1) * Number(pageSizeValue || 30) + 1
    : 0;
  const showingTo = sessions.length ? showingFrom + sessions.length - 1 : 0;
  const isFilteredView = filterBy !== "all" || Boolean(searchQuery);
  const imageReplaceSession = imageReplaceContext
    ? sessions.find(
        (session) => session._id === imageReplaceContext.sessionId,
      ) || null
    : null;
  const selectedSessions = useMemo(
    () =>
      sessions.filter((session) => selectedSessionIds.includes(session._id)),
    [selectedSessionIds, sessions],
  );
  const visiblePageNumbers = useMemo(
    () => buildVisiblePageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  );
  const showInitialSkeleton = !hasLoadedFirstPage && isRefreshingList;
  const managedSession = useMemo(
    () =>
      manageSessionContext?.sessionId
        ? sessions.find(
            (session) => session._id === manageSessionContext.sessionId,
          ) || null
        : null,
    [manageSessionContext?.sessionId, sessions],
  );
  const deferredManageLiveStreamUrl = useDeferredValue(manageForm.liveStreamUrl);
  const normalizedManageLiveStreamPreview = useMemo(() => {
    const trimmedUrl = String(deferredManageLiveStreamUrl || "").trim();
    if (!trimmedUrl) {
      return { ok: false, message: "", value: null };
    }

    const normalized = normalizeYouTubeLiveStream(trimmedUrl);
    return normalized.ok
      ? normalized
      : { ok: false, message: normalized.message, value: null };
  }, [deferredManageLiveStreamUrl]);

  const buildSessionsQuery = useCallback(
    ({
      forceFresh = false,
      pageOverride,
      limitOverride,
      includeCounts = true,
    } = {}) => {
      const query = new URLSearchParams({
        page: String(Math.max(1, Number(pageOverride || currentPage || 1))),
        limit: String(
          Math.min(
            68,
            Math.max(
              1,
              Number(limitOverride || pageSizeValue || SESSIONS_PAGE_SIZE),
            ),
          ),
        ),
        search: searchQuery,
        filter: filterBy,
        sort: sortBy,
      });

      if (!includeCounts) {
        query.set("counts", "0");
      }

      if (forceFresh) {
        query.set("fresh", "1");
        query.set("t", String(Date.now()));
      }

      return query;
    },
    [currentPage, filterBy, pageSizeValue, searchQuery, sortBy],
  );

  const fetchSessionsPayload = useCallback(
    async ({
      forceFresh = false,
      pageOverride,
      limitOverride,
      includeCounts = true,
    } = {}) => {
      const response = await fetch(
        `/api/sessions?${buildSessionsQuery({
          forceFresh,
          pageOverride,
          limitOverride,
          includeCounts,
        }).toString()}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Could not refresh sessions.");
      }

      const payload = await response.json().catch(() => null);
      if (!payload || !Array.isArray(payload.sessions)) {
        throw new Error("Could not refresh sessions.");
      }

      return payload;
    },
    [buildSessionsQuery],
  );

  const fetchSessionCountsPayload = useCallback(
    async ({ forceFresh = false, pageOverride, limitOverride } = {}) => {
      const query = buildSessionsQuery({
        forceFresh,
        pageOverride,
        limitOverride,
        includeCounts: true,
      });
      query.set("summary", "counts");

      const response = await fetch(`/api/sessions?${query.toString()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      if (!response.ok) {
        throw new Error("Could not load session counts.");
      }

      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload.totalCount !== "number") {
        throw new Error("Could not load session counts.");
      }

      return payload;
    },
    [buildSessionsQuery],
  );

  const applySessionsPayload = useCallback((payload) => {
    setSessions(payload.sessions);
    setCurrentPage(Math.max(1, Number(payload.page || 1)));
    if (Number.isFinite(Number(payload.totalPages))) {
      setTotalPages(Math.max(1, Number(payload.totalPages || 1)));
    }
    setHasNextPage(Boolean(payload.hasNextPage));
    setHasPreviousPage(Boolean(payload.hasPreviousPage));
    setCountsPending(Boolean(payload.countsPending));
  }, []);

  const applyCountsPayload = useCallback((payload) => {
    setTotalCount(Number(payload.totalCount || 0));
    setUnfilteredTotalCount(Number(payload.unfilteredTotalCount || 0));
    setTotalPages(Math.max(1, Number(payload.totalPages || 1)));
    setHasNextPage(Boolean(payload.hasNextPage));
    setHasPreviousPage(Boolean(payload.hasPreviousPage));
    setCountsPending(Boolean(payload.countsPending));
  }, []);

  const selectedSessionForManage =
    selectedSessions.length === 1 ? selectedSessions[0] : null;
  const normalizedManageForm = useMemo(
    () => ({
      name: String(manageForm.name || "").trim(),
      teamAName: String(manageForm.teamAName || "").trim(),
      teamBName: String(manageForm.teamBName || "").trim(),
      liveStreamUrl: String(manageForm.liveStreamUrl || "").trim(),
    }),
    [
      manageForm.name,
      manageForm.teamAName,
      manageForm.teamBName,
      manageForm.liveStreamUrl,
    ],
  );
  const normalizedManageInitialForm = useMemo(
    () => ({
      name: String(manageInitialForm.name || "").trim(),
      teamAName: String(manageInitialForm.teamAName || "").trim(),
      teamBName: String(manageInitialForm.teamBName || "").trim(),
      liveStreamUrl: String(manageInitialForm.liveStreamUrl || "").trim(),
    }),
    [
      manageInitialForm.name,
      manageInitialForm.teamAName,
      manageInitialForm.teamBName,
      manageInitialForm.liveStreamUrl,
    ],
  );
  const isManageFormDirty = useMemo(
    () =>
      normalizedManageForm.name !== normalizedManageInitialForm.name ||
      normalizedManageForm.teamAName !==
        normalizedManageInitialForm.teamAName ||
      normalizedManageForm.teamBName !== normalizedManageInitialForm.teamBName ||
      normalizedManageForm.liveStreamUrl !==
        normalizedManageInitialForm.liveStreamUrl,
    [
      normalizedManageForm.name,
      normalizedManageForm.teamAName,
      normalizedManageForm.teamBName,
      normalizedManageInitialForm.name,
      normalizedManageInitialForm.teamAName,
      normalizedManageInitialForm.teamBName,
    ],
  );
  const shouldPromptManageDiscard = isManageFormDirty || manageWasEdited;

  useEffect(() => {
    if (!selectionMode) {
      return;
    }

    if (!selectedSessionIds.length) {
      setSelectionMode(false);
      setSelectionError("");
    }
  }, [selectedSessionIds.length, selectionMode]);

  // Click handlers and request handlers start here.
  const handleOpenUmpirePin = useCallback((nextSession) => {
    setPinError("");
    setPinPrompt({ mode: "umpire", session: nextSession });
  }, []);

  // Director uses the same PIN modal, just with a different mode.
  const handleOpenDirectorPin = useCallback((nextSession) => {
    setPinError("");
    setPinPrompt({ mode: "director", session: nextSession });
  }, []);

  const mergeMatchImageUpdateIntoSession = useCallback(
    (sessionId, updatedMatch) => {
      setSessions((current) =>
        current.map((session) =>
          session._id === sessionId
            ? {
                ...session,
              coverImageUrl: updatedMatch?.matchImageUrl || "",
              matchImageUrl: updatedMatch?.matchImageUrl || "",
              matchImages: Array.isArray(updatedMatch?.matchImages)
                ? updatedMatch.matchImages
                : [],
              imageCount: Math.max(
                Array.isArray(updatedMatch?.matchImages)
                  ? updatedMatch.matchImages.length
                  : 0,
                updatedMatch?.matchImageUrl ? 1 : 0,
              ),
              liveStream: updatedMatch?.liveStream || null,
            }
          : session,
        ),
      );
    },
    [],
  );

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
          : session,
      ),
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
      current.filter((session) => !removedIdSet.has(String(session._id || ""))),
    );
    setTotalCount((current) =>
      Math.max(0, Number(current || 0) - removedIdSet.size),
    );
    setUnfilteredTotalCount((current) =>
      Math.max(0, Number(current || 0) - removedIdSet.size),
    );
  }, []);

  const handleOpenManagePrompt = useCallback((session) => {
    if (!session?._id) {
      return;
    }

    setManagePinPrompt({
      mode: "manage",
      session,
    });
  }, []);

  const closeImageActionFlows = useCallback(() => {
    setImageDeleteContext(null);
    setImageReplaceContext(null);
  }, []);

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

  const shouldBlockCardOpen = useCallback(
    () => selectionMode || Date.now() < suppressCardOpenUntilRef.current,
    [selectionMode],
  );

  const handleGoHome = useCallback(() => {
    setIsGoingHome(true);
    startNavigation("Opening home...");
    router.replace("/");
  }, [router, startNavigation]);

  const scrollSessionsToTop = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const topTarget =
      sessionsTopRef.current instanceof HTMLElement
        ? Math.max(
            0,
            window.scrollY +
              sessionsTopRef.current.getBoundingClientRect().top -
              12,
          )
        : 0;

    window.scrollTo({
      top: topTarget,
      left: 0,
      behavior: "auto",
    });

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: topTarget,
        left: 0,
        behavior: "auto",
      });
    });
  }, []);

  const reloadSessionsFromServer = useCallback(
    async ({ forceFresh = false, pageOverride, limitOverride } = {}) => {
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;
      setIsRefreshingList(true);

      try {
        const cardsPayload = await fetchSessionsPayload({
          forceFresh,
          pageOverride,
          limitOverride,
          includeCounts: false,
        });

        if (requestId !== activeRequestIdRef.current) {
          return cardsPayload.sessions;
        }

        applySessionsPayload(cardsPayload);
        setHasLoadedFirstPage(true);
        void fetchSessionCountsPayload({
          forceFresh,
          pageOverride: cardsPayload.page,
          limitOverride: limitOverride || cardsPayload.limit,
        })
          .then((countsPayload) => {
            if (requestId !== activeRequestIdRef.current) {
              return;
            }
            applyCountsPayload(countsPayload);
          })
          .catch(() => {});
        return cardsPayload.sessions;
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setHasLoadedFirstPage(true);
          setIsRefreshingList(false);
          setPaginationPendingState(null);
        }
      }
    },
    [
      applyCountsPayload,
      applySessionsPayload,
      fetchSessionCountsPayload,
      fetchSessionsPayload,
    ],
  );

  const handlePaginationChange = useCallback(
    (nextPage, type = "page") => {
      const resolvedPage = Math.max(
        1,
        Math.min(totalPages, Number(nextPage || 1)),
      );
      if (resolvedPage === currentPage || isRefreshingList) {
        return;
      }

      scrollSessionsToTop();
      setPaginationPendingState({
        type,
        targetPage: resolvedPage,
      });
      setCurrentPage(resolvedPage);
    },
    [currentPage, isRefreshingList, scrollSessionsToTop, totalPages],
  );

  useEffect(() => {
    if (!String(refreshToken || "").trim()) {
      return;
    }

    void reloadSessionsFromServer({ forceFresh: true }).catch(() => {});
  }, [refreshToken, reloadSessionsFromServer]);

  useEffect(() => {
    if (hasInitialPayload || hasPrimedInitialLoadRef.current) {
      return;
    }

    hasPrimedInitialLoadRef.current = true;
    let cancelled = false;

    const primeSessionsIncrementally = async () => {
      try {
        const firstPayload = await fetchSessionsPayload({
          pageOverride: 1,
          limitOverride: 1,
          includeCounts: false,
        });

        if (cancelled) {
          return;
        }

        applySessionsPayload(firstPayload);
        setHasLoadedFirstPage(true);

        const fivePayload = await fetchSessionsPayload({
          pageOverride: 1,
          limitOverride: 5,
          includeCounts: false,
        });

        if (cancelled) {
          return;
        }

        applySessionsPayload(fivePayload);

        if (cancelled) {
          return;
        }

        const fullCardsPayload = await fetchSessionsPayload({
          pageOverride: 1,
          limitOverride: Number(pageSizeValue || SESSIONS_PAGE_SIZE),
          includeCounts: false,
        });

        if (cancelled) {
          return;
        }

        applySessionsPayload(fullCardsPayload);
        setHasLoadedFirstPage(true);

        void fetchSessionCountsPayload({
          pageOverride: 1,
          limitOverride: Number(pageSizeValue || SESSIONS_PAGE_SIZE),
        })
          .then((countsPayload) => {
            if (cancelled) {
              return;
            }
            applyCountsPayload(countsPayload);
          })
          .catch(() => {});
      } catch {
        if (!cancelled) {
          void reloadSessionsFromServer({ pageOverride: 1 }).catch(() => {});
        }
      }
    };

    void primeSessionsIncrementally();

    return () => {
      cancelled = true;
    };
  }, [
    applyCountsPayload,
    applySessionsPayload,
    pageSizeValue,
    fetchSessionCountsPayload,
    fetchSessionsPayload,
    hasInitialPayload,
    reloadSessionsFromServer,
  ]);

  useEffect(() => {
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      previousPageSizeRef.current = pageSizeValue;
      return;
    }

    const pageSizeChanged = previousPageSizeRef.current !== pageSizeValue;
    previousPageSizeRef.current = pageSizeValue;
    if (!pageSizeChanged) {
      scrollSessionsToTop();
    }
    void reloadSessionsFromServer().catch(() => {});
  }, [
    currentPage,
    filterBy,
    pageSizeValue,
    hasInitialPayload,
    reloadSessionsFromServer,
    scrollSessionsToTop,
    searchQuery,
    sortBy,
  ]);

  const openSessionManager = useCallback((session, pin) => {
    setManageSessionContext({ sessionId: session._id, pin });
    const nextForm = {
      name: session.name || "",
      teamAName: session.teamAName || "",
      teamBName: session.teamBName || "",
      liveStreamUrl:
        session?.liveStream?.inputUrl || session?.liveStream?.watchUrl || "",
    };
    setManageForm(nextForm);
    setManageInitialForm(nextForm);
    setManageWasEdited(false);
    setManageError("");
    setManageDiscardPromptOpen(false);
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
    [managePinPrompt, openSessionManager, startSelectionMode],
  );

  const closeSessionManager = useCallback(
    (options = {}) => {
      const forceClose = Boolean(
        options &&
        typeof options === "object" &&
        "force" in options &&
        options.force === true,
      );

      if (manageSubmitting) {
        return;
      }

      if (!forceClose && shouldPromptManageDiscard) {
        setManageDiscardPromptOpen(true);
        return;
      }

      setManageSessionContext(null);
      setManageForm(EMPTY_MANAGE_FORM);
      setManageInitialForm(EMPTY_MANAGE_FORM);
      setManageWasEdited(false);
      setManageError("");
      setManageSubmitting(false);
      setManageDiscardPromptOpen(false);
    },
    [manageSubmitting, shouldPromptManageDiscard],
  );

  const handleOpenManagedImageUploader = useCallback(() => {
    if (!managedSession?.match || !manageSessionContext?.pin) {
      return;
    }

    setImageReplaceContext({
      sessionId: managedSession._id,
      matchId: managedSession.match,
      mode: "gallery",
      pin: manageSessionContext.pin,
    });
    closeSessionManager({ force: true });
  }, [closeSessionManager, manageSessionContext?.pin, managedSession]);

  const handleStartManagedSelection = useCallback(() => {
    if (!managedSession) {
      return;
    }

    closeSessionManager({ force: true });
    startSelectionMode(managedSession);
  }, [closeSessionManager, managedSession, startSelectionMode]);

  const handleManageFieldChange = useCallback((field, value) => {
    setManageWasEdited(true);
    setManageForm((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const handlePasteManageLiveStreamLink = useCallback(async () => {
    if (!navigator?.clipboard?.readText) {
      setManageError("Paste is not supported in this browser.");
      return;
    }

    try {
      const pastedText = await navigator.clipboard.readText();
      if (!String(pastedText || "").trim()) {
        setManageError("Clipboard is empty.");
        return;
      }

      handleManageFieldChange("liveStreamUrl", String(pastedText || "").trim());
      setManageError("");
    } catch {
      setManageError("Could not paste the YouTube link. Try pasting it manually.");
    }
  }, [handleManageFieldChange]);

  const handleClearManageLiveStreamLink = useCallback(() => {
    handleManageFieldChange("liveStreamUrl", "");
    setManageError("");
  }, [handleManageFieldChange]);

  const handleManageSessionSave = useCallback(async () => {
    if (!manageSessionContext?.sessionId || manageSubmitting) {
      return;
    }

    setManageSubmitting(true);
    setManageError("");

    try {
      const previousSession =
        sessions.find(
          (session) => session._id === manageSessionContext.sessionId,
        ) || null;
      const trimmedLiveStreamUrl = String(manageForm.liveStreamUrl || "").trim();
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
        },
      );
      const payload = await response
        .json()
        .catch(() => ({ message: "Could not update session." }));

      if (!response.ok) {
        throw new Error(payload.message || "Could not update session.");
      }

      if (previousSession?.match) {
        if (trimmedLiveStreamUrl) {
          const normalizedStream =
            normalizeYouTubeLiveStream(trimmedLiveStreamUrl);
          if (!normalizedStream.ok) {
            throw new Error(normalizedStream.message);
          }

          const liveStreamResponse = await fetch(
            `/api/matches/${previousSession.match}/live-stream`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pin: manageSessionContext.pin,
                liveStreamUrl: trimmedLiveStreamUrl,
              }),
            },
          );
          const liveStreamPayload = await liveStreamResponse
            .json()
            .catch(() => ({ message: "Could not update live stream." }));

          if (!liveStreamResponse.ok) {
            throw new Error(
              liveStreamPayload.message || "Could not update live stream.",
            );
          }

          mergeMatchImageUpdateIntoSession(
            manageSessionContext.sessionId,
            liveStreamPayload,
          );
        } else if (previousSession?.liveStream?.watchUrl) {
          const liveStreamResponse = await fetch(
            `/api/matches/${previousSession.match}/live-stream`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pin: manageSessionContext.pin,
              }),
            },
          );
          const liveStreamPayload = await liveStreamResponse
            .json()
            .catch(() => ({ message: "Could not remove live stream." }));

          if (!liveStreamResponse.ok) {
            throw new Error(
              liveStreamPayload.message || "Could not remove live stream.",
            );
          }

          mergeMatchImageUpdateIntoSession(
            manageSessionContext.sessionId,
            liveStreamPayload,
          );
        }
      }

      const changedItems = [
        describeSessionFieldChange(
          "Game name",
          previousSession?.name || "",
          payload.name || manageForm.name.trim(),
        ),
        describeSessionFieldChange(
          "Team A",
          previousSession?.teamAName || "",
          payload.teamAName || manageForm.teamAName.trim(),
        ),
        describeSessionFieldChange(
          "Team B",
          previousSession?.teamBName || "",
          payload.teamBName || manageForm.teamBName.trim(),
        ),
        describeSessionFieldChange(
          "YouTube link",
          previousSession?.liveStream?.watchUrl ||
            previousSession?.liveStream?.inputUrl ||
            "",
          trimmedLiveStreamUrl,
        ),
      ].filter(Boolean);

      mergeSessionUpdateIntoList({
        ...previousSession,
        ...payload,
      });

      closeSessionManager({ force: true });
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
  }, [
    closeSessionManager,
    manageForm.name,
    manageForm.teamAName,
    manageForm.teamBName,
    manageForm.liveStreamUrl,
    manageSessionContext,
    manageSubmitting,
    mergeMatchImageUpdateIntoSession,
    mergeSessionUpdateIntoList,
    reloadSessionsFromServer,
    sessions,
  ]);

  const handleBulkDeleteSessions = useCallback(
    async (pin) => {
      if (!selectedSessionIds.length) {
        throw new Error("Select at least 1 session.");
      }
      const selectedSessionSnapshot = sessions.filter((session) =>
        selectedSessionIds.includes(session._id),
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
    [
      clearSelectionMode,
      reloadSessionsFromServer,
      removeSessionsFromList,
      selectedSessionIds,
      sessions,
    ],
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
        },
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
    [
      closeImageActionFlows,
      imageDeleteContext,
      mergeMatchImageUpdateIntoSession,
    ],
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
        router.push(`/director?session=${directorSessionId}&manage=1`, {
          scroll: true,
        });
        setPinPrompt(null);
        return;
      }

      const response = await fetch(
        `/api/matches/${pinPrompt.session.match}/auth`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        },
      );

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ message: "Incorrect PIN.", redirectTo: "" }));
        if (payload?.redirectTo) {
          startNavigation("Opening result...");
          router.push(payload.redirectTo, { scroll: true });
          setPinPrompt(null);
          return;
        }
        throw buildPinRequestError(response, payload, "Incorrect PIN.");
      }

      const needsToss = !pinPrompt.session.tossReady;
      startNavigation(needsToss ? "Opening toss..." : "Opening umpire mode...");
      router.push(
        needsToss
          ? `/toss/${pinPrompt.session.match}`
          : `/match/${pinPrompt.session.match}`,
        { scroll: true },
      );
      setPinPrompt(null);
    } catch (error) {
      setPinError(error.message);
      throw error;
    } finally {
      setPinSubmitting(false);
    }
  };

  if (
    !sessions.length &&
    !isFilteredView &&
    !isRefreshingList &&
    hasLoadedFirstPage
  ) {
    return (
      <main
        id="top"
        className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_22%),radial-gradient(circle_at_82%_14%,rgba(14,165,233,0.1),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%),linear-gradient(180deg,#16181d_0%,#090a0f_100%)] px-5 py-8 text-zinc-100"
      >
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

  // Main page UI starts here.
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

        <section
          ref={sessionsTopRef}
          className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.06),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.05),transparent_24%),linear-gradient(180deg,rgba(13,14,20,0.98),rgba(8,8,12,0.99))] px-5 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:px-7"
        >
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
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                Browse live scores, match results, and saved sessions.
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                {showInitialSkeleton
                  ? "Loading the latest sessions..."
                  : isFilteredView
                    ? `Showing ${showingFrom.toLocaleString()}-${showingTo.toLocaleString()} of ${totalSessionCount.toLocaleString()} matches`
                    : `Showing ${showingFrom.toLocaleString()}-${showingTo.toLocaleString()} of ${overallSessionCount.toLocaleString()} total`}
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
                    setCurrentPage(1);
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
                    setCurrentPage(1);
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
          {showInitialSkeleton ? (
            <SessionsGridSkeleton count={8} />
          ) : !sessions.length && !isRefreshingList ? (
            <EmptyState
              title={
                searchQuery
                  ? "No matching sessions"
                  : "No sessions in this view"
              }
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
                {sessions.map((session) => (
                  <div
                    key={session._id}
                    className="h-full select-none [touch-action:pan-y]"
                    style={{ WebkitTouchCallout: "none" }}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <SessionCard
                      session={session}
                      onUmpireClick={handleOpenUmpirePin}
                      onDirectorClick={handleOpenDirectorPin}
                      shouldBlockCardOpen={shouldBlockCardOpen}
                      onImageHold={handleOpenManagePrompt}
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
                      Showing {showingFrom.toLocaleString()}-
                      {showingTo.toLocaleString()} of{" "}
                      {totalSessionCount.toLocaleString()} matching{" "}
                      {totalSessionCount === 1 ? "session" : "sessions"}
                    </p>
                    {isFilteredView ? (
                      <p className="mt-1 text-sm text-zinc-500">
                        {overallSessionCount.toLocaleString()} total in database
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-zinc-500">
                      {countsPending
                        ? "Loading full session count..."
                        : `Showing page ${currentPage.toLocaleString()} of ${totalPages.toLocaleString()}`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      {isRefreshingList ? (
                        <span className="text-sm text-zinc-400">
                          Loading sessions...
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-[148px]">
                      <DarkSelect
                        value={pageSizeValue}
                        onChange={(value) => {
                          setPageSizeValue(value);
                        }}
                        options={PAGE_SIZE_OPTIONS}
                        ariaLabel="How many sessions to show"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handlePaginationChange(currentPage - 1, "previous")
                        }
                        disabled={!hasPreviousPage}
                        className="press-feedback rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] disabled:cursor-not-allowed disabled:text-zinc-500 disabled:opacity-100"
                      >
                        {isRefreshingList &&
                        paginationPendingState?.type === "previous"
                          ? "Loading..."
                          : "Previous Page"}
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        {visiblePageNumbers.map((pageNumber) => {
                          const isActive = pageNumber === currentPage;
                          const isPendingPage =
                            isRefreshingList &&
                            paginationPendingState?.type === "page" &&
                            paginationPendingState?.targetPage === pageNumber;

                          return (
                            <button
                              key={`session-page-${pageNumber}`}
                              type="button"
                              onClick={() =>
                                handlePaginationChange(pageNumber, "page")
                              }
                              className={`press-feedback inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition ${
                                isActive
                                  ? "border-cyan-200/24 bg-[linear-gradient(135deg,rgba(245,252,255,0.96),rgba(211,238,248,0.9)_60%,rgba(245,158,11,0.26))] text-black shadow-[0_10px_20px_rgba(255,255,255,0.14)]"
                                  : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] text-white hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))]"
                              }`}
                              aria-label={`Go to page ${pageNumber}`}
                              aria-current={isActive ? "page" : undefined}
                            >
                              {isPendingPage
                                ? "..."
                                : pageNumber.toLocaleString()}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handlePaginationChange(currentPage + 1, "next")
                        }
                        disabled={!hasNextPage}
                        className="press-feedback rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] disabled:cursor-not-allowed disabled:text-zinc-500 disabled:opacity-100"
                      >
                        {isRefreshingList &&
                        paginationPendingState?.type === "next"
                          ? "Loading..."
                          : "Next Page"}
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
            key="pin-modal"
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
              pinPrompt.mode === "director"
                ? "Director Mode PIN"
                : "Umpire Mode PIN"
            }
            description={
              pinPrompt.mode === "director"
                ? "Enter the director PIN to join director mode for this live match. More than one director can open the same match."
                : "Enter the PIN to access scoring controls."
            }
            submitLabel={
              pinPrompt.mode === "director"
                ? "Join Director Mode"
                : "Enter Umpire Mode"
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
            key="manage-pin-modal"
            isOpen={Boolean(managePinPrompt)}
            title={
              managePinPrompt.mode === "select"
                ? "Select Sessions"
                : "Manage Session"
            }
            subtitle={
              managePinPrompt.mode === "select"
                ? "Enter the 6-digit manage PIN to unlock session selection."
                : "Enter the 6-digit manage PIN to unlock session options."
            }
            confirmLabel={
              managePinPrompt.mode === "select"
                ? "Unlock Selection"
                : "Continue"
            }
            digitCount={6}
            pinLabel="Manage PIN"
            placeholder="- - - - - -"
            rateLimitScope="session-manage-pin"
            allowSubmitDuringRateLimit
            onConfirm={handleManagePinSubmit}
            onClose={() => {
              setManagePinPrompt(null);
            }}
          />
        ) : null}
        {bulkDeletePromptOpen ? (
          <ImagePinModal
            key="bulk-delete-pin-modal"
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
            key="manage-session-modal"
            title="Session Manager"
            onExit={() => closeSessionManager()}
            panelClassName="max-w-md"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {managedSession?.match ? (
                  <button
                    type="button"
                    onClick={handleOpenManagedImageUploader}
                    className="rounded-2xl border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,18,26,0.96),rgba(8,47,73,0.82))] px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:brightness-110"
                  >
                    {Array.isArray(managedSession?.matchImages) &&
                    managedSession.matchImages.length
                      ? "Manage Match Images"
                      : "Add Match Image"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleStartManagedSelection}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
                >
                  Select Sessions
                </button>
              </div>
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
              {managedSession?.match ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      YouTube Link
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={
                          String(manageForm.liveStreamUrl || "").trim()
                            ? handleClearManageLiveStreamLink
                            : handlePasteManageLiveStreamLink
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-200 transition hover:bg-white/[0.08]"
                      >
                        {String(manageForm.liveStreamUrl || "").trim() ? (
                          <FaTimes className="text-sm" />
                        ) : (
                          <LuClipboardPaste className="text-sm" />
                        )}
                        {String(manageForm.liveStreamUrl || "").trim()
                          ? "Clear"
                          : "Paste"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={manageForm.liveStreamUrl}
                    onChange={(event) =>
                      handleManageFieldChange("liveStreamUrl", event.target.value)
                    }
                    placeholder="Paste watch, live, share, shorts, embed, or youtu.be link"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-500 focus:border-emerald-300/28 focus:bg-white/[0.06]"
                  />
                  {normalizedManageLiveStreamPreview.ok &&
                  normalizedManageLiveStreamPreview.value?.watchUrl ? (
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-400/18 bg-red-500/8 px-3 py-2 text-sm text-red-100">
                      <FaYoutube className="text-red-300" />
                      <span className="truncate">
                        {normalizedManageLiveStreamPreview.value.watchUrl}
                      </span>
                    </div>
                  ) : managedSession?.liveStream?.watchUrl &&
                    !String(manageForm.liveStreamUrl || "").trim() ? (
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-400/18 bg-red-500/8 px-3 py-2 text-sm text-red-100">
                      <FaYoutube className="text-red-300" />
                      <span className="truncate">
                        {managedSession.liveStream.watchUrl}
                      </span>
                    </div>
                  ) : null}
                  {String(manageForm.liveStreamUrl || "").trim() &&
                  !normalizedManageLiveStreamPreview.ok ? (
                    <p className="mt-3 text-sm text-amber-200">
                      {normalizedManageLiveStreamPreview.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
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
                    !manageForm.teamBName.trim() ||
                    (String(manageForm.liveStreamUrl || "").trim().length > 0 &&
                      !normalizedManageLiveStreamPreview.ok)
                  }
                  loading={manageSubmitting}
                  pendingLabel="Saving..."
                  className="rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#059669_100%)] px-5 py-3 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Changes
                </LoadingButton>
                <button
                  type="button"
                  onClick={() => closeSessionManager()}
                  disabled={manageSubmitting}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 font-semibold text-zinc-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          </ModalBase>
        ) : null}
        {manageDiscardPromptOpen ? (
          <ModalBase
            key="manage-discard-modal"
            title="Discard Changes?"
            onExit={() => setManageDiscardPromptOpen(false)}
            panelClassName="max-w-sm"
          >
            <p className="text-sm leading-6 text-zinc-300">
              You have unsaved session changes. Do you want to discard them or
              keep editing?
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setManageDiscardPromptOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => closeSessionManager({ force: true })}
                className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
              >
                Discard Changes
              </button>
            </div>
          </ModalBase>
        ) : null}
        {imageReplaceContext ? (
          <ModalBase
            key="image-replace-modal"
            onExit={undefined}
            hideHeader
            panelClassName="max-w-md"
            bodyClassName="max-h-[calc(100vh-7rem)]"
          >
            <MatchImageUploader
              matchId={String(imageReplaceContext.matchId)}
              existingImages={
                Array.isArray(imageReplaceSession?.matchImages)
                  ? imageReplaceSession.matchImages
                  : []
              }
              existingImageUrl={
                imageReplaceContext.mode === "replace"
                  ? imageReplaceContext.image?.url || ""
                  : ""
              }
              existingImageCount={
                Array.isArray(imageReplaceSession?.matchImages)
                  ? imageReplaceSession.matchImages.length
                  : 0
              }
              targetImageId={
                imageReplaceContext.mode === "replace"
                  ? imageReplaceContext.image?.id || ""
                  : ""
              }
              appendOnUpload={imageReplaceContext.mode !== "replace"}
              onUploaded={(updatedMatch) => {
                mergeMatchImageUpdateIntoSession(
                  imageReplaceContext.sessionId,
                  updatedMatch,
                );
              }}
              onComplete={() => {
                closeImageActionFlows();
              }}
              onRequestClose={closeImageActionFlows}
              title="Match Gallery"
              description="Manage session images."
              primaryLabel="Save Images"
              promptForUploadPin={!imageReplaceContext?.pin}
              protectedPin={imageReplaceContext?.pin || ""}
            />
          </ModalBase>
        ) : null}
        {imageDeleteContext ? (
          <ImagePinModal
            key="image-delete-pin-modal"
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
          <InfoModal
            key="info-modal"
            onExit={() => setIsInfoModalOpen(false)}
          />
        ) : null}
        {actionSummary ? (
          <ActionSummaryModal
            key="action-summary-modal"
            summary={actionSummary}
            onClose={() => setActionSummary(null)}
          />
        ) : null}
      </AnimatePresence>
      <SiteFooter className="mt-16" />
    </main>
  );
}
