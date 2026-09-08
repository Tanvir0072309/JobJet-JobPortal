import { apiRequest } from "./api";

export type Company = {
  id: string;
  name: string;
  location: string | null;
  website: string | null;
  career_page_url: string | null;
  work_mode: string | null;
  career_details_extracted: boolean;
  jobs: any[] | null;
  contacts: any[] | null;
};

export function listCompanies() {
  return apiRequest<{ success: boolean; companies: Company[] }>("/api/companies");
}

export type DiscoverResult = { success: boolean; inserted: number; found?: number; message: string };
export type IndustryFocus = "it" | "management" | "any";
export type Geo = { lat: number; lon: number; displayName: string };

// Finds nearby businesses with a website (Overpass) around `location`,
// saving new ones to this user's companies list. `industry` steers which
// kind of businesses to look for (see overpassService.js on the backend for
// the exact OSM tags used).
//
// `geo`, when provided, is a lat/lon already resolved on-device (see
// geocodeService.ts) - the backend skips its own Nominatim/Photon geocoding
// step and uses these coordinates directly. This is what avoids OSM's
// public geocoders blocking the backend's hosting-provider IP with a 403:
// the phone's ordinary network IP does the geocoding instead. If `geo` is
// omitted, the backend falls back to geocoding `location` itself (older
// app builds still work the same as before).
export function discoverCompanies(location: string, limit: number, industry: IndustryFocus = "any", geo?: Geo | null) {
  return apiRequest<DiscoverResult>("/api/companies/discover", {
    method: "POST",
    body: geo ? { location, limit, industry, lat: geo.lat, lon: geo.lon, displayName: geo.displayName } : { location, limit, industry },
  });
}

export function deleteCompany(id: string) {
  return apiRequest(`/api/companies/${id}`, { method: "DELETE" });
}
