"use client";

import Link from "next/link";
import LiquidLoader from "../shared/LiquidLoader";

export default function SplashMsg({ children, loading = false }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-300 text-center px-4">
      {loading ? <LiquidLoader size="lg" className="mb-5" /> : null}
      <p className="text-xl font-medium">{children}</p>
      <Link
        href="/"
        className="mt-6 underline text-lg text-blue-400 hover:text-blue-300 transition"
      >
        Back to Home
      </Link>
    </main>
  );
}
