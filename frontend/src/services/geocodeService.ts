// Backend's overpassService.js already tries Nominatim then falls back to
// Photon, but BOTH are public OSM geocoders that commonly hard-block
// requests coming from cloud/hosting-provider IP ranges (Render, Railway,
// etc.) regardless of User-Agent - that's the root cause of the
// "geocoding failed (403)" error, and it can hit both fallbacks equally
// since they're blocking the backend's IP, not anything about the request
// itself.
//
// The fix: do the geocoding from the phone instead. A mobile device's
// network is an ordinary residential/carrier IP, not a shared hosting IP,
// so it isn't caught by that block. This runs client-side and sends the
// resolved lat/lon straight to the backend, which skips its own geocode
// step when coordinates are already provided (see companiesController.js).
// If this fails for any reason (offline, both services down, etc.) the
// caller can still fall back to sending the raw location string and let
// the backend try its own (still-present) Nominatim -> Photon fallback.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const PHOTON_URL = "https://photon.komoot.io/api/";

// Nominatim's usage policy requires a real identifying User-Agent (a
// placeholder like "example.com" gets requests blocked as bot traffic).
// Unlike a website's fetch() in a browser, React Native's fetch lets us set
// this freely since there's no browser enforcing the forbidden-headers list.
const USER_AGENT = "JobJetApp/1.0 (company-discovery; mobile client)";

export type GeoResult = { lat: number; lon: number; displayName: string };

async function geocodeWithNominatim(location: string): Promise<GeoResult | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(location)}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Nominatim geocoding failed (status ${response.status}).`);

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const best = results[0];
  return { lat: parseFloat(best.lat), lon: parseFloat(best.lon), displayName: best.display_name };
}

async function geocodeWithPhoton(location: string): Promise<GeoResult | null> {
  const url = `${PHOTON_URL}?q=${encodeURIComponent(location)}&limit=1`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Photon geocoding failed (status ${response.status}).`);

  const data = await response.json();
  const feature = Array.isArray(data?.features) ? data.features[0] : null;
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  const props = feature.properties || {};
  const displayName =
    [props.name, props.city || props.county, props.state, props.country].filter(Boolean).join(", ") || location;

  return { lat, lon, displayName };
}

// Returns null (rather than throwing) on any failure - callers should treat
// null as "couldn't geocode on-device, fall back to sending the raw
// location string and let the backend try."
export async function geocodeOnDevice(location: string): Promise<GeoResult | null> {
  try {
    const result = await geocodeWithNominatim(location);
    if (result) return result;
  } catch {
    // fall through to Photon below
  }

  try {
    return await geocodeWithPhoton(location);
  } catch {
    return null;
  }
}
