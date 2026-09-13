import { apiRequest } from "./api";

export type RealJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  tags: string[];
  jobTypes: string[];
  postedAt: string | null;
  applyUrl: string;
  description: string;
};

// Hits a real public job board on the backend (not an AI guess) - every
// result is a currently-open posting with a genuine apply link.
export function searchRealJobs(params: { query?: string; location?: string; remoteOnly?: boolean }) {
  const qs = new URLSearchParams();
  if (params.query) qs.set("query", params.query);
  if (params.location) qs.set("location", params.location);
  if (params.remoteOnly) qs.set("remoteOnly", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest<{ success: boolean; jobs: RealJob[]; message: string }>(`/api/jobs/search${suffix}`);
}
