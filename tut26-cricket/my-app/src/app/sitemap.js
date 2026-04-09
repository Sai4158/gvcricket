/**
 * File overview:
 * Purpose: Builds the public sitemap entries for the app, sessions, and matches.
 * Main exports: default export.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: none.
 * Read next: ./README.md
 */

import Match from "../models/Match";
import Session from "../models/Session";
import { connectDB } from "./lib/db";
import { absoluteUrl } from "./lib/site-metadata";

export default async function sitemap() {
  await connectDB();

  const [sessions, matches] = await Promise.all([
    Session.find()
      .select("_id updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .lean(),
    Match.find()
      .select("_id sessionId isOngoing result updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const items = [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/session"),
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/rules"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const publishedSessions = sessions.filter((session) => !session?.isDraft);

  const liveSessionIds = new Set(
    matches
      .filter((match) => match?.sessionId && match.isOngoing && !match.result)
      .map((match) => String(match.sessionId))
  );

  for (const session of publishedSessions) {
    if (!liveSessionIds.has(String(session._id))) {
      continue;
    }

    items.push({
      url: absoluteUrl(`/session/${session._id}/view`),
      lastModified: new Date(session.updatedAt || session.createdAt || Date.now()),
      changeFrequency: "hourly",
      priority: 0.7,
    });
  }

  for (const match of matches) {
    if (!match?._id) continue;
    if (match.isOngoing && !match.result) continue;

    items.push({
      url: absoluteUrl(`/result/${match._id}`),
      lastModified: new Date(match.updatedAt || match.createdAt || Date.now()),
      changeFrequency: "weekly",
      priority: 0.65,
    });
  }

  return items;
}


