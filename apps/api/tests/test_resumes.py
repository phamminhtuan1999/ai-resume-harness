from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, require_authenticated_user
from app.main import app
from app.schemas.resume import ResumeImportPreview


@pytest.fixture
def client() -> Iterator[TestClient]:
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_resume_import_preview_requires_authentication(client: TestClient) -> None:
    response = client.post(
        "/api/resumes/import/preview",
        files={"file": ("resume.txt", b"Resume content", "text/plain")},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}


def test_resume_import_preview_rejects_invalid_bearer_token(client: TestClient) -> None:
    response = client.post(
        "/api/resumes/import/preview",
        headers={"Authorization": "Bearer invalid-token"},
        files={"file": ("resume.txt", b"Resume content", "text/plain")},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}


def test_resume_import_preview_rejects_unsupported_file_type(client: TestClient) -> None:
    app.dependency_overrides[require_authenticated_user] = lambda: AuthenticatedUser(
        clerk_user_id="user_test"
    )

    response = client.post(
        "/api/resumes/import/preview",
        files={"file": ("resume.exe", b"not a resume", "application/octet-stream")},
    )

    assert response.status_code == 415
    assert response.json() == {"detail": "Unsupported resume file type."}


def test_resume_import_preview_accepts_plain_text(client: TestClient) -> None:
    app.dependency_overrides[require_authenticated_user] = lambda: AuthenticatedUser(
        clerk_user_id="user_test"
    )

    response = client.post(
        "/api/resumes/import/preview",
        files={"file": ("resume.txt", b"# Resume\n\nExperience", "text/plain")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "source_type": "text",
        "source_file_name": "resume.txt",
        "source_mime_type": "text/plain",
        "source_size_bytes": 20,
        "canonical_markdown": "# Resume\n\nExperience",
        "import_status": "succeeded",
    }


@pytest.mark.parametrize(
    ("file_name", "mime_type", "source_type"),
    [
        ("resume.pdf", "application/pdf", "pdf"),
        (
            "resume.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "docx",
        ),
        ("resume.png", "image/png", "image"),
        ("resume.jpg", "image/jpeg", "image"),
        ("resume.webp", "image/webp", "image"),
        ("resume.md", "text/markdown", "markdown"),
        ("resume.txt", "text/plain", "text"),
    ],
)
def test_resume_import_preview_accepts_supported_resume_mime_types(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    file_name: str,
    mime_type: str,
    source_type: str,
) -> None:
    app.dependency_overrides[require_authenticated_user] = lambda: AuthenticatedUser(
        clerk_user_id="user_test"
    )

    def fake_import_resume_file(
        *,
        file_name: str,
        mime_type: str,
        content: bytes,
    ) -> ResumeImportPreview:
        return ResumeImportPreview(
            source_type=source_type,
            source_file_name=file_name,
            source_mime_type=mime_type,
            source_size_bytes=len(content),
            canonical_markdown=f"converted {file_name}",
            import_status="succeeded",
        )

    monkeypatch.setattr("app.routers.resumes.import_resume_file", fake_import_resume_file)

    response = client.post(
        "/api/resumes/import/preview",
        files={"file": (file_name, b"resume bytes", mime_type)},
    )

    assert response.status_code == 200
    assert response.json() == {
        "source_type": source_type,
        "source_file_name": file_name,
        "source_mime_type": mime_type,
        "source_size_bytes": 12,
        "canonical_markdown": f"converted {file_name}",
        "import_status": "succeeded",
    }
