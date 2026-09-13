// Fetches REAL, currently-live job openings (not AI-generated/guessed ones)
// from Arbeitnow's public job board API - no API key required, no rate-limit
// key needed, and it returns actual postings with a real apply URL, company
// name, and location/remote info straight from the job board.
// Docs: https://www.arbeitnow.com/api/job-board-api
const ARBEITNOW_ENDPOINT = "https://www.arbeitnow.com/api/job-board-api";

// Arbeitnow's API doesn't take a location query param server-side - it
// returns a broad, mixed feed of currently open roles (mostly remote-first
// listings) and we filter/rank client-side (here, on our backend) by
// keyword/location so a search still feels targeted.
async function fetchRealJobs({ query = "", location = "", remoteOnly = false, page = 1 } = {}) {
  const url = new URL(ARBEITNOW_ENDPOINT);
  if (page > 1) url.searchParams.set("page", String(page));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = new Error(`Job board request failed with status ${res.status}`);
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  const rawJobs = Array.isArray(data?.data) ? data.data : [];

  const q = query.trim().toLowerCase();
  const loc = location.trim().toLowerCase();

  const filtered = rawJobs.filter((job) => {
    if (remoteOnly && !job.remote) return false;

    const haystack = `${job.title || ""} ${job.company_name || ""} ${(job.tags || []).join(" ")}`.toLowerCase();
    const matchesQuery = !q || haystack.includes(q);

    const jobLocation = String(job.location || "").toLowerCase();
    // A remote listing with no location string shouldn't be excluded just
    // because it doesn't literally mention the searched city/country.
    const matchesLocation = !loc || jobLocation.includes(loc) || (job.remote && !jobLocation);

    return matchesQuery && matchesLocation;
  });

  return filtered.slice(0, 40).map((job) => ({
    id: job.slug || `${job.company_name}-${job.title}`.toLowerCase().replace(/\s+/g, "-"),
    title: job.title,
    company: job.company_name,
    location: job.location || (job.remote ? "Remote" : "Not specified"),
    remote: !!job.remote,
    tags: job.tags || [],
    jobTypes: job.job_types || [],
    postedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
    applyUrl: job.url,
    description: job.description,
  }));
}

module.exports = { fetchRealJobs };
