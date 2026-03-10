import DirectorConsoleClient from "../components/director/DirectorConsoleClient";
import { loadDirectorConsoleData } from "../lib/server-data";

export default async function DirectorPage() {
  const data = await loadDirectorConsoleData();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.1),transparent_22%),linear-gradient(180deg,#050507_0%,#09090d_100%)] text-white">
      <DirectorConsoleClient
        initialAuthorized={data.authorized}
        initialSessions={data.sessions}
      />
    </main>
  );
}
