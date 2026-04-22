/**
 * File overview:
 * Purpose: Renders the App Router page entry for Session.
 * Main exports: dynamic.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ../../../../../docs/ONBOARDING.md
 */

import SessionViewClient from "../../../components/session-view/SessionViewClient";
import SplashMsg from "../../../components/session-view/SplashMsg";
import {
  absoluteUrl,
  getMatchupLabel,
  siteConfig,
  versionedSocialImagePath,
} from "../../../lib/site-metadata";
import { loadSessionViewData } from "../../../lib/server-data";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

function buildUnavailableMetadata(id) {
  return {
    title: "Live Score Unavailable",
    description:
      "The live score is temporarily unavailable. Please try opening the session again.",
    alternates: {
      canonical: absoluteUrl(`/session/${id}/view`),
    },
  };
}

function SessionViewUnavailableState() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,#11131a_0%,#07070a_100%)] px-4 py-10 text-zinc-100 sm:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,26,0.96),rgba(8,8,12,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.42)] sm:p-8">
          <SplashMsg>
            Live score is temporarily unavailable. Check the MongoDB connection and try again.
          </SplashMsg>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/session"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Back To Sessions
            </a>
            <a
              href=""
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/16 bg-[linear-gradient(135deg,rgba(10,18,28,0.96),rgba(8,47,73,0.82))] px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:brightness-110"
            >
              Try Again
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  let initialData = null;

  try {
    initialData = await loadSessionViewData(id);
  } catch {
    return buildUnavailableMetadata(id);
  }

  const session = initialData?.session || {};
  const match = initialData?.match || {};
  const matchup = getMatchupLabel({
    sessionName: session.name,
    teamAName: match.teamAName || session.teamAName,
    teamBName: match.teamBName || session.teamBName,
  });
  const shareImageUrl = absoluteUrl(
    versionedSocialImagePath(`/session/${id}/view/opengraph-image`)
  );
  const twitterImageUrl = absoluteUrl(
    versionedSocialImagePath(`/session/${id}/view/twitter-image`)
  );
  const shareImageAlt = `${matchup} live score preview with GV Cricket branding`;

  return {
    title: `${matchup} Live Cricket Score`,
    description:
      `Follow the live cricket score, wickets, overs, and match updates for ${matchup} in GV Cricket spectator view.`,
    keywords: [
      `${matchup} live score`,
      "live cricket score",
      "cricket scoreboard",
      "cricket overs and wickets",
    ],
    alternates: {
      canonical: absoluteUrl(`/session/${id}/view`),
    },
    openGraph: {
      title: `${matchup} Live Cricket Score | GV Cricket`,
      description:
        `Live cricket score, overs, wickets, and spectator updates for ${matchup}.`,
      url: absoluteUrl(`/session/${id}/view`),
      images: [
        {
          url: shareImageUrl,
          width: SHARE_IMAGE_SIZE.width,
          height: SHARE_IMAGE_SIZE.height,
          alt: shareImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${matchup} Live Cricket Score | GV Cricket`,
      description:
        `Watch the live cricket score and match updates for ${matchup}.`,
      images: [
        {
          url: twitterImageUrl,
          alt: shareImageAlt,
        },
      ],
    },
    other: {
      "og:image:secure_url": shareImageUrl,
      "og:image:type": "image/png",
      "og:image:width": String(SHARE_IMAGE_SIZE.width),
      "og:image:height": String(SHARE_IMAGE_SIZE.height),
    },
  };
}

export default async function ViewSessionPage({ params }) {
  const { id } = await params;
  let initialData = null;

  try {
    initialData = await loadSessionViewData(id);
  } catch {
    return <SessionViewUnavailableState />;
  }

  if (!initialData?.found || !initialData?.session) {
    notFound();
  }

  if (
    initialData?.match?._id &&
    !initialData.match.isOngoing &&
    initialData.match.result &&
    !initialData.match.pendingResult
  ) {
    redirect(`/result/${initialData.match._id}`);
  }

  return <SessionViewClient sessionId={id} initialData={initialData} />;
}


