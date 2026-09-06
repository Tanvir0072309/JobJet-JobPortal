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

// Geocodes `location` (Nominatim) then finds nearby businesses with a
// website (Overpass), saving new ones to this user's companies list.
// `industry` steers which kind of businesses to look for (see
// overpassService.js on the backend for the exact OSM tags used).
export function discoverCompanies(location: string, limit: number, industry: IndustryFocus = "any") {
  return apiRequest<DiscoverResult>("/api/companies/discover", {
    method: "POST",
    body: { location, limit, industry },
  });
}

export function deleteCompany(id: string) {
  return apiRequest(`/api/companies/${id}`, { method: "DELETE" });
}
