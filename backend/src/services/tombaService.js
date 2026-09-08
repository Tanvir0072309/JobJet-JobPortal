// Thin wrapper around Tomba.io's Domain Search API - used instead of
// Hunter.io so users can sign up for a free account themselves
// (https://app.tomba.io/auth/register, no sales contact required) and get
// an API key + secret pair right away.
// Docs: https://docs.tomba.io/
const TOMBA_BASE = "https://api.tomba.io/v1";

function extractDomain(website) {
  if (!website) return null;
  return website
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

// Tomba credentials are a { key, secret } pair (unlike Hunter's single
// apiKey) - stored together as a JSON string in api_credentials, the same
// way the SMTP config is stored. `credential` here is that parsed object.
async function domainSearch(domain, credential) {
  if (!credential?.key || !credential?.secret) {
    throw new Error("Tomba API key/secret not configured.");
  }

  const url = `${TOMBA_BASE}/domain-search?domain=${encodeURIComponent(domain)}`;

  const response = await fetch(url, {
    headers: {
      "X-Tomba-Key": credential.key,
      "X-Tomba-Secret": credential.secret,
      Accept: "application/json",
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.errors?.[0]?.detail || data?.message || "Tomba API request failed.";
    throw new Error(message);
  }

  return data?.data || null;
}

// Picks the single best contact to email out of Tomba's results: prefers
// HR/recruiting-type addresses, otherwise the highest-confidence email.
function pickBestContact(tombaData) {
  const emails = tombaData?.emails;
  if (!Array.isArray(emails) || emails.length === 0) return null;

  const PRIORITY_TYPES = ["hr", "recruiting", "recruitment", "executive", "management"];
  const sorted = [...emails].sort((a, b) => (b.score || b.confidence || 0) - (a.score || a.confidence || 0));
  const preferred = sorted.find((e) =>
    PRIORITY_TYPES.includes(String(e.department || e.position || "").toLowerCase())
  );
  const best = preferred || sorted[0];
  if (!best?.email) return null;

  return {
    email: best.email,
    confidence: best.score ?? best.confidence ?? null,
    type: best.department || best.position || "other",
  };
}

module.exports = { domainSearch, pickBestContact, extractDomain };
