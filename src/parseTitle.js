const DATE_SUFFIX_RE = /\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;

export const parseDateFromTitle = (title) => {
  const m = String(title || "").match(DATE_SUFFIX_RE);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
};

export const stripDateFromTitle = (title) =>
  String(title || "").replace(DATE_SUFFIX_RE, "").trim();

// Split multi-artist billings like "Artist A, Artist B, and Artist C" or "A + B".
// Does NOT split on "&" since that is often part of a band name (e.g. "Simon & Garfunkel").
export const parseArtistNames = (cleanTitle) =>
  cleanTitle
    .split(/,\s*(?:and\s+)?|\s+\+\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const cleanHtmlEntities = (str) =>
  String(str || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#8203;/g, "")
    .replace(/&#\d+;/g, "")
    .replace(/&[a-z]+;/gi, "")
    .trim();
