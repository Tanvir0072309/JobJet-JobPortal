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

// Asks Groq (using the user's own Groq API key, configured in Settings) for
// real companies near `location` that match `industry`, along with their
// careers page and a few example open roles - and saves the results as this
// user's companies/jobs. No geocoding or OpenStreetMap involved - it's a
// single AI call on the backend.
export function discoverCompanies(location: string, limit: number, industry: IndustryFocus = "any") {
  return apiRequest<DiscoverResult>("/api/companies/discover", {
    method: "POST",
    body: { location, limit, industry },
  });
}

export function deleteCompany(id: string) {
  return apiRequest(`/api/companies/${id}`, { method: "DELETE" });
}
