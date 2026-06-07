from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import AuthenticatedUser, require_authenticated_user
from app.schemas.resume import ResumeImportPreview
from app.services.resume_import import SUPPORTED_MIME_TYPES, import_resume_file
from app.settings import get_settings

router = APIRouter()


@router.post("/import/preview", response_model=ResumeImportPreview)
async def import_preview(
    file: UploadFile = File(...),
    _user: AuthenticatedUser = Depends(require_authenticated_user),
) -> ResumeImportPreview:
    settings = get_settings()
    content = await file.read()

    if len(content) > settings.resume_import_max_bytes:
        raise HTTPException(status_code=413, detail="Resume file is too large.")

    if file.content_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported resume file type.")

    return import_resume_file(
        file_name=file.filename or "resume",
        mime_type=file.content_type or "application/octet-stream",
        content=content,
    )
