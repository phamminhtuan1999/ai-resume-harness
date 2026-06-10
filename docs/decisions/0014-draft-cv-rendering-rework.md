# 0014 Draft CV Rendering Rework (Page Policy, Fonts, Compression)

Date: 2026-06-09

## Status

Accepted (extends `0013-draft-cv-export-architecture.md`; inherits
`0012-ai-workflow-standards.md`)

## Context

Period 9 shipped a correct Draft CV pipeline: truth-guarded structured JSON →
one shared render model → fpdf2 PDF + python-docx DOCX, with preview, PDF, and
DOCX provably identical. The *documents* it produces are not yet
submission-grade:

1. **Glyph loss.** fpdf2 core fonts are latin-1. The renderer's own separators
   (`•` bullets, `–` date ranges, `—` title joins) and data-borne curly quotes
   are outside latin-1, so `_safe()` replace-encoded them to `?` in real
   user exports ("Senior Software Engineer ? DATAHOUSE ASIA (Oct 2022 ?
   Present)"). An interim transliteration hotfix (intake #41, trace #85,
   2026-06-09) degrades them to ASCII; full diacritics still degrade ("Đặng
   Quốc Tuấn" → "Dang Quoc Tuan" in PDF). DOCX was always correct.
2. **No page-length intelligence.** The export renders however long the
   content runs; nothing recommends or enforces a page count appropriate to
   the candidate's experience.
3. **One hardcoded layout.** Single fixed font (core Helvetica), fixed sizes
   and margins; no controlled font system, no density variants.
4. **No compression.** Overflowing content simply spills to page 2+.

The Period 10 brief (`docs/stories/period-10/brief.md`, verbatim user
requirement 2026-06-09) asks for: an AI-recommended page count with a rules
table keyed on years of experience, a LaTeX-style font-profile system
(`modern_latex | ats_clean | classic_latex`), page-aware render configs, an
ordered compression strategy, DOCX font mapping, UI display of the
recommendation, and a user page-count override.

Several brief suggestions conflict with the system as built (full adversarial
review: `docs/stories/period-10/README.md`). The load-bearing conflicts:

- **"The AI determines the page count"** vs. the brief's own deterministic
  rules table and decisions 0012/0013, which require protocol guarantees as
  server code, not prompt hopes. `user_profiles.years_of_experience` is a
  first-class column the server can read.
- **Named proprietary fonts** ("Arial", "Times New Roman") cannot be
  redistributed or embedded by ApplyWise; official Latin Modern ships CFF/OTF,
  which fpdf2 cannot embed (TrueType outlines only).
- **DOCX primary/fallback font pairs** do not exist in OOXML; Word substitutes
  missing fonts unpredictably and python-docx does not embed fonts.
- **Compression step "reduce bullet wording while preserving meaning"** would
  rewrite claim text *after* the Truth Guard ran against the generated text —
  a guard bypass that can mint unverified claims at export time.
- **Compression applied "before export"** would desynchronize the preview from
  the file, breaking Period 9's core invariant (one render model feeds
  preview, PDF, and DOCX).
- **Font sizes in px** are CSS-thinking; PDF/DOCX are point-based and 10px ≈
  7.5pt is illegible.

This is high-risk, architecture-shaping work: external provider prompt/schema
change, a data-model migration, binary assets with licensing duties on a PII
document surface, and export-content selection (an audit/trust surface). It is
recorded before implementation so US-043–US-046 inherit one direction.

## Decision

**1. A deterministic server page policy clamps the model.** A pure
`page_policy.py` computes the authoritative policy from the brief's bands:

```text
yoe 0–2   → target 1, max 1
yoe 3–7   → target 1, max 2 (2 only with justification: evidence volume)
yoe 8–12  → target 2 for senior/staff signals, else 1; max 2
yoe 12+   → target 2; max 3 only behind the exceptional gate
SE default (ApplyWise main user): target 1; allow 2 when yoe >= 5 or the
evidence volume trigger fires.
```

Years of experience comes from `user_profiles.years_of_experience` first, then
a conservative span-parse of profile work-history dates, else a default band
(target 1, max 2) plus a `yoe_unknown` quality note. Job seniority is optional
enrichment (`jobs.structured_json` + title keywords), same stance as Period 9
took for missing-skill analysis. The 3-page "exceptional cases" gate requires
mechanical proxies (title keywords principal/staff/distinguished/research, or
profile publication/patent markers) — never the model's say-so. The model's
`rendering_recommendation.recommended_page_count` is **clamped** into the
policy's allowed range; disagreement is recorded as a `policy_clamped` quality
note. The model contributes the human-readable `page_count_reason`,
`layout_density`, and `compression_strategy` rationale strings (display-only).

**2. Three font profiles, vendored libre TTFs, embedded in PDF; one universal
font name per profile in DOCX.** PDF embeds subsetted TrueType fonts vendored
in-repo with their license files (license review is a stop condition before
vendoring):

- `modern_latex` → **CMU Serif** (Computer Modern Unicode — the LaTeX look,
  TTF, libre)
- `ats_clean` → **Liberation Sans** (Arial-metric-compatible, SIL OFL)
- `classic_latex` → **Liberation Serif** (Times-metric-compatible, SIL OFL)

The embedded path is full Unicode: real `•`/`–`/`—`, curly quotes, and full
diacritics render as themselves. DOCX cannot embed via python-docx and OOXML
has no per-run fallback chain, so DOCX names exactly one font guaranteed on
every machine: `modern_latex` → "Times New Roman" (the brief's own fallback,
applied directly for predictability), `ats_clean` → "Arial", `classic_latex` →
"Times New Roman". Fallback when a vendored asset is missing/corrupt: core
Helvetica/Times + the existing `_safe()` transliteration (the 2026-06-09
hotfix becomes the permanent safety net) + an export note. A font problem must
never fail an export. Default profile: `modern_latex`.

