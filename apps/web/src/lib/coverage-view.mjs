/*
  Deterministic keyword-coverage scorer (US-062, decision 0019). No LLM: pure
  text matching of the job's extracted keywords against (a) the base resume
  text and (b) the renderable Tailored CV content, so the panel can show
  "base 61% → tailored 84%" plus the missing list.

  Keywords the truth guard excluded (claims the candidate cannot support) are
  separated as notClaimable and removed from the denominator — the panel must
  never pressure the user into fabricating (decision 0019: Truth Guard owns
  the truth). This is tailoring coverage, NOT the match score; the decision
  label stays computed on the base resume.
*/

/* Mirror of the API's job-keyword extraction (_job_keywords in
   draft_cv_workflow.py): the US-047 structured job fields, deduped in order. */
export function extractJobKeywords(structuredJson) {
  if (!structuredJson || typeof structuredJson !== "object") return [];
  const keywords = [];
  for (const key of [
    "required_skills",
    "preferred_skills",
    "ai_requirements",
    "cloud_requirements",
  ]) {
    const values = structuredJson[key];
    for (const value of Array.isArray(values) ? values : []) {
      if (typeof value === "string" && value.trim()) {
        keywords.push(value.trim());
      }
    }
  }
  const seen = new Set();
  return keywords.filter((keyword) => {
    const key = normalize(keyword);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/* Whole-word/phrase match, case-insensitive; internal whitespace in a phrase
   matches any run of whitespace. Word boundaries are non-alphanumeric so
   "Go" never matches "Google" and "C++" still matches. */
function keywordPattern(keyword) {
  const escaped = String(keyword)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i");
}

function covers(text, keyword) {
  return keywordPattern(keyword).test(text || "");
}

/* The coverage report.
   keywords: the job's extracted keywords;
   baseText: raw base-resume text;
   tailoredTexts: the renderable CV content (summary, skill items, bullets);
   excludedKeywords: cv_strategy_json.keywords_excluded keyword names. */
export function coverageReport({ keywords, baseText, tailoredTexts, excludedKeywords }) {
  const all = Array.isArray(keywords) ? keywords : [];
  const excludedSet = new Set(
    (Array.isArray(excludedKeywords) ? excludedKeywords : [])
      .map((k) => normalize(typeof k === "object" && k !== null ? k.keyword : k))
      .filter(Boolean)
  );

  const notClaimable = all.filter((k) => excludedSet.has(normalize(k)));
  const claimable = all.filter((k) => !excludedSet.has(normalize(k)));
  const tailoredBlob = (Array.isArray(tailoredTexts) ? tailoredTexts : [])
    .filter(Boolean)
    .join("\n");

  const baseCovered = claimable.filter((k) => covers(baseText, k));
  const tailoredCovered = claimable.filter((k) => covers(tailoredBlob, k));
  const percent = (count) =>
    claimable.length ? Math.round((count / claimable.length) * 100) : 0;

  return {
    claimableCount: claimable.length,
    basePercent: percent(baseCovered.length),
    tailoredPercent: percent(tailoredCovered.length),
    delta: percent(tailoredCovered.length) - percent(baseCovered.length),
    covered: tailoredCovered,
    missing: claimable.filter((k) => !covers(tailoredBlob, k)),
    notClaimable,
  };
}

/* The renderable CV content fed to the tailored side: exactly what exports
   (summary + skill items + renderable bullet texts from buildDraftCvView). */
export function renderableCvTexts(view) {
  if (!view || typeof view !== "object") return [];
  const texts = [];
  if (view.professionalSummary) texts.push(view.professionalSummary);
  for (const group of Array.isArray(view.skills) ? view.skills : []) {
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      texts.push(String(item));
    }
  }
  for (const section of [view.workExperience, view.projects]) {
    for (const entry of Array.isArray(section) ? section : []) {
      for (const bullet of Array.isArray(entry?.bullets) ? entry.bullets : []) {
        texts.push(typeof bullet === "string" ? bullet : bullet?.text || "");
      }
    }
  }
  return texts.filter(Boolean);
}
