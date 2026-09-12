// Shared "find the company's real hiring email" pipeline, used both at
// search time (companiesController.discoverCompanies, so the email shows up
// immediately in results) and at apply time (applicationsController, as a
// cache-miss fallback for companies added before this existed).
//
// Rule: only a genuine HIRING contact is ever accepted (careers@, jobs@,
// hr@, recruiting@, talent@...) - never a generic info@/contact@/support@
// address, even if that's all a company's website exposes. If the
// configured finder (Hunter, or JobJet's own website scraper) can't turn up
// a hiring-type address, we fall back to asking Groq to confirm the
// company's real hiring email from its own knowledge, as a last resort.
// If nothing hiring-specific can be confirmed either way, no email is
// returned at all - fewer emails, but every one that is used is accurate.
const hunterService = require("./hunterService");
const websiteEmailScraper = require("./websiteEmailScraper");
const groqService = require("./groqService");
const { getCredential } = require("../utils/credentials");

const HIRING_TYPES = ["hr", "hiring", "recruiting", "recruitment", "careers", "jobs", "talent", "people"];

function isHiringType(type) {
  return HIRING_TYPES.includes(String(type || "").toLowerCase());
}

// Returns { email, confidence, type, source } | null
async function findHiringEmail({ userId, company, groqKey }) {
  if (!company?.website) return null;

  const hunterKey = await getCredential(userId, "hunter");
  const finder = hunterKey
    ? {
        name: "hunter",
        extractDomain: hunterService.extractDomain,
        search: (domain) => hunterService.domainSearch(domain, hunterKey),
        pick: hunterService.pickBestContact,
      }
    : {
        name: "website",
        extractDomain: websiteEmailScraper.extractDomain,
        search: (_domain, website) => websiteEmailScraper.scrapeCompanyEmail(website),
        pick: websiteEmailScraper.pickBestContact,
      };

  let best = null;
  try {
    const domain = finder.extractDomain(company.website);
    const raw = await finder.search(domain, company.website);
    best = finder.pick(raw);
  } catch {
    best = null; // finder failure just means "try the fallback"
  }

  if (best?.email && isHiringType(best.type)) {
    return { email: best.email, confidence: best.confidence ?? null, type: best.type, source: finder.name };
  }

  // The site had nothing hiring-specific (or nothing at all) - ask Groq to
  // confirm the real hiring email from its own knowledge, as a last resort.
  if (groqKey) {
    const guess = await groqService.findHiringEmailGuess({ company }, groqKey).catch(() => null);
    if (guess?.email) {
      return { email: guess.email, confidence: guess.confidence, type: "hiring", source: "groq" };
    }
  }

  return null;
}

module.exports = { findHiringEmail, isHiringType };
