"use client";

import Link from "next/link";

export default function SplashMsg({ children }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-300 text-center px-4">
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
