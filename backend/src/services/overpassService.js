// NOTE: no longer used by companiesController.js - company discovery now
// goes through groqService.discoverCompanies() instead (see
// companiesController.js for the current pipeline). Left in place, unused,
// in case OSM-based discovery is ever wanted again as a fallback/option.
//
// Company discovery: geocode a free-text location with Nominatim (OSM's free
// geocoder), then query the Overpass API for nearby businesses that have a
// website tag. No API key needed for either service, but both are shared
// public infrastructure - keep requests low-volume and always send a
// descriptive User-Agent (Nominatim's usage policy requires this and will
// block generic/browser-looking User-Agents).
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Nominatim's public instance outright blocks a large share of requests
// coming from cloud/hosting-provider IP ranges (Render, Railway, Vercel,
// etc. all share pools of outbound IPs), independent of the User-Agent -
// that's what was showing up in the app as "geocoding failed (403)" even
// though the header setup below is already correct. Retrying the same
// request against the same server doesn't help with an IP-level block, so
// on any failure (or an empty result) we fall back to Photon (komoot's free,
// independently-hosted OSM geocoder) instead. No API key needed for either.
const PHOTON_URL = "https://photon.komoot.io/api/";

// Overpass has several independently-run public mirrors. The main
// overpass-api.de instance aggressively rate-limits/blocks shared hosting
// IPs (Render, Railway, etc. all share pools of outbound IPs with lots of
// other traffic), which is what was showing up to the app as a 403. Falling
// through to another mirror on a 403/429 fixes this without needing a paid
// key.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a real identifying User-Agent - a placeholder like
// "example.com" is indistinguishable from a bot to them and is one of the
// things that gets requests blocked with a 403. Set JOBJET_CONTACT_EMAIL in
// backend/.env to your own support email/app URL so requests reliably go
// through under your app's own identity instead of hitting the shared quota
// meant for people who forgot to configure this.
const CONTACT = process.env.JOBJET_CONTACT_EMAIL || "no-reply@jobjet.app";
const USER_AGENT = `JobJetApp/1.0 (company-discovery; contact: ${CONTACT})`;

const DEFAULT_RADIUS_METERS = 8000; // ~5 miles

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Turns "Ahmedabad, Gujarat" into { lat, lon, displayName }. Returns null if
// nothing matches. Retries once on a 403/429 in case it was a transient
// block, since Nominatim's public instance can be flaky under shared load.
async function geocodeWithNominatim(location, attempt = 0) {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(location)}&format=json&limit=1`;
  const { signal, cancel } = withTimeout(10000);

  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", Referer: CONTACT },
      signal,
    });
  } finally {
    cancel();
  }

  if ((response.status === 403 || response.status === 429) && attempt < 1) {
    await sleep(1500);
    return geocodeWithNominatim(location, attempt + 1);
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

// Photon fallback - same shape as geocodeWithNominatim above. Used whenever
// Nominatim errors out (commonly a hard IP-range block on hosted backends)
// or simply can't find the place.
async function geocodeWithPhoton(location) {
  const url = `${PHOTON_URL}?q=${encodeURIComponent(location)}&limit=1`;
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
    throw new Error(`Photon geocoding failed (status ${response.status}).`);
  }

  const data = await response.json();
  const feature = Array.isArray(data?.features) ? data.features[0] : null;
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  const props = feature.properties || {};
  const displayName =
    [props.name, props.city || props.county, props.state, props.country].filter(Boolean).join(", ") ||
    location;

  return { lat, lon, displayName };
}

async function geocodeLocation(location) {
  let nominatimError = null;

  try {
    const result = await geocodeWithNominatim(location);
    if (result) return result;
  } catch (err) {
    nominatimError = err;
  }

  // Either Nominatim errored (likely a blocked hosting IP) or found
  // nothing - try the independent Photon service before giving up.
  try {
    const result = await geocodeWithPhoton(location);
    if (result) return result;
    if (nominatimError) throw nominatimError;
    return null;
  } catch (photonError) {
    if (nominatimError) {
      throw new Error(
        `${nominatimError.message} Fallback geocoder also failed: ${photonError.message}`
      );
    }
    throw photonError;
  }
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
async function queryOverpassMirrors(query) {
  let lastError;

  for (const overpassUrl of OVERPASS_URLS) {
    const { signal, cancel } = withTimeout(25000);
    try {
      const response = await fetch(overpassUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });

      if (response.status === 403 || response.status === 429) {
        // This mirror is blocking/rate-limiting us right now - try the next one.
        lastError = new Error(`Overpass mirror ${overpassUrl} returned ${response.status}.`);
        continue;
      }

      if (!response.ok) {
        lastError = new Error(`Overpass query failed (status ${response.status}).`);
        continue;
      }

      return await response.json();
    } catch (err) {
      lastError = err;
    } finally {
      cancel();
    }
  }

  throw new Error(
    `${lastError?.message || "Overpass query failed."} All OpenStreetMap company-search mirrors are currently unavailable or rate-limited - please try again shortly.`
  );
}

async function findNearbyCompanies({ lat, lon, radiusMeters = DEFAULT_RADIUS_METERS, limit = 20, industry = "any" }) {
  const query = buildOverpassQuery(lat, lon, radiusMeters, limit, industry in INDUSTRY_PRESETS ? industry : "any");
  const data = await queryOverpassMirrors(query);
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
