import SessionViewClient from "../../../components/session-view/SessionViewClient";
import {
  absoluteUrl,
  getMatchupLabel,
  siteConfig,
} from "../../../lib/site-metadata";
import { loadSessionViewData } from "../../../lib/server-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

export async function generateMetadata({ params }) {
  const { id } = await params;
  const initialData = await loadSessionViewData(id);
  const session = initialData?.session || {};
  const match = initialData?.match || {};
  const matchup = getMatchupLabel({
    sessionName: session.name,
    teamAName: match.teamAName || session.teamAName,
    teamBName: match.teamBName || session.teamBName,
  });
  const shareImageUrl = absoluteUrl(`/session/${id}/view/opengraph-image`);
  const twitterImageUrl = absoluteUrl(`/session/${id}/view/twitter-image`);
  const shareImageAlt = `${matchup} live score preview with GV Cricket branding`;

  return {
    title: `${matchup} Live Score`,
    description:
      "Follow the live score, wickets, overs, and match updates in GV Cricket spectator view.",
    alternates: {
      canonical: absoluteUrl(`/session/${id}/view`),
    },
    openGraph: {
      title: `${matchup} Live Score | GV Cricket`,
      description:
        "Live cricket score, overs, wickets, and spectator updates in one clean match view.",
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
      title: `${matchup} Live Score | GV Cricket`,
      description:
        "Watch the live score and match updates in the spectator view.",
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
  const initialData = await loadSessionViewData(id);

  if (initialData?.match?._id && !initialData.match.isOngoing) {
    redirect(`/result/${initialData.match._id}`);
  }

  return <SessionViewClient sessionId={id} initialData={initialData} />;
}