**3. Compression is selection-only, ordered, deterministic, and lives inside
the shared render-model build.** Export-time compression never rewrites claim
text — wording-to-fit is a *generation-time* concern (the prompt tells the
model its page target). The mechanical steps, applied in order until the
measured page count fits the target: drop least-relevant bullets beyond
per-entry caps (recency- and relevance-ranked), reduce older-entry detail,
limit projects to the most job-relevant, merge overlapping skill groups,
truncate the professional summary at a sentence boundary. A **protected
floor** — job-critical evidence, real metrics, recent highly relevant
experience — is never dropped; if the floor alone overflows the target, the
export proceeds with a `page_overflow` note (the brief's own policy endorses
this). The same compressed model feeds preview, export-preview, PDF, and DOCX,
plus a machine-readable compression report listing every dropped/condensed
item (silently shrinking a user-approved CV is a trust violation). Same inputs
→ same document, so re-exports are reproducible.

**4. A typed `RenderConfig` keyed by (page target, density).** The brief's px
values are read **as points** (name 18pt / heading 12pt / body 10pt / metadata
9pt), margins converted in→mm. Per-entry bullet caps are config, the 240-char
bullet cap stays. Page-count enforcement is a bounded measure loop on the PDF
(render → count pages via the produced bytes → apply the next compression step
→ re-render), because fpdf2 paginates only at render time and the PDF is the
only measurable surface. DOCX receives the identical compressed model and
equivalent font/size/spacing settings: content parity is guaranteed and
tested; page parity is best-effort by construction (python-docx has no layout
engine — Word paginates).

**5. The user override is a render parameter, not stored state.** Export and
export-preview endpoints accept `pages`, validated to the policy's allowed
range. Versions stay append-only — no stored mutation, no new version. An
override below the recommendation returns server-computed warning copy (brief
§8: "some detail may be compressed").

**6. Rendering metadata lives in `draft_cvs.rendering_json` (migration 0019,
additive).** The clamped recommendation + policy snapshot + the model's
pre-clamp values. `cv_json` stays pure reviewable content
(`assign_bullet_ids` already strips strategy/notes/confidence). Pre-0019
version rows render with legacy defaults (`modern_latex`, no page targeting)
and the UI offers "regenerate for a recommendation".

## Alternatives Considered

1. **Implement the brief literally** (model-owned page count, proprietary
   fonts, model-authored compression strings as behavior, export-time-only
   compression, px sizes). Rejected — violates the 0012/0013 guard model,
   creates a Truth Guard bypass, breaks preview==export, cannot legally
   redistribute the named fonts, and Word's font substitution makes the DOCX
   pairs fiction.
2. **Switch renderers (WeasyPrint or browser-rendered HTML) to get CSS layout
   + font fallback for free.** Rejected — WeasyPrint's native deps are exactly
   why 0013 was amended to fpdf2; a Chromium runtime for one feature was
   already rejected in 0013. fpdf2 with embedded TTFs covers everything this
   period needs.
3. **Name "Latin Modern Roman" in DOCX and rely on Word substitution.**
   Rejected for predictability — most readers lack LM Roman; Word substitutes
   from its own tables. Times New Roman (the brief's own fallback) is applied
   directly. Flagged as an open question for the product owner.
4. **AI-powered compression (model picks/rewrites what to cut).** Rejected —
   reintroduces nondeterminism and unverified claims at export time; selection
   must be explainable and reproducible. The model's `compression_strategy`
   strings remain display-only rationale.
5. **Store rendering recommendation inside `cv_json`.** Rejected — `cv_json`
   is the reviewable content contract consumed by the review UI and renderers;
   mixing render metadata in would leak non-content through the review surface
   and complicate the US-040 PATCH path. A sibling column keeps both contracts
   clean.
6. **Persist per-export overrides (or new versions per override).** Rejected —
   versions are append-only generation artifacts; an override is ephemeral
   render input. `last_exported_*_at` stamps already record that an export
   happened.

## Consequences

Positive: exports are reproducible (same version + options → same bytes
modulo PDF metadata), full-Unicode, and page-count-aware; preview == PDF ==
DOCX still holds because compression happens inside the one render-model
build; truth-guard gating is untouched (selection can only *remove* renderable
content, never add or rewrite); every dropped item is user-visible in the
compression report; font assets are libre with licenses vendored.

Tradeoffs: ~5–10 MB of font binaries enter the repo with ongoing license
hygiene; the measure loop costs up to a few renders per export (acceptable —
fpdf2 renders are milliseconds at CV scale); px-read-as-pt is an
interpretation of the brief (converging with current sizes, recorded here);
DOCX page parity is best-effort only; per-entry bullet caps and ranking
weights are taste parameters frozen by US-045 and tuned later; legacy
(pre-0019) drafts keep legacy rendering until regenerated.

## Follow-Up

- US-043 implements the policy, schema/prompt extension, migration `0019`,
  clamping + storage; US-044 the font registry, vendored assets, embedded
  PDF fonts, DOCX names, fallback; US-045 RenderConfig, compression +
  report + measure loop, override; US-046 the UI panel + override control.
  Strict order (044 before 045: compression must be tuned on final font
  metrics).
- Stop conditions: font licenses failing review (block vendoring), the
  measure loop failing to converge deterministically, or any need to rewrite
  bullet text to fit — pause and update this decision.
- Open questions flagged in `docs/stories/period-10/README.md`: modern_latex
  DOCX naming, compression aggressiveness defaults, recommendation panel
  visibility on `needs_review` drafts.
- Post-MVP candidates: user-facing font picker, WYSIWYG paginated preview,
  cover-letter export reuse of the font system.
