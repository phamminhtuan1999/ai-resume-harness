from pathlib import Path

from app.settings import Settings


def test_settings_ignore_extra_local_env_values(tmp_path: Path) -> None:
    env_file = tmp_path / ".env.local"
    env_file.write_text(
        "\n".join(
            [
                "APPLYWISE_API_ENV=test",
                "SUPABASE_DB_URL=postgresql://postgres:password@example.com:5432/postgres",
            ]
        ),
        encoding="utf-8",
    )

    settings = Settings(_env_file=env_file)

    assert settings.api_env == "test"
