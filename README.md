# aurral-plugin-first-avenue

An [Aurral](https://github.com/lklynet/aurral) show source plugin that adds concerts from all **First Avenue Productions** venues in Minneapolis / Saint Paul to your nearby shows feed.

No API key required.

## Venues covered

| Venue | Neighborhood |
|-------|-------------|
| First Avenue | Downtown Minneapolis |
| 7th St Entry | Downtown Minneapolis |
| Fine Line | Downtown Minneapolis |
| The Depot Tavern | Downtown Minneapolis |
| MPLS CPAC | Minneapolis |
| Palace Theatre | Downtown Saint Paul |
| Palace Pub | Downtown Saint Paul |
| Turf Club | Midway, Saint Paul |
| The Fitzgerald Theater | Downtown Saint Paul |

## How it works

First Avenue's website runs on WordPress and exposes a public REST API at `first-avenue.com/wp-json/wp/v2/event`. The plugin uses this to get a lightweight list of all upcoming shows — artist names, dates, and event page URLs — without any authentication.

### Two-phase fetch

**Phase 1 — `fetchEvents()`**

Calls the WordPress REST API with `after = one year ago`, fetching up to 500 events across 5 paginated requests. For each event:

- Parses the artist name(s) and show date from the event title. First Avenue titles follow the pattern `"Artist Name M/DD/YY"` — the date suffix is stripped and the remaining title is split on `, ` and ` + ` to extract billed artists.
- Falls back to the URL slug for an approximate date (`2026-08-artist-name` → `2026-08-01`) when the title has no date suffix.
- Drops past events; keeps everything upcoming.
- Returns a lightweight list with no per-event HTTP calls.

Results are cached in memory for 15 minutes.

**Phase 2 — `enrichEvent()`**

Called by Aurral only for events that matched an artist in your library. Fetches the individual event page HTML and extracts:

- **Venue name** — from `<a href="https://first-avenue.com/venue/SLUG/">` links in the page
- **Show time** — from the `<h6>Show Starts</h6><p>TIME</p>` block
- **Artwork** — from the `og:image` meta tag, falling back to the first `wp-content/uploads` image in the page body

Because enrichment only runs for matched shows, the plugin makes at most a handful of individual page requests per query — not one per event on the calendar.

Results are cached per event URL for one hour.

### Location gating

The plugin activates only when your configured location is within 150 miles of Minneapolis (44.9778°N, 93.265°W). Outside that radius `isRelevantForLocation()` returns `false` and Aurral skips the plugin entirely.

### Artist matching and deduplication

Handled by Aurral's core. The plugin returns event data; Aurral matches each event's `artistNames` array against your library, recommended, and trending artists using the same fuzzy normalization it uses for Ticketmaster. If the same show appears in both Ticketmaster and this plugin, the Ticketmaster version wins — it has richer data (ticket price, distance, images).

## Data availability

| Field | Source |
|-------|--------|
| Artist names | Event title (parsed) |
| Show date | Event title (`M/D/YY` suffix) or slug (`YYYY-MM`, approximate) |
| Show time | Event page HTML |
| Venue name | Event page HTML |
| Artwork | Event page `og:image` / `wp-content/uploads` |
| City / region | Hardcoded per venue slug |
| Event URL | WordPress REST API |
| Ticket price | Not available |
| Distance | Not available |

## Installation

### 1. Set up Aurral with plugin support

The plugin system is available in [this PR](https://github.com/lklynet/aurral/pull/357). Until it merges you can apply it manually to your installation.

Aurral loads every `.js` file from a `plugins/` directory next to `server.js` on startup. You can override the path with the `AURRAL_PLUGINS_DIR` environment variable.

### 2. Build the plugin

The plugin uses ES module imports across multiple source files, so it must be bundled before use:

```bash
git clone https://github.com/jimternet/aurral-plugin-first-avenue.git
cd aurral-plugin-first-avenue
npm install
npm run build
```

This produces `dist/first-avenue.js` — a single self-contained file.

### 3. Copy to your plugins directory

```bash
cp dist/first-avenue.js /path/to/aurral/plugins/first-avenue.js
```

For Docker deployments, mount a host directory and copy into it:

```yaml
volumes:
  - /your/host/plugins:/app/plugins
```

```bash
cp dist/first-avenue.js /your/host/plugins/first-avenue.js
```

### 4. Restart Aurral

On startup you should see:

```
[plugins] Registered show source: First Avenue Productions
```

---

## Building a plugin for another venue

Any venue or ticketing platform with a public API or scrapeable website can be wrapped as an Aurral plugin. Here's how to replicate this pattern.

### Project structure

```
aurral-plugin-your-venue/
├── index.js          ← plugin entry point, exports the plugin object
├── src/
│   ├── venues.js     ← venue metadata + location gate
│   ├── fetchEvents.js ← phase 1: bulk event list
│   ├── enrichEvent.js ← phase 2: per-event details
│   └── parseTitle.js  ← title/date parsing helpers (if needed)
├── package.json
└── README.md
```

### 1. Define your venue metadata and location gate

```js
// src/venues.js
export const VENUE_MAP = {
  "your-venue-slug": {
    name: "Your Venue Name",
    city: "City",
    region: "ST",
    countryCode: "US",
  },
};

const VENUE_LAT = 44.9778;
const VENUE_LNG = -93.265;

const haversineDistanceMiles = (lat1, lng1, lat2, lng2) => {
  const R = 3959;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const isNearVenue = (location) => {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return haversineDistanceMiles(lat, lng, VENUE_LAT, VENUE_LNG) <= 150;
};
```

### 2. Implement `fetchEvents()` — the cheap bulk fetch

This should return as many upcoming shows as possible with minimal HTTP requests. Aim for a single paginated API call or feed. **Do not make one request per event here** — that's what `enrichEvent()` is for.

Return an array of `PluginEvent` objects. At minimum you need `id`, `artistNames`, and `date`. Leave `venueName`, `time`, and `image` as `null` — they get filled in by `enrichEvent()`.

```js
// src/fetchEvents.js
import axios from "axios";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 15 * 60 });

export const fetchEvents = async () => {
  const cached = cache.get("events");
  if (cached) return cached;

  // fetch from your source — REST API, RSS feed, etc.
  const response = await axios.get("https://your-venue.com/api/events", {
    timeout: 10000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const events = [];

  for (const raw of response.data) {
    const date = raw.date?.slice(0, 10) ?? null;
    if (!date || date < todayStr) continue;

    events.push({
      id: `yourvenue-${raw.id}`,
      eventName: raw.title,
      artistNames: [raw.headliner, ...raw.support].filter(Boolean),
      date,
      url: raw.url || null,
      venueName: null,
      city: null,
      region: null,
      countryCode: "US",
      time: null,
      image: null,
      dateTime: null,
      postalCode: null,
      distance: null,
      priceRange: null,
    });
  }

  cache.set("events", events);
  return events;
};
```

**Common data sources:**
- WordPress REST API (`/wp-json/wp/v2/event`) — works for any venue on WordPress + The Events Calendar plugin
- RSS/iCal feeds — many venue sites publish these
- JSON-LD structured data embedded in HTML — scrape the page and parse `<script type="application/ld+json">`
- Undocumented JSON endpoints — check the Network tab in DevTools on the venue's calendar page

### 3. Implement `enrichEvent()` — the per-match detail fetch

This is called only for events that matched a library artist, so it's fine to make one HTTP request per event. Use it to fill in venue, time, and artwork.

```js
// src/enrichEvent.js
import axios from "axios";
import NodeCache from "node-cache";
import { VENUE_MAP } from "./venues.js";

const cache = new NodeCache({ stdTTL: 60 * 60 });

export const enrichEvent = async (event) => {
  const cacheKey = event.url || event.id;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  if (!event.url) {
    cache.set(cacheKey, event);
    return event;
  }

  try {
    const { data: html } = await axios.get(event.url, { timeout: 8000 });

    // Extract what you need from the HTML — og:image, show time, venue, etc.
    const image = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ?? null;
    const time = html.match(/Show Starts.*?<p[^>]*>([^<]+)/is)?.[1]?.trim() ?? null;

    const enriched = { ...event, image, time, venueName: "Your Venue", city: "City", region: "ST" };
    cache.set(cacheKey, enriched);
    return enriched;
  } catch {
    cache.set(cacheKey, event);
    return event;
  }
};
```

### 4. Wire it together in `index.js`

```js
import { isNearVenue } from "./src/venues.js";
import { fetchEvents } from "./src/fetchEvents.js";
import { enrichEvent } from "./src/enrichEvent.js";

export default {
  id: "your-venue",           // must be unique across all loaded plugins
  name: "Your Venue Name",    // shown in Aurral's logs
  imageDomains: [             // optional — added to Aurral's CSP img-src at startup
    "https://your-venue.com",
    "https://*.your-venue.com",
  ],

  isRelevantForLocation(location) {
    return isNearVenue(location);
  },

  async fetchEvents({ location, radiusMiles }) {
    return fetchEvents();
  },

  async enrichEvent(event) {
    return enrichEvent(event);
  },
};
```

### 5. Set up bundling

Because Aurral loads plugins with a single dynamic `import()`, multi-file plugins must be bundled. Add this to your `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "build": "esbuild index.js --bundle --platform=node --format=esm --banner:js=\"import { createRequire } from 'module'; const require = createRequire(import.meta.url);\" --outfile=dist/your-venue.js"
  },
  "devDependencies": {
    "esbuild": "^0.25.0"
  }
}
```

The `createRequire` banner is required when any dependency (e.g. `node-cache`) is a CommonJS module — without it, `require()` calls in the bundle will throw at runtime in Node's ESM environment.

### PluginEvent shape (full reference)

```js
{
  id: string,              // unique ID scoped to this plugin, e.g. "yourvenue-123"
  eventName: string,       // full event title as listed on the venue site
  artistNames: string[],   // all billed artists in billing order
  date: string | null,     // YYYY-MM-DD
  url: string | null,      // canonical event page URL
  venueName: string | null,
  city: string | null,
  region: string | null,   // state/province code, e.g. "MN"
  countryCode: string,     // ISO 3166-1 alpha-2, e.g. "US"
  time: string | null,     // show start time, e.g. "8PM"
  image: string | null,    // artwork URL
  dateTime: string | null, // ISO 8601 combined date+time if available
  postalCode: string | null,
  distance: number | null, // miles from user location, if calculable
  priceRange: object | null,
}
```

### Tips

- **Keep `fetchEvents()` fast and cacheable.** It runs on every nearby-shows request. Cache aggressively (15 minutes is a good default).
- **`enrichEvent()` can be slow.** It only runs for matched shows, so a 1–2 second page fetch is fine.
- **Return the event un-enriched on error** rather than throwing. Aurral catches plugin errors but a thrown error in `enrichEvent()` drops the show entirely.
- **Prefix your event IDs** with something unique (`fa-`, `turf-`, etc.) to avoid collisions with other plugins.
- **`isRelevantForLocation()` should be cheap.** It's called before any network requests. A simple haversine check against a fixed coordinate is ideal.

## License

MIT
