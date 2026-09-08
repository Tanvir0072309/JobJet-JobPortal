// Finds a company's contact email by reading their own public website -
// no third-party API, no signup, no key. Used as the always-available
// fallback for email-finder services like Hunter/Tomba, which increasingly
// block personal/webmail signups and so aren't reachable by every user.
//
// Strategy: fetch the homepage plus a handful of common "contact us" /
// "careers" style paths, pull out mailto: links and plain-text email
// addresses, filter out obvious noise (tracking pixels, placeholder
// domains, no-reply addresses, image/font filenames that look like
// emails), and pick the best match - preferring role-based addresses
// (hr@, careers@, jobs@...) on the company's own domain.

const CANDIDATE_PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/contactus",
  "/about",
  "/about-us",
  "/careers",
  "/career",
  "/jobs",
  "/team",
];

const FETCH_TIMEOUT_MS = 6000;
const MAX_PAGES = 4; // homepage + up to 3 more, to keep total time bounded

const ROLE_PREFIXES = ["hr", "careers", "career", "jobs", "job", "recruiting", "recruitment", "talent", "hiring", "people"];
const GENERIC_PREFIXES = ["contact", "info", "hello", "enquiries", "enquiry", "support", "team"];

const NOISE_PATTERNS = [
  /noreply/i,
  /no-reply/i,
  /donotreply/i,
  /example\.com$/i,
  /\.(png|jpe?g|gif|svg|webp|woff2?|ttf|css|js)$/i,
  /sentry\.io$/i,
  /wixpress\.com$/i,
  /schema\.org$/i,
  /w3\.org$/i,
  /godaddy\.com$/i,
  /@2x/i,
  /\.\d+x\./i, // e.g. name@2x.png style asset filenames caught by the regex below
];

function extractDomain(website) {
  if (!website) return null;
  return website
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

function isNoise(email) {
  return NOISE_PATTERNS.some((re) => re.test(email));
}

function domainMatches(emailDomain, rootDomain) {
  return emailDomain === rootDomain || emailDomain.endsWith(`.${rootDomain}`);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobJetBot/1.0; +https://github.com/Tanvir0072309/JobJet-JobPortal)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text")) return null;
    return await response.text();
  } catch {
    return null; // timeouts, DNS failures, refused connections - all just mean "no data from this page"
  } finally {
    clearTimeout(timer);
  }
}

function extractCandidateEmails(html) {
  const emails = new Set();

  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  let match;
  while ((match = mailtoRegex.exec(html))) {
    emails.add(match[1].toLowerCase());
  }

  const plainRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((match = plainRegex.exec(html))) {
    emails.add(match[0].toLowerCase());
  }

  return [...emails].filter((e) => !isNoise(e));
}

function scoreEmail(email, rootDomain) {
  const [prefix, domain] = email.split("@");
  const onDomain = domain && domainMatches(domain, rootDomain);

  let tier = 0; // higher is better
  let type = "general";
  if (ROLE_PREFIXES.some((p) => prefix.startsWith(p))) {
    tier = 3;
    type = "hr";
  } else if (GENERIC_PREFIXES.some((p) => prefix.startsWith(p))) {
    tier = 2;
    type = "contact";
  } else {
    tier = 1;
  }
  if (onDomain) tier += 2; // strongly prefer addresses on the company's own domain

  // Confidence is deliberately capped well below a verified-mailbox
  // service's score, since this is pattern-matched from a public page,
  // not SMTP-verified.
  const confidence = Math.min(35 + tier * 10, 75);

  return { tier, confidence, type, onDomain };
}

// Returns { email, confidence, type, source: 'website' } | null
async function scrapeCompanyEmail(website) {
  const rootDomain = extractDomain(website);
  if (!rootDomain) return null;

  const base = `https://${rootDomain}`;
  const paths = CANDIDATE_PATHS.slice(0, MAX_PAGES);

  let best = null;

  for (const path of paths) {
    const html = await fetchText(`${base}${path}`);
    if (!html) continue;

    const candidates = extractCandidateEmails(html);
    for (const email of candidates) {
      const scored = scoreEmail(email, rootDomain);
      if (!best || scored.tier > best.tier) {
        best = { email, ...scored };
      }
    }

    // Found a strong, on-domain, role-based address - no need to keep
    // crawling further pages.
    if (best && best.tier >= 5) break;
  }

  if (!best) return null;
  return { email: best.email, confidence: best.confidence, type: best.type, source: "website" };
}

// Matches the { email, confidence, type } shape returned by
// tombaService.pickBestContact / hunterService.pickBestContact, so it can
// slot into the same emailFinder interface in applicationsController.
function pickBestContact(result) {
  if (!result?.email) return null;
  return { email: result.email, confidence: result.confidence, type: result.type };
}

module.exports = { scrapeCompanyEmail, pickBestContact, extractDomain };
