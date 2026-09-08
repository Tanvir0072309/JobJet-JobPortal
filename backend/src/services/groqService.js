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
function buildDiscoveryPrompt({ location, industry, limit }) {
  const industryLine =
    industry === "it"
      ? "Focus on IT / software / technology companies (product companies, software services, startups)."
      : industry === "management"
      ? "Focus on management, consulting, finance, and general business companies."
      : "Include a good mix of company types (no single-industry restriction).";

  return [
    `List up to ${limit} real, currently operating companies that have an office in or near: ${location}.`,
    industryLine,
    "Only include companies you are reasonably confident actually exist and actively hire - do not invent companies.",
    "For each company give: its official website domain, its careers/jobs page URL if you know one (otherwise null), a short industry label, typical work mode (remote/hybrid/onsite/unknown), and 1-3 example roles this company plausibly hires for right now (title + a one-sentence description). These example roles are your best estimate, not a live listing.",
    'Respond ONLY as strict JSON in this exact shape, no markdown, no extra text: {"companies": [{"name": "...", "website": "...", "industry": "...", "work_mode": "...", "career_page_url": "..." , "jobs": [{"title": "...", "work_mode": "...", "description": "..."}]}]}',
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

// One Groq call per search request (never per company) - asks the model
// directly for company + career-page + role data instead of querying
// OpenStreetMap/Overpass. `limit` caps how many companies come back.
async function discoverCompanies({ location, industry = "any", limit = 20 }, apiKey) {
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
        { role: "user", content: buildDiscoveryPrompt({ location, industry, limit }) },
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
    if (!name || !website) continue;

    const dedupeKey = `${name.toLowerCase()}|${website.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const jobs = Array.isArray(item?.jobs)
      ? item.jobs
          .filter((j) => j && typeof j.title === "string" && j.title.trim())
          .map((j) => ({
            title: j.title.trim(),
            work_mode: ["remote", "hybrid", "onsite"].includes(j.work_mode) ? j.work_mode : "unknown",
            description: typeof j.description === "string" ? j.description.trim() : null,
          }))
      : [];

    companies.push({
      name,
      website,
      industry: typeof item?.industry === "string" ? item.industry.trim() : null,
      work_mode: ["remote", "hybrid", "onsite"].includes(item?.work_mode) ? item.work_mode : "unknown",
      career_page_url: normalizeWebsite(item?.career_page_url),
      jobs,
      source: "groq",
    });

    if (companies.length >= limit) break;
  }

  return companies;
}

module.exports = { generateApplicationEmail, discoverCompanies };
