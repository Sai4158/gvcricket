import DirectorConsoleClient from "../components/director/DirectorConsoleClient";
import { absoluteUrl, siteConfig } from "../lib/site-metadata";
import { loadDirectorConsoleData } from "../lib/server-data";

export const metadata = {
  title: "Director Console",
  description:
    "Private director console for PA mic, match audio, effects, and walkie control.",
  alternates: {
    canonical: absoluteUrl("/director"),
  },
  openGraph: {
    title: "Director Console | GV Cricket",
    description:
      "Private director console for PA mic, match audio, effects, and walkie control.",
    url: absoluteUrl("/director"),
    images: [
      {
        url: absoluteUrl(siteConfig.ogImagePath),
        width: 1200,
        height: 630,
        alt: "GV Cricket director console preview",
      },
    ],
  },
  twitter: {
    title: "Director Console | GV Cricket",
    description:
      "Private director console for PA mic, match audio, effects, and walkie control.",
    images: [absoluteUrl(siteConfig.twitterImagePath)],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DirectorPage({ searchParams }) {
  const data = await loadDirectorConsoleData();
  const preferredSessionId =
    typeof searchParams?.session === "string" ? searchParams.session : "";
  const autoManage =
    searchParams?.manage === "1" || searchParams?.manage === "true";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.1),transparent_22%),linear-gradient(180deg,#050507_0%,#09090d_100%)] text-white">
      <DirectorConsoleClient
        initialAuthorized={data.authorized}
        initialSessions={data.sessions}
        initialPreferredSessionId={preferredSessionId}
        initialAutoManage={autoManage}
      />
    </main>
  );
}
