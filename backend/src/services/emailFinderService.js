// Shared "find the company's real hiring email" pipeline, used both at
// search time (companiesController.discoverCompanies, so the email shows up
// immediately in results) and at apply time (applicationsController, as a
// cache-miss fallback for companies added before this existed).
//
// Rule: only a genuine HIRING contact is ever accepted (careers@, jobs@,
// hr@, recruiting@, talent@...) - never a generic info@/contact@/support@
// address, even if that's all a company's website exposes. If the
// configured finder (Hunter, or JobJet's own website scraper) can't turn up
// a hiring-type address, no email is returned at all - fewer emails, but
// every one that is used is accurate.
//
// NOTE: this used to also fall back to asking Groq to "confirm" a hiring
// email from its own training knowledge (findHiringEmailGuess). That was
// removed - an LLM has no way to actually know whether a mailbox exists
// today, so it would confidently return addresses that had never existed
// or no longer did (e.g. "jobs@loopio.com" -> hard "no such user" bounce),
// which contradicted the accuracy-first rule this module claims to
// enforce. Only emails actually found in a real source (Hunter's verified
// database, or literally printed on the company's own website) are ever
// used now.
const hunterService = require("./hunterService");
const websiteEmailScraper = require("./websiteEmailScraper");
const { getCredential } = require("../utils/credentials");
const dns = require("dns").promises;

const HIRING_TYPES = ["hr", "hiring", "recruiting", "recruitment", "careers", "jobs", "talent", "people"];

function isHiringType(type) {
  return HIRING_TYPES.includes(String(type || "").toLowerCase());
}

// Cheap sanity check before we ever hand an address to the sender: does its
// domain even accept mail? This can't catch a mailbox that doesn't exist on
// an otherwise-valid mail server, but it does catch dead/parked/typo'd
// domains up front instead of letting them bounce after send.
async function hasMailServer(email) {
  const domain = String(email || "").split("@")[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

// Returns { email, confidence, type, source } | null
async function findHiringEmail({ userId, company }) {
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
    best = null; // finder failure just means "no email found"
  }

  if (best?.email && isHiringType(best.type) && (await hasMailServer(best.email))) {
    return { email: best.email, confidence: best.confidence ?? null, type: best.type, source: finder.name };
  }

  return null;
}

module.exports = { findHiringEmail, isHiringType };
