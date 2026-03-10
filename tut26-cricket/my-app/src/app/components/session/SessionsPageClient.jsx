"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { FaArrowLeft, FaInfoCircle, FaPlus, FaSearch } from "react-icons/fa";
import DarkSelect from "../shared/DarkSelect";
import InfoModal from "./InfoModal";
import PinModal from "./PinModal";
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
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] px-6 py-12 text-center shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">{text}</p>
      {href && label ? (
        <Link
          href={href}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(37,99,235,0.22)] transition hover:bg-blue-500"
        >
          <FaPlus />
          {label}
        </Link>
      ) : null}
    </div>
  );
}

export default function SessionsPageClient({ initialSessions }) {
  const [selectedSession, setSelectedSession] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("live-newest");
  const [filterBy, setFilterBy] = useState("all");
  const [pageSizeValue, setPageSizeValue] = useState("20");
  const [page, setPage] = useState(1);
  const [hasManualPageSize, setHasManualPageSize] = useState(false);
  const router = useRouter();
  const sessions = useMemo(() => initialSessions ?? [], [initialSessions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim().toLowerCase());
      setPage(1);
    }, 160);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (hasManualPageSize) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncPageSize = () => {
      setPageSizeValue(mediaQuery.matches ? "50" : "20");
    };

    syncPageSize();
    mediaQuery.addEventListener("change", syncPageSize);
    return () => mediaQuery.removeEventListener("change", syncPageSize);
  }, [hasManualPageSize]);

  const filteredSessions = useMemo(() => {
    const searched = searchQuery
      ? sessions.filter((session) => buildSearchText(session).includes(searchQuery))
      : sessions;

    const filtered = searched.filter((session) => {
      if (filterBy === "live") return session.isLive;
      if (filterBy === "completed") return !session.isLive;
      return true;
    });

    return sortSessions(filtered, sortBy);
  }, [filterBy, searchQuery, sessions, sortBy]);

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

  const handlePinSubmit = async (pin) => {
    if (!selectedSession?.match || !selectedSession.isLive) return;

    setPinSubmitting(true);
    setPinError("");

    try {
      const response = await fetch(`/api/matches/${selectedSession.match}/auth`, {
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

      router.push(`/match/${selectedSession.match}`);
      setSelectedSession(null);
    } catch (error) {
      setPinError(error.message);
    } finally {
      setPinSubmitting(false);
    }
  };

  if (!sessions.length) {
    return (
      <main className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100">
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
    <main className="min-h-screen bg-zinc-950 px-4 pb-10 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <FaArrowLeft />
            Back
          </Link>
          <Link
            href="/session/new"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(37,99,235,0.22)] transition hover:bg-blue-500"
          >
            <FaPlus />
            New Session
          </Link>
        </div>

        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] px-5 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-300">
                Sessions
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                  All Sessions
                </h1>
                <button
                  onClick={() => setIsInfoModalOpen(true)}
                  className="text-zinc-500 transition-colors hover:text-sky-300"
                  aria-label="Session status help"
                >
                  <FaInfoCircle size={22} />
                </button>
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                {filteredSessions.length} visible of {sessions.length} total sessions
              </p>
            </div>
          </div>

          <div className="sticky top-4 z-10 mt-6 rounded-[26px] border border-white/10 bg-zinc-950/85 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative flex items-center">
                <FaSearch className="pointer-events-none absolute left-4 text-zinc-500" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search sessions, teams, or date"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-sky-400/30 focus:bg-white/[0.06]"
                  aria-label="Search sessions"
                  autoComplete="off"
                />
              </label>

              <DarkSelect
                value={sortBy}
                onChange={(value) => {
                  setSortBy(value);
                  setPage(1);
                }}
                options={SORT_OPTIONS}
                ariaLabel="Sort sessions"
              />
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
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    filterBy === pill.value
                      ? "bg-white text-black"
                      : "border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
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
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-4 xl:grid-cols-3">
                {paginatedSessions.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                    onUmpireClick={(nextSession) => {
                      setPinError("");
                      setSelectedSession(nextSession);
                    }}
                  />
                ))}
              </div>

              <section className="mt-8 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.98))] px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
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
                          setHasManualPageSize(true);
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
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={currentPage >= totalPages}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
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
        {selectedSession ? (
          <PinModal
            onPinSubmit={handlePinSubmit}
            onExit={() => {
              setSelectedSession(null);
              setPinError("");
            }}
            isSubmitting={pinSubmitting}
            error={pinError}
          />
        ) : null}
        {isInfoModalOpen ? (
          <InfoModal onExit={() => setIsInfoModalOpen(false)} />
        ) : null}
      </AnimatePresence>
    </main>
  );
}
