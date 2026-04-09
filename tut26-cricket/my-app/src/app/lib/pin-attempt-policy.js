/**
 * File overview:
 * Purpose: Provides shared Pin Attempt Policy logic for routes, APIs, and feature code.
 * Main exports: PIN_BURST_TRIGGER_ATTEMPTS, PIN_BURST_WINDOW_MS, PIN_BURST_BLOCK_MS.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

export const PIN_BURST_TRIGGER_ATTEMPTS = 4;
export const PIN_BURST_WINDOW_MS = 10_000;
export const PIN_BURST_BLOCK_MS = 30_000;


