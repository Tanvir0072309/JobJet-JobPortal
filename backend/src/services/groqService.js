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

// ---------------------------------------------------------------------
// Company discovery via Groq (replaces the old OpenStreetMap/Overpass
// pipeline in overpassService.js). Instead of asking a map API "what
// businesses are near this point", we ask the LLM directly for real
// companies that hire around a given location/industry, plus a best-guess
// careers page and a handful of example open roles for each - all in one
// Groq call per search, so a single "Search Companies" tap costs exactly
// one request no matter how many results come back.
//
// Caveat worth keeping in mind: this is a language model's knowledge, not a
// live web crawl. It can occasionally get a detail wrong or suggest a career
// page URL that has since moved, in a way that a real-time map/data source
// would not. We instruct it to only report companies it's confident really
// exist and to prefer well-known, verifiable names for this reason.
// ---------------------------------------------------------------------

function normalizeUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const WORK_MODES = ["remote", "hybrid", "onsite"];

function buildDiscoveryPrompt({ location, limit, industry }) {
  const industryLine =
    industry === "it"
      ? "Focus specifically on IT / software / technology companies (product companies, software services, startups, telecom, research labs)."
      : industry === "management"
      ? "Focus specifically on management, consulting, finance, and general business-operations companies."
      : "Any industry is fine, pick a good mix.";

  return [
    `List up to ${limit} real companies that have an office or a genuine hiring presence in or near "${location}".`,
    industryLine,
    "For every company give: its official name, its real official website (the root domain, e.g. https://example.com), its industry, and its best-guess careers/jobs page URL on that same domain (e.g. https://example.com/careers).",
    "Also give up to 3 example roles a candidate could realistically apply for there right now: a title, the likely work mode (remote, hybrid, or onsite), and a job_url - use the exact posting URL if you know it, otherwise reuse the careers page URL.",
    "Only include companies you're reasonably confident actually exist and actually operate in or near that location - never invent a company or a website. If you don't know an exact careers URL, give the standard careers path on their real domain instead of leaving it blank.",
    'Respond ONLY as strict JSON in this exact shape: {"companies": [{"name": "...", "website": "...", "industry": "...", "career_page_url": "...", "jobs": [{"title": "...", "work_mode": "...", "job_url": "..."}]}]} - no markdown, no commentary, no extra text.',
  ].join("\n");
}

// One Groq call per "Search Companies" tap, however many results come back.
async function discoverCompanies({ location, limit, industry }, apiKey) {
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
            "You are a knowledgeable, careful job-market research assistant. You only report companies, websites, and career details you are reasonably confident about, and you never fabricate a company that doesn't exist. Always respond with valid JSON only.",
        },
        { role: "user", content: buildDiscoveryPrompt({ location, limit, industry }) },
      ],
      temperature: 0.3,
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
    throw new Error("Groq returned an unexpected (non-JSON) response.");
  }

  const companies = Array.isArray(parsed?.companies) ? parsed.companies : [];

  return companies
    .filter((c) => c && typeof c.name === "string" && c.name.trim())
    .slice(0, limit)
    .map((c) => {
      const website = normalizeUrl(c.website);
      const careerPageUrl = normalizeUrl(c.career_page_url) || website;
      return {
        name: c.name.trim(),
        website,
        industry: typeof c.industry === "string" && c.industry.trim() ? c.industry.trim() : null,
        career_page_url: careerPageUrl,
        source: "groq",
        jobs: Array.isArray(c.jobs)
          ? c.jobs
              .filter((j) => j && typeof j.title === "string" && j.title.trim())
              .slice(0, 5)
              .map((j) => ({
                title: j.title.trim(),
                work_mode: WORK_MODES.includes(String(j.work_mode || "").toLowerCase())
                  ? String(j.work_mode).toLowerCase()
                  : "unknown",
                job_url: normalizeUrl(j.job_url) || careerPageUrl,
              }))
          : [],
      };
    });
}

module.exports = { generateApplicationEmail, discoverCompanies };
