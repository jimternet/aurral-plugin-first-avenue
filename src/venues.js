export const VENUE_MAP = {
  "first-avenue": {
    name: "First Avenue",
    city: "Minneapolis",
    region: "MN",
    countryCode: "US",
  },
  "7th-st-entry": {
    name: "7th St Entry",
    city: "Minneapolis",
    region: "MN",
    countryCode: "US",
  },
  "fine-line": {
    name: "Fine Line",
    city: "Minneapolis",
    region: "MN",
    countryCode: "US",
  },
  "turf-club": {
    name: "Turf Club",
    city: "Saint Paul",
    region: "MN",
    countryCode: "US",
  },
  "palace-theatre": {
    name: "Palace Theatre",
    city: "Saint Paul",
    region: "MN",
    countryCode: "US",
  },
  "fitzgerald-theater": {
    name: "The Fitzgerald Theater",
    city: "Saint Paul",
    region: "MN",
    countryCode: "US",
  },
  "depot-tavern": {
    name: "The Depot Tavern",
    city: "Minneapolis",
    region: "MN",
    countryCode: "US",
  },
  "palace-pub": {
    name: "Palace Pub",
    city: "Saint Paul",
    region: "MN",
    countryCode: "US",
  },
  "mpls-cpac": {
    name: "MPLS CPAC",
    city: "Minneapolis",
    region: "MN",
    countryCode: "US",
  },
};

const MINNEAPOLIS_LAT = 44.9778;
const MINNEAPOLIS_LNG = -93.265;
const PROXIMITY_MILES = 150;

const haversineDistanceMiles = (lat1, lng1, lat2, lng2) => {
  const R = 3959;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const isNearMinneapolis = (location) => {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    haversineDistanceMiles(lat, lng, MINNEAPOLIS_LAT, MINNEAPOLIS_LNG) <=
    PROXIMITY_MILES
  );
};
