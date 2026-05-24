import axios from "axios";
import NodeCache from "node-cache";
import {
  parseDateFromTitle,
  stripDateFromTitle,
  parseArtistNames,
  cleanHtmlEntities,
} from "./parseTitle.js";

const FA_API = "https://first-avenue.com/wp-json/wp/v2/event";
const USER_AGENT =
  "aurral-plugin-first-avenue/0.1.0 (+https://github.com/aurral-plugins/first-avenue)";

const eventListCache = new NodeCache({
  stdTTL: 15 * 60,
  checkperiod: 60,
  maxKeys: 20,
});

export const fetchEvents = async () => {
  const cacheKey = "fa-events";
  const cached = eventListCache.get(cacheKey);
  if (cached) return cached;

  // Filter to events published in the last 6 months. Most shows are announced
  // 2–4 months out; this window captures the vast majority while avoiding a
  // full crawl of years of historical posts.
  const after = new Date();
  after.setMonth(after.getMonth() - 6);
  const afterIso = after.toISOString().split(".")[0] + "Z";

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + 90);
  const todayStr = now.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const allRaw = [];
  for (let page = 1; page <= 5; page++) {
    try {
      const response = await axios.get(FA_API, {
        params: {
          per_page: 100,
          page,
          after: afterIso,
          orderby: "date",
          order: "desc",
          _fields: "id,slug,title,link",
        },
        timeout: 10000,
        headers: { "User-Agent": USER_AGENT },
      });
      const items = Array.isArray(response.data) ? response.data : [];
      if (items.length === 0) break;
      allRaw.push(...items);
      const total = Number(response.headers?.["x-wp-total"] || 0);
      if (allRaw.length >= total) break;
    } catch {
      break;
    }
  }

  const events = [];
  for (const raw of allRaw) {
    const rawTitle = cleanHtmlEntities(raw.title?.rendered || "");
    if (!rawTitle) continue;

    let date = parseDateFromTitle(rawTitle);
    if (!date) {
      // Fall back to YYYY-MM from the slug (e.g. "2026-08-cloud-nothings" → 2026-08-01)
      const slugMatch = String(raw.slug || "").match(/^(\d{4})-(\d{2})-/);
      if (slugMatch) date = `${slugMatch[1]}-${slugMatch[2]}-01`;
    }
    if (!date || date < todayStr || date > cutoffStr) continue;

    const cleanTitle = stripDateFromTitle(rawTitle);
    const artistNames = parseArtistNames(cleanTitle);
    if (artistNames.length === 0) continue;

    events.push({
      id: `fa-${raw.id}`,
      eventName: rawTitle,
      artistNames,
      date,
      url: raw.link || null,
      // Venue and time are populated later by enrichEvent()
      venueName: null,
      city: null,
      region: null,
      countryCode: "US",
      time: null,
    });
  }

  eventListCache.set(cacheKey, events);
  return events;
};
