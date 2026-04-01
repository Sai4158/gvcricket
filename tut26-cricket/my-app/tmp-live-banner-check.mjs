import { loadHomeLiveBannerData } from "./src/app/lib/server-data.js";
const banner = await loadHomeLiveBannerData();
console.log(JSON.stringify({ banner }, null, 2));