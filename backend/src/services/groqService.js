// Thin wrapper around Groq's OpenAI-compatible chat completions endpoint.
// Docs: https://console.groq.com/docs/api-reference#chat-create
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

function buildPrompt({ profile, company, job, tone }) {
  const skills = [profile?.skills, profile?.programming_languages, profile?.frameworks]
    .flat()
    .filter(Boolean)
    .join(", ");

  return [
    `Candidate name: ${profile?.full_name || "The candidate"}`,
    profile?.headline ? `Headline: ${profile.headline}` : null,
    profile?.about_me ? `About: ${profile.about_me}` : null,
    skills ? `Key skills: ${skills}` : null,
    `Company: ${company?.name || "the company"}`,
    company?.industry ? `Industry: ${company.industry}` : null,
    job?.title ? `Target role: ${job.title}` : "Target role: a suitable open role (unspecified)",
    `Desired tone: ${tone || "professional"}`,
    "",
    "Write a short, personalized cold job-application email (120-180 words) from the candidate to this company.",
    "No placeholders like [Company] or [Your Name] - use the real values given.",
    'Respond ONLY as strict JSON: {"subject": "...", "body": "..."} - no markdown, no extra text.',
  ]
    .filter(Boolean)
    .join("\n");
}

// One Groq call per company per apply action - never repeated for the same
// company within a single batch-apply request.
async function generateApplicationEmail({ profile, company, job, tone }, apiKey) {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert career coach who writes concise, warm, specific job-application emails. Always respond with valid JSON only.",
        },
        { role: "user", content: buildPrompt({ profile, company, job, tone }) },
      ],
      temperature: 0.6,
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq API request failed.");
  }

  const raw = data?.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.subject || !parsed.body) throw new Error("incomplete");
    return parsed;
  } catch {
    return {
      subject: `Application for ${job?.title || "a role"} at ${company?.name || "your company"}`,
      body: raw,
    };
  }
}

// ---------------------------------------------------------------------------
// Company discovery via Groq (replaces the old OpenStreetMap/Overpass
// pipeline). Instead of geocoding the location and querying Overpass for
// nearby businesses, we simply ask the Groq model itself for real companies
// operating in/near the given location that match the requested industry
// focus, including their career page and a few currently-plausible open
// roles. This is a single Groq call per search (not per company).
// Human-readable focus line for each supported industry option. "any" (or
// anything not listed here) falls back to the no-restriction line below.
const INDUSTRY_FOCUS_LINES = {
  it: "Focus on IT / software / technology companies (product companies, software services, startups).",
  management: "Focus on management, consulting, and general business companies.",
  finance: "Focus on banking, fintech, investment, and financial services companies.",
  healthcare: "Focus on hospitals, clinics, healthtech, and pharmaceutical companies.",
  retail: "Focus on retail, e-commerce, and consumer goods companies.",
  marketing: "Focus on marketing, advertising, media, and PR agencies.",
  education: "Focus on schools, universities, edtech, and training companies.",
  manufacturing: "Focus on manufacturing, industrial, and engineering companies.",
  hospitality: "Focus on hotels, restaurants, travel, and hospitality companies.",
};

