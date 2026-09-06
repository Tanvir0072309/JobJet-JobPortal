// Company discovery: geocode a free-text location with Nominatim (OSM's free
// geocoder), then query the Overpass API for nearby businesses that have a
// website tag. No API key needed for either service, but both are shared
// public infrastructure - keep requests low-volume and always send a
// descriptive User-Agent (Nominatim's usage policy requires this and will
// block generic/browser-looking User-Agents).
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "JobJetApp/1.0 (company-discovery; contact: set-your-support-email@example.com)";

const DEFAULT_RADIUS_METERS = 8000; // ~5 miles

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// Turns "Ahmedabad, Gujarat" into { lat, lon, displayName }. Returns null if
// nothing matches.
async function geocodeLocation(location) {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(location)}&format=json&limit=1`;
  const { signal, cancel } = withTimeout(10000);

  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal,
    });
  } finally {
    cancel();
  }

  if (!response.ok) {
    throw new Error(`Nominatim geocoding failed (status ${response.status}).`);
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const best = results[0];
  return {
    lat: parseFloat(best.lat),
    lon: parseFloat(best.lon),
    displayName: best.display_name,
  };
}

// Tags that reliably mark "a business", as opposed to e.g. a residential
// building. We only keep results that also carry a website/contact:website
// tag, since a company we can't email is useless to this app.
const BUSINESS_KEYS = ["office", "shop", "craft", "company"];

// Lets the search be steered toward the kind of company the user actually
// wants to apply to, using OSM's office=* subtype tagging (it has a
// dedicated "it" value for software/IT companies).
const INDUSTRY_PRESETS = {
  it: [
    { key: "office", value: "it" },
    { key: "office", value: "coworking" },
    { key: "office", value: "telecommunication" },
    { key: "office", value: "research" },
  ],
  management: [
    { key: "office", value: "company" },
    { key: "office", value: "consulting" },
    { key: "office", value: "financial" },
    { key: "office", value: "financial_advisor" },
    { key: "office", value: "estate_agent" },
    { key: "office", value: "government" },
  ],
  any: null, // falls back to the broad BUSINESS_KEYS existence-only query below
};

function buildOverpassQuery(lat, lon, radiusMeters, limit, industry) {
  const around = `(around:${radiusMeters},${lat},${lon})`;
  const preset = INDUSTRY_PRESETS[industry];

  const clauses = preset
    ? preset.map(({ key, value }) => `  nwr["${key}"="${value}"]["website"]${around};\n  nwr["${key}"="${value}"]["contact:website"]${around};`)
    : BUSINESS_KEYS.map((key) => `  nwr["${key}"]["website"]${around};\n  nwr["${key}"]["contact:website"]${around};`);

  return `[out:json][timeout:25];\n(\n${clauses.join("\n")}\n);\nout center ${Math.min(limit * 3, 200)};`;
}

function normalizeWebsite(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function tagToIndustry(tags) {
  for (const key of BUSINESS_KEYS) {
    if (tags[key] && tags[key] !== "yes") return tags[key];
  }
  return null;
}

// Returns an array of { name, website, industry, source } for businesses
// near the geocoded point that have a name and a usable website.
async function findNearbyCompanies({ lat, lon, radiusMeters = DEFAULT_RADIUS_METERS, limit = 20, industry = "any" }) {
  const query = buildOverpassQuery(lat, lon, radiusMeters, limit, industry in INDUSTRY_PRESETS ? industry : "any");
  const { signal, cancel } = withTimeout(25000);

  let response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal,
    });
  } finally {
    cancel();
  }

  if (!response.ok) {
    throw new Error(`Overpass query failed (status ${response.status}). It may be rate-limited - try again shortly.`);
  }

  const data = await response.json();
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  const seen = new Set();
  const companies = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name;
    const website = normalizeWebsite(tags.website || tags["contact:website"]);
    if (!name || !website) continue;

    const dedupeKey = `${name.toLowerCase()}|${website.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    companies.push({
      name,
      website,
      industry: tagToIndustry(tags),
      source: "openstreetmap",
    });

    if (companies.length >= limit) break;
  }

  return companies;
}

module.exports = { geocodeLocation, findNearbyCompanies };
