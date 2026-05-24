# aurral-plugin-first-avenue

An [Aurral](https://github.com/leekelly/aurral) show source plugin that adds concerts from all **First Avenue Productions** venues in Minneapolis / Saint Paul to your nearby shows feed.

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

First Avenue's website runs on WordPress and exposes a public REST API at `first-avenue.com/wp-json/wp/v2/event`. The plugin uses this to get a lightweight list of upcoming shows — artist names, dates, and event page URLs — without any authentication.

**Two-phase fetch:**

1. **`fetchEvents()`** — Calls the WordPress REST API to retrieve events published in the last six months (covering most announced upcoming shows). Parses artist names and show dates from each event title, filters to the next 90 days, and returns a lightweight list. Results are cached for 15 minutes.

2. **`enrichEvent()`** — Called by Aurral only for shows that match an artist in your library. Fetches the individual event page and scrapes the venue name and show time from the HTML. Results are cached per event for one hour.

This two-phase approach means the plugin only makes individual page requests for shows you actually care about, not for every event on the calendar.

**Location gating:** The plugin activates only when your configured location is within 150 miles of Minneapolis. Outside that radius it returns nothing, so it doesn't clutter results if you're searching another city.

**Artist matching and deduplication** are handled by Aurral's core. The plugin just returns event data; Aurral checks each event's artist list against your library, recommended, and trending artists using the same fuzzy matching it uses for Ticketmaster. If the same show appears in both Ticketmaster and this plugin, the Ticketmaster version wins (it has richer data: price, distance, images).

## Data availability

| Field | Source |
|-------|--------|
| Artist names | Event title (parsed) |
| Show date | Event title (M/D/YY suffix) or slug (YYYY-MM, approximate) |
| Show time | Event page HTML |
| Venue name | Event page HTML |
| City / region | Hardcoded per venue |
| Event URL | WordPress REST API |
| Ticket price | Not available |
| Distance | Not available |
| Artist image | Not available |

## Installation

### 1. Install Aurral with plugin support

This plugin requires the plugin system PR to be merged into Aurral, or applied manually to your installation.

### 2. Add the plugin to your Aurral plugins directory

**Option A — copy the built file**

```bash
cp /path/to/aurral-plugin-first-avenue/index.js /path/to/aurral/plugins/first-avenue.js
```

Because the plugin uses ES module imports across multiple source files, you'll need to bundle it first if you copy this way:

```bash
cd aurral-plugin-first-avenue
npm install
npm run build
cp dist/first-avenue.js /path/to/aurral/plugins/first-avenue.js
```

**Option B — symlink during development**

```bash
ln -s /path/to/aurral-plugin-first-avenue/dist/first-avenue.js /path/to/aurral/plugins/first-avenue.js
```

### 3. Restart Aurral

On startup, Aurral loads every `.js` file from the `plugins/` directory. You should see:

```
[plugins] Registered show source: First Avenue Productions
```

To use a different directory, set `AURRAL_PLUGINS_DIR` in your environment before starting Aurral.

## Plugin interface

This plugin implements the Aurral show source plugin interface v1:

```js
{
  // Unique identifier for this plugin
  id: string,

  // Human-readable name shown in logs
  name: string,

  // Return false to skip this plugin for a given location.
  // Aurral won't call fetchEvents() if this returns false.
  isRelevantForLocation(location: Location): boolean,

  // Return a lightweight list of upcoming events.
  // Aurral calls this once per nearby-shows request (results are cached internally).
  fetchEvents({ location: Location, radiusMiles: number }): Promise<PluginEvent[]>,

  // Return an enriched copy of the event with venue + time populated.
  // Aurral calls this only for events that matched an artist in the user's library.
  enrichEvent(event: PluginEvent): Promise<PluginEvent>,
}
```

### PluginEvent shape

```js
{
  id: string,           // unique ID scoped to this plugin, e.g. "fa-12345"
  eventName: string,    // full event title
  artistNames: string[], // all billed artists in billing order
  date: string | null,  // YYYY-MM-DD (may be approximate if sourced from slug)
  url: string | null,   // canonical event page URL
  venueName: string | null,  // populated by enrichEvent()
  city: string | null,       // populated by enrichEvent()
  region: string | null,     // populated by enrichEvent()
  countryCode: string,       // always "US" for this plugin
  time: string | null,       // show start time, populated by enrichEvent()
  // the following are not available from this source:
  image: null,
  dateTime: null,
  postalCode: null,
  distance: null,
  priceRange: null,
}
```

## Building your own plugin

Any object that implements `id`, `fetchEvents()`, and optionally `isRelevantForLocation()` and `enrichEvent()` can be registered as a show source. See the interface above and this plugin's source as a reference implementation.

Good candidates for additional plugins:
- Other independent venue groups with public REST APIs or RSS feeds
- Regional ticketing platforms not covered by Ticketmaster or SeatGeek
- City-specific event aggregators

## License

MIT
