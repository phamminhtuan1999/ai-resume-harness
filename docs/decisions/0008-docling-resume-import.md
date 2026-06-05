# 0008 Docling Resume Import

Date: 2026-06-05

## Status

Accepted

## Context

ApplyWise originally scoped resume input to pasted Markdown or plain text.
The requirement now expands resume input to include PDF, DOCX, image, and text
sources.

Resume import affects sensitive data handling, data model shape, backend
runtime dependencies, validation expectations, and user-visible behavior. It
also creates a new conversion step before the existing resume parser can safely
extract skills and experience.

Docling is a Python document-processing project that supports multiple document
formats, including PDF, DOCX, images, Markdown/plain text, and Markdown/JSON
exports. Its documentation also describes OCR support for scanned PDFs and
images, local execution capabilities for sensitive data, and Python/CLI usage.

References:

- https://github.com/docling-project/docling
- https://docling-project.github.io/docling/
- https://docling-project.github.io/docling/reference/cli/

## Decision

Use Docling in the Python backend as the MVP resume import normalization layer.

Accepted resume source types:

- pasted plain text
- pasted Markdown
- uploaded PDF
- uploaded DOCX
- uploaded image

Docling converts PDF, DOCX, and image inputs into canonical Markdown/text before
downstream resume parsing. The existing resume parser operates on that canonical
content and must still extract only what is present.

Docling is not the match-analysis AI model. It is a document conversion and OCR
step that prepares resume content for parsing, scoring, Truth Guard, roadmap,
and interview-prep workflows.

Original file retention is optional for MVP. If original files are retained,
they must be stored privately, scoped to the authenticated user, and deletable.
The default implementation may discard uploaded files after successful
conversion and persist only canonical content plus import metadata.

## Alternatives Considered

1. Keep pasted text only. Rejected because the updated requirement expects PDF,
   DOCX, image, and text resume input.
2. Use separate parsers for each format. Rejected for MVP because it increases
   complexity and makes parser quality harder to validate consistently.
3. Send files directly to an LLM for extraction. Rejected for MVP because it
   weakens privacy, makes costs less predictable, and bypasses deterministic
   conversion proof.
4. Use Docling as a normalization layer. Accepted because it fits the Python
   backend direction and supports the required document formats and OCR path.

## Consequences

Positive:

- Users can import common resume formats instead of manually copying text.
- The backend keeps one canonical resume content path for downstream AI
  workflows.
- OCR support can handle scanned PDFs and image resumes.
- Local conversion supports privacy-sensitive handling better than sending raw
  files directly to an LLM.

Tradeoffs:

- Backend dependencies become heavier.
- File upload size, runtime memory, OCR latency, and deployment host limits need
  explicit validation.
- Import failures need clear UI states and retry behavior.
- Some conversion output may require user review before AI parsing.

## Follow-Up

- Add backend dependency and conversion service only when US-004 enters
  implementation.
- Define accepted MIME types, size limits, and timeout limits before coding.
- Add fixture-based tests for text, Markdown, PDF, DOCX, image, unsupported
  type, and failed conversion.
- Decide whether original files are retained or discarded after conversion.
- If files are retained, add private storage and deletion validation.
