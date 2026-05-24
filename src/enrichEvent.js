import axios from "axios";
import NodeCache from "node-cache";
import { VENUE_MAP } from "./venues.js";

const USER_AGENT =
  "aurral-plugin-first-avenue/0.1.0 (+https://github.com/aurral-plugins/first-avenue)";

const detailCache = new NodeCache({
  stdTTL: 60 * 60,
  checkperiod: 5 * 60,
  maxKeys: 500,
});

// Extract venue slug from the theme's venue anchor:
//   <a href="https://first-avenue.com/venue/turf-club/">...</a>
const VENUE_HREF_RE =
  /href="https?:\/\/first-avenue\.com\/venue\/([^"\/]+)\//;

// Extract show time from:
//   <h6>Show Starts</h6><p>8PM</p>
const SHOW_TIME_RE =
  /<h6[^>]*>\s*Show Starts\s*<\/h6>\s*<p[^>]*>([^<]+)<\/p>/i;

const OG_IMAGE_RE =
  /<meta[^>]+property="og:image"[^>]+content="([^"]+)"|<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i;

// Fallback: first uploaded image in the page body
const WP_IMAGE_RE =
  /(https:\/\/first-avenue\.com\/wp-content\/uploads\/[^\s"'<>]+\.(?:jpe?g|png|webp))/i;

export const enrichEvent = async (event) => {
  const cacheKey = event.url || event.id;
  const cached = detailCache.get(cacheKey);
  if (cached !== undefined) return cached;

  if (!event.url) {
    detailCache.set(cacheKey, event);
    return event;
  }

  try {
    const response = await axios.get(event.url, {
      timeout: 8000,
      headers: {
        Accept: "text/html",
        "User-Agent": USER_AGENT,
      },
    });
    const html = String(response.data || "");

    const venueSlug = html.match(VENUE_HREF_RE)?.[1] ?? null;
    const venueInfo = venueSlug ? VENUE_MAP[venueSlug] : null;
    const showTime = html.match(SHOW_TIME_RE)?.[1]?.trim() ?? null;
    const ogImageMatch = html.match(OG_IMAGE_RE);
    const image = ogImageMatch?.[1] ?? ogImageMatch?.[2] ?? html.match(WP_IMAGE_RE)?.[1] ?? null;

    const enriched = {
      ...event,
      venueName: venueInfo?.name ?? null,
      city: venueInfo?.city ?? null,
      region: venueInfo?.region ?? null,
      countryCode: venueInfo?.countryCode ?? "US",
      time: showTime,
      image,
    };
    detailCache.set(cacheKey, enriched);
    return enriched;
  } catch {
    // Return the event un-enriched; venue will show as null
    detailCache.set(cacheKey, event);
    return event;
  }
};
