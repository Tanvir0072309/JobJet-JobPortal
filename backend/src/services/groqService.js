// Thin wrapper around Groq's OpenAI-compatible chat completions endpoint.
// Docs: https://console.groq.com/docs/api-reference#chat-create
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

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

module.exports = { generateApplicationEmail };
