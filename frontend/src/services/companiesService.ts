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

// Asks the backend to discover companies near `location` using Groq (an
// LLM call - see groqService.discoverCompanies on the backend), saving new
// ones to this user's companies list along with their career page and a
// handful of example open roles. `industry` steers what kind of companies
// to ask Groq for. Requires the user to have a Groq API key saved in
// Settings; the backend returns a GROQ_NOT_CONFIGURED error code if not.
export function discoverCompanies(location: string, limit: number, industry: IndustryFocus = "any") {
  return apiRequest<DiscoverResult>("/api/companies/discover", {
    method: "POST",
    body: { location, limit, industry },
  });
}

export function deleteCompany(id: string) {
  return apiRequest(`/api/companies/${id}`, { method: "DELETE" });
}