function buildDiscoveryPrompt({ location, industry, limit, workMode }) {
  const industryLine =
    INDUSTRY_FOCUS_LINES[industry] || "Include a good mix of company types (no single-industry restriction).";

  const workModeLine =
    workMode && workMode !== "any"
      ? `Only include companies that genuinely offer ${workMode} roles right now - skip any company that doesn't.`
      : null;

  return [
    `List up to ${limit} real, currently operating companies that have an office in or near: ${location}.`,
    industryLine,
    workModeLine,
    "Give a genuine MIX of company sizes - do NOT only list large, famous companies. Actively include smaller startups (roughly 10-50 employees) that are actually hiring right now, alongside any bigger names, and list the smaller companies first.",
    "Only include a company if you are reasonably confident it has a real, currently active careers/jobs page with at least one genuinely open role right now - if you can't name a specific, currently plausible open role, skip that company entirely.",
    "Only include companies you are reasonably confident actually exist and actively hire - do not invent companies.",
    "For each company give: its official website domain, its careers/jobs page URL (required - do not return a company without one), a short industry label, an approximate company size ('startup' for under ~50 employees, 'small' for ~50-200, 'mid' for ~200-1000, 'large' for 1000+), typical work mode (remote/hybrid/onsite/unknown), and 1-3 roles this company is plausibly hiring for right now (title + a one-sentence description + that specific role's work mode).",
    'Respond ONLY as strict JSON in this exact shape, no markdown, no extra text: {"companies": [{"name": "...", "website": "...", "industry": "...", "company_size": "...", "work_mode": "...", "career_page_url": "..." , "jobs": [{"title": "...", "work_mode": "...", "description": "..."}]}]}',
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeWebsite(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Smaller companies first - so genuine startups don't get buried under big,
// famous names in the results list.
const SIZE_RANK = { startup: 0, small: 1, mid: 2, large: 3, unknown: 4 };

// One Groq call per search request (never per company) - asks the model
// directly for company + career-page + role data instead of querying
// OpenStreetMap/Overpass. `limit` caps how many companies come back.
// `workMode`, when set to remote/hybrid/onsite, biases the search and is
// also enforced client-side below in case the model doesn't fully honor it.
async function discoverCompanies({ location, industry = "any", limit = 20, workMode = "any" }, apiKey) {
  if (!apiKey) throw new Error("Groq API key not configured.");

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a precise company-research assistant. You only report companies and details you are reasonably confident about, and you always respond with valid JSON only - no markdown, no commentary.",
        },
        { role: "user", content: buildDiscoveryPrompt({ location, industry, limit, workMode }) },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq API request failed.");
  }

  const raw = data?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Groq returned an unreadable response - please try again.");
  }

  const list = Array.isArray(parsed?.companies) ? parsed.companies : [];

  const seen = new Set();
  const companies = [];

  for (const item of list) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const website = normalizeWebsite(item?.website);
    const careerPageUrl = normalizeWebsite(item?.career_page_url);
    if (!name || !website) continue;

    const jobs = Array.isArray(item?.jobs)
      ? item.jobs
          .filter((j) => j && typeof j.title === "string" && j.title.trim())
          .map((j) => ({
            title: j.title.trim(),
            work_mode: ["remote", "hybrid", "onsite"].includes(j.work_mode) ? j.work_mode : "unknown",
            description: typeof j.description === "string" ? j.description.trim() : null,
          }))
      : [];

    // Only surface companies that actually have a real careers page AND at
    // least one plausible open role - otherwise there's nothing to apply to.
    if (!careerPageUrl || jobs.length === 0) continue;

    // Enforce the work-mode filter here too (don't just trust the model).
    const companyWorkMode = ["remote", "hybrid", "onsite"].includes(item?.work_mode) ? item.work_mode : "unknown";
    if (workMode && workMode !== "any") {
      const matches = companyWorkMode === workMode || jobs.some((j) => j.work_mode === workMode);
      if (!matches) continue;
    }

    const dedupeKey = `${name.toLowerCase()}|${website.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    companies.push({
      name,
      website,
      industry: typeof item?.industry === "string" ? item.industry.trim() : null,
      company_size: ["startup", "small", "mid", "large"].includes(item?.company_size)
        ? item.company_size
        : "unknown",
      work_mode: companyWorkMode,
      career_page_url: careerPageUrl,
      jobs,
      source: "groq",
    });
  }

  // Smaller companies (startups) first, as requested - not just the big names.
  companies.sort((a, b) => (SIZE_RANK[a.company_size] ?? 4) - (SIZE_RANK[b.company_size] ?? 4));

  return companies.slice(0, limit);
}

// Asks Groq to name (and explicitly confirm) a company's real, publicly
// known HIRING contact address - careers@, jobs@, hr@, recruiting@ etc on
// the company's own domain. Used only as a last-resort fallback when the
// company's own website couldn't be scraped for one. Groq is told to
// answer null/not-confident rather than invent something, and the caller
// still double-checks the shape of whatever comes back.
function buildHiringEmailPrompt({ company }) {
  return [
    `Company: ${company.name}`,
    company.website ? `Website: ${company.website}` : null,
    "What is this company's real, publicly-known HIRING/careers/HR/recruiting email address (e.g. careers@, jobs@, hr@, recruiting@ on their own domain)?",
    "This must specifically be a hiring/recruitment contact - never a general support, sales, or press address.",
    "Only answer with an address if you are reasonably confident it is genuinely used for hiring at this specific company. If you are not confident, say so honestly instead of guessing a generic pattern.",
    'Respond ONLY as strict JSON: {"email": "..." or null, "confident": true or false} - no markdown, no extra text.',
  ]
    .filter(Boolean)
    .join("\n");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findHiringEmailGuess({ company }, apiKey) {
  if (!apiKey) return null;

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You confirm real, publicly-known company hiring-email addresses. You never invent an address you aren't reasonably confident about, and you always respond with valid JSON only.",
        },
        { role: "user", content: buildHiringEmailPrompt({ company }) },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;

  const raw = data?.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.confident || typeof parsed?.email !== "string") return null;
    const email = parsed.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return null;
    return { email, confidence: 45 };
  } catch {
    return null;
  }
}

module.exports = { generateApplicationEmail, discoverCompanies, findHiringEmailGuess };
