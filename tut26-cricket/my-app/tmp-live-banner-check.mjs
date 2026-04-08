/**
 * File overview:
 * Purpose: Source module for Tmp Live Banner Check.
 * Main exports: module side effects only.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: none.
 * Read next: README.md
 */
import { loadHomeLiveBannerData } from "./src/app/lib/server-data.js";
const banner = await loadHomeLiveBannerData();
console.log(JSON.stringify({ banner }, null, 2));