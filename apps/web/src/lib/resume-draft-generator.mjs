function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function asSuggestionList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function bullet(value) {
  return `- ${cleanText(value).replace(/\s+/g, " ")}`;
}

export function buildTailoredResumeDraft({ job, resume, suggestions }) {
  const safeSuggestions = asSuggestionList(suggestions).filter(
    (suggestion) => suggestion.truth_guard_status === "Safe to use"
  );
  const confirmationSuggestions = asSuggestionList(suggestions).filter(
    (suggestion) => suggestion.truth_guard_status === "Needs confirmation"
  );
  const title = `${cleanText(resume.title, "Resume")} tailored for ${cleanText(
    job.title,
    "target role"
  )}`;

  const safeLines = safeSuggestions.map((suggestion) =>
    bullet(suggestion.suggested_text)
  );
  const confirmationLines = confirmationSuggestions.map((suggestion) =>
    bullet(`${suggestion.suggested_text} [Needs confirmation before use]`)
  );

  const sections = [
    `# ${title}`,
    "",
    `Target company: ${cleanText(job.company, "Unknown company")}`,
    `Target role: ${cleanText(job.title, "Unknown role")}`,
    "",
    "## Evidence-backed positioning updates",
    safeLines.length > 0
      ? safeLines.join("\n")
      : "- No suggestions are currently marked Safe to use.",
    "",
    "## Items requiring confirmation",
    confirmationLines.length > 0
      ? confirmationLines.join("\n")
      : "- No suggestions currently require confirmation.",
    "",
    "## Canonical resume source",
    cleanText(resume.raw_text, "No canonical resume text available."),
  ];

  return {
    title,
    content_markdown: sections.join("\n"),
    included_suggestion_count: safeSuggestions.length + confirmationSuggestions.length,
    excluded_suggestion_count: asSuggestionList(suggestions).filter(
      (suggestion) => suggestion.truth_guard_status === "Do not use yet"
    ).length,
  };
}
