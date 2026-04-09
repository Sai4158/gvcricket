/**
 * File overview:
 * Purpose: Renders the App Router page entry for Update.
 * Main exports: UpdatePage, metadata.
 * Major callers: Next.js App Router.
 * Side effects: none.
 * Read next: ../README.md
 */

import { redirect } from "next/navigation";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function UpdatePage() {
  redirect("/#updates");
}


