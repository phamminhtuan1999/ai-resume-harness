from pathlib import Path
from tempfile import NamedTemporaryFile

from app.schemas.resume import ResumeImportPreview

SUPPORTED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/png": "image",
    "image/jpeg": "image",
    "image/webp": "image",
    "text/markdown": "markdown",
    "text/plain": "text",
}


def import_resume_file(
    *,
    file_name: str,
    mime_type: str,
    content: bytes,
) -> ResumeImportPreview:
    source_type = SUPPORTED_MIME_TYPES[mime_type]

    if source_type in {"text", "markdown"}:
        canonical_markdown = content.decode("utf-8", errors="replace")
    else:
        canonical_markdown = _convert_with_docling(file_name=file_name, content=content)

    return ResumeImportPreview(
        source_type=source_type,
        source_file_name=file_name,
        source_mime_type=mime_type,
        source_size_bytes=len(content),
        canonical_markdown=canonical_markdown,
        import_status="succeeded",
    )


def _convert_with_docling(*, file_name: str, content: bytes) -> str:
    from docling.document_converter import DocumentConverter

    suffix = Path(file_name).suffix or ".resume"
    with NamedTemporaryFile(suffix=suffix) as temp_file:
        temp_file.write(content)
        temp_file.flush()

        result = DocumentConverter().convert(temp_file.name)
        return result.document.export_to_markdown()

