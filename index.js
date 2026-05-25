/**
 * Aurral show source plugin — First Avenue Productions
 *
 * Covers all First Avenue Productions venues in Minneapolis / Saint Paul:
 *   First Avenue · 7th St Entry · Fine Line · Turf Club · Palace Theatre
 *   The Fitzgerald Theater · The Depot Tavern · Palace Pub · MPLS CPAC
 *
 * No API key required. Data is sourced from first-avenue.com's public
 * WordPress REST API and individual event pages.
 *
 * Plugin interface (v1):
 *   id                            string
 *   name                          string
 *   isRelevantForLocation(loc)    boolean  — skip the plugin when false
 *   fetchEvents({ location, radiusMiles })
 *     → Promise<PluginEvent[]>    lightweight event list; no per-event HTTP calls
 *   enrichEvent(event)
 *     → Promise<PluginEvent>      fetches venue + show time; called only for matches
 *
 * PluginEvent shape:
 *   id           string           unique ID scoped to this plugin (e.g. "fa-12345")
 *   eventName    string           full event title as listed on the venue site
 *   artistNames  string[]         all billed artists in billing order
 *   date         string|null      YYYY-MM-DD  (approximate for slug-derived dates)
 *   url          string|null      canonical event page URL
 *   venueName    string|null      populated after enrichEvent()
 *   city         string|null      populated after enrichEvent()
 *   region       string|null      populated after enrichEvent()
 *   countryCode  string           always "US" for this plugin
 *   time         string|null      show start time, populated after enrichEvent()
 */

import { isNearMinneapolis } from "./src/venues.js";
import { fetchEvents } from "./src/fetchEvents.js";
import { enrichEvent } from "./src/enrichEvent.js";

const plugin = {
  id: "first-avenue",
  name: "First Avenue Productions",
  imageDomains: ["https://first-avenue.com", "https://*.first-avenue.com"],

  isRelevantForLocation(location) {
    return isNearMinneapolis(location);
  },

  async fetchEvents({ location, radiusMiles }) {
    return fetchEvents();
  },

  async enrichEvent(event) {
    return enrichEvent(event);
  },
};

export default plugin;
