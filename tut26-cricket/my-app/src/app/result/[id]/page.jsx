/**
 * File overview:
 * Purpose: Renders the App Router page entry for Result.
 * Main exports: dynamic.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ../../../../docs/ONBOARDING.md
 */

import { notFound, redirect } from "next/navigation";
import ResultPageClient from "../../components/result/ResultPageClient";
import {
  absoluteUrl,
  getMatchupLabel,
  siteConfig,
  versionedSocialImagePath,
} from "../../lib/site-metadata";
import { getWinningInningsSummary } from "../../lib/match-result-display";
import { loadPublicMatchData } from "../../lib/server-data";
import { cache } from "react";

export const dynamic = "force-dynamic";
const loadPublicMatchDataCached = cache(loadPublicMatchData);
const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

export async function generateMetadata({ params }) {
  const { id } = await params;
  const match = await loadPublicMatchDataCached(id);
  if (!match) {
    return {
      title: "Result Not Found",
      description: "This match result could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
  const matchup = getMatchupLabel({
    sessionName: "",
    teamAName: match?.teamAName,
    teamBName: match?.teamBName,
  });
  const winningSummary = getWinningInningsSummary(match);
  const galleryImageCount = Array.isArray(match?.matchImages)
    ? match.matchImages.filter((image) => image?.url).length
    : 0;
  const pageLabel =
    matchup === "Cricket match" ? "Match Result and Stats" : `${matchup} Result and Stats`;
  const descriptionParts = [];
  const shareImageUrl = absoluteUrl(versionedSocialImagePath(`/result/${id}/opengraph-image`));
  const twitterImageUrl = absoluteUrl(versionedSocialImagePath(`/result/${id}/twitter-image`));
  const shareImageAlt = `${matchup} result preview with GV Cricket branding`;

  if (match?.result) {
    descriptionParts.push(match.result);
  }

  if (winningSummary?.teamName) {
    descriptionParts.push(
      `${winningSummary.teamName} finished on ${winningSummary.scoreline} in ${winningSummary.overs} overs.`,
    );
  }

  if (galleryImageCount >= 2) {
    descriptionParts.push(`Includes ${galleryImageCount} match photos in the shared card.`);
  }

  const descriptionText =
    descriptionParts.join(" ") ||
    `See the final score, winner, over summary, and match stats for ${matchup}.`;

  return {
    title: pageLabel,
    description: descriptionText,
    keywords: [
      `${matchup} result`,
      `${matchup} scorecard`,
      "cricket result",
      "cricket final score",
      "cricket match stats",
    ],
    alternates: {
      canonical: absoluteUrl(`/result/${id}`),
    },
    openGraph: {
      title: `${pageLabel} | GV Cricket`,
      description: descriptionText,
      url: absoluteUrl(`/result/${id}`),
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
      title: `${pageLabel} | GV Cricket`,
      description: descriptionText,
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

export default async function ResultPage({ params }) {
  const { id } = await params;
  const initialMatch = await loadPublicMatchDataCached(id);
  if (!initialMatch) {
    notFound();
  }
  if (initialMatch.pendingResult && !initialMatch.result) {
    redirect(
      initialMatch.sessionId
        ? `/session/${initialMatch.sessionId}/view`
        : `/match/${id}`,
    );
  }

  return <ResultPageClient matchId={id} initialMatch={initialMatch} />;
}


