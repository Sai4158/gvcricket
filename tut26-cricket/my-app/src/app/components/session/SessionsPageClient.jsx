"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaInfoCircle,
  FaPlus,
  FaSearch,
  FaSlidersH,
} from "react-icons/fa";
import DarkSelect from "../shared/DarkSelect";
import InfoModal from "./InfoModal";
import PinModal from "./PinModal";
import LoadingButton from "../shared/LoadingButton";
import PendingLink from "../shared/PendingLink";
import SessionCard from "./SessionCard";

const SORT_OPTIONS = [
  { value: "live-newest", label: "Live first" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "recent-ended", label: "Recently ended" },
  { value: "a-z", label: "A to Z" },
  { value: "z-a", label: "Z to A" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "20", label: "20" },
  { value: "40", label: "40" },
  { value: "50", label: "50" },
  { value: "80", label: "80" },
  { value: "all", label: "All" },
];

function buildSearchText(session) {
  return [
    session.name,
    session.teamAName,
    session.teamBName,
    session.date,
    session.isLive ? "live live now" : "completed ended final score",
    session.result,
    session.updatedAt ? new Date(session.updatedAt).toLocaleString() : "",
    session.createdAt ? new Date(session.createdAt).toLocaleString() : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortSessions(items, sortValue) {
  const sessions = [...items];
  const byUpdatedDesc = (left, right) =>
    new Date(right.updatedAt || right.createdAt || 0).getTime() -
    new Date(left.updatedAt || left.createdAt || 0).getTime();

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
        String(left.name || "").localeCompare(String(right.name || ""))
      );
    case "z-a":
      return sessions.sort((left, right) =>
        String(right.name || "").localeCompare(String(left.name || ""))
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

export default function SessionsPageClient({ initialSessions }) {
  const [pinPrompt, setPinPrompt] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("live-newest");
  const [filterBy, setFilterBy] = useState("all");
  const [pageSizeValue, setPageSizeValue] = useState("20");
  const [page, setPage] = useState(1);
  const [isGoingHome, setIsGoingHome] = useState(false);
  const router = useRouter();
  const sessions = useMemo(() => initialSessions ?? [], [initialSessions]);
  const deferredSearchQuery = useDeferredValue(searchInput.trim().toLowerCase());

  useEffect(() => {
    setSearchQuery(deferredSearchQuery);
    setPage(1);
  }, [deferredSearchQuery]);

  const indexedSessions = useMemo(
    () =>
      sessions.map((session) => ({
        ...session,
        __searchText: buildSearchText(session),
      })),
    [sessions]
  );

  const filteredSessions = useMemo(() => {
    const searched = searchQuery
      ? indexedSessions.filter((session) => session.__searchText.includes(searchQuery))
      : indexedSessions;

    const filtered = searched.filter((session) => {
      if (filterBy === "live") return session.isLive;
      if (filterBy === "completed") return !session.isLive;
      return true;
    });

    return sortSessions(filtered, sortBy);
  }, [filterBy, indexedSessions, searchQuery, sortBy]);

  const pageSize = pageSizeValue === "all" ? filteredSessions.length || 1 : Number(pageSizeValue);
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredSessions.length ? (currentPage - 1) * pageSize : 0;
  const paginatedSessions =
    pageSizeValue === "all"
      ? filteredSessions
      : filteredSessions.slice(pageStart, pageStart + pageSize);
  const showingFrom = filteredSessions.length ? pageStart + 1 : 0;
  const showingTo = filteredSessions.length
    ? pageSizeValue === "all"
      ? filteredSessions.length
      : Math.min(filteredSessions.length, pageStart + pageSize)
    : 0;

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const handleOpenUmpirePin = useCallback((nextSession) => {
    setPinError("");
    setPinPrompt({ mode: "umpire", session: nextSession });
  }, []);

  const handleOpenDirectorPin = useCallback((nextSession) => {
    setPinError("");
    setPinPrompt({ mode: "director", session: nextSession });
  }, []);

  const handleGoHome = useCallback(() => {
    setIsGoingHome(true);
    router.replace("/");
  }, [router]);

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
          throw new Error(payload.message || "Incorrect PIN.");
        }

        const directorSessionId = pinPrompt.session._id;
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
        throw new Error(payload.message || "Incorrect PIN.");
      }

      const needsToss = !pinPrompt.session.tossReady;
      router.push(
        needsToss ? `/toss/${pinPrompt.session.match}` : `/match/${pinPrompt.session.match}`
      );
      setPinPrompt(null);
    } catch (error) {
      setPinError(error.message);
    } finally {
      setPinSubmitting(false);
    }
  };

  if (!sessions.length) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_22%),radial-gradient(circle_at_82%_14%,rgba(14,165,233,0.1),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%),linear-gradient(180deg,#16181d_0%,#090a0f_100%)] px-5 py-8 text-zinc-100">
        <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
          <EmptyState
            title="No sessions yet"
            text="Create a new match to start scoring, track live sessions, and keep results in one place."
            href="/session/new"
            label="Create session"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_20%),radial-gradient(circle_at_86%_10%,rgba(14,165,233,0.1),transparent_20%),radial-gradient(circle_at_16%_88%,rgba(16,185,129,0.08),transparent_20%),linear-gradient(180deg,#1b1d23_0%,#09090d_100%)] px-4 pb-10 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
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
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                  All Sessions
                </h1>
                <button
                  onClick={() => setIsInfoModalOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] text-zinc-300 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-cyan-300/18 hover:text-cyan-200"
                  aria-label="Session status help"
                >
                  <FaInfoCircle size={18} />
                </button>
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                {filteredSessions.length} visible of {sessions.length} total sessions
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
              {[
                { value: "all", label: "All" },
                { value: "live", label: "Live" },
                { value: "completed", label: "Completed" },
              ].map((pill) => (
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
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
                {paginatedSessions.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                    onUmpireClick={handleOpenUmpirePin}
                    onDirectorClick={handleOpenDirectorPin}
                  />
                ))}
              </div>

              <section className="mt-8 rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.06),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.05),transparent_22%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      Showing {showingFrom}-{showingTo} of {filteredSessions.length} sessions
                    </p>
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
          />
        ) : null}
        {isInfoModalOpen ? (
          <InfoModal onExit={() => setIsInfoModalOpen(false)} />
        ) : null}
      </AnimatePresence>
    </main>
  );
}
