function RouteLoadingShell({ title, subtitle }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.1),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_24%),linear-gradient(180deg,#12141a_0%,#07080d_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <section className="w-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(8,8,12,0.98))] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/18 bg-amber-400/10 text-amber-100 shadow-[0_12px_30px_rgba(245,158,11,0.14)]">
            <span
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/18 border-t-current"
              aria-hidden="true"
            />
          </div>
          <p className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">
            {title}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {subtitle}
          </p>
        </section>
      </div>
    </main>
  );
}

export default function Loading() {
  return (
    <RouteLoadingShell
      title="Opening toss..."
      subtitle="Loading toss controls and match setup."
    />
  );
}
