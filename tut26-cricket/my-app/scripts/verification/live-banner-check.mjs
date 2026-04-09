/**
 * File overview:
 * Purpose: Manually inspects the home live-banner payload during local verification.
 * Main exports: module side effects only.
 * Major callers: Verification commands and local audit runs.
 * Side effects: reads current banner data and prints a JSON snapshot to stdout.
 * Read next: ../README.md
 */

import { loadHomeLiveBannerData } from "../../src/app/lib/server-data.js";
const banner = await loadHomeLiveBannerData();
console.log(JSON.stringify({ banner }, null, 2));
