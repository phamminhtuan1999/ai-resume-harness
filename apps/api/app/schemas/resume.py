from pydantic import BaseModel, Field


class ResumeImportPreview(BaseModel):
    source_type: str
    source_file_name: str
    source_mime_type: str
    source_size_bytes: int = Field(ge=0)
    canonical_markdown: str
    import_status: str

