// Thin wrapper around Hunter.io's Domain Search API.
// Docs: https://hunter.io/api-documentation/v2#domain-search
const HUNTER_BASE = "https://api.hunter.io/v2";

function extractDomain(website) {
  if (!website) return null;
  return website
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

// One call per domain. Callers should only invoke this when a company does
// not already have a cached contact, so a bulk "apply to N companies" action
// calls Hunter at most once per company - never once per click/company pair.
async function domainSearch(domain, apiKey, { limit = 5 } = {}) {
  const url = `${HUNTER_BASE}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(
    apiKey
  )}&limit=${limit}`;

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.errors?.[0]?.details || data?.errors?.[0]?.id || "Hunter API request failed.";
    throw new Error(message);
  }

  return data?.data || null;
}

// Picks the single best contact to email out of Hunter's results: prefers
// HR/recruiting-type addresses, otherwise the highest-confidence email.
function pickBestContact(hunterData) {
  if (!hunterData?.emails?.length) return null;

  const PRIORITY_TYPES = ["hr", "recruiting", "recruitment", "executive", "management"];
  const sorted = [...hunterData.emails].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const preferred = sorted.find((e) =>
    PRIORITY_TYPES.includes(String(e.department || e.position || "").toLowerCase())
  );
  const best = preferred || sorted[0];
  if (!best?.value) return null;

  return {
    email: best.value,
    confidence: best.confidence ?? null,
    type: best.department || best.type || "other",
  };
}

module.exports = { domainSearch, pickBestContact, extractDomain };
