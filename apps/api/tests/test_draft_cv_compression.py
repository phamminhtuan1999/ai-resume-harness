"""US-045 tests: render config, deterministic selection-only compression with a
protected floor + report, the measure loop, and the page-override contract.

The strongest proof is on the produced PDF (pypdf page counts; dropped text
absent, protected text present) and on the invariant that a compressed model
is always a subset of the gated render model — compression can only remove.
"""

from __future__ import annotations

import io

from pypdf import PdfReader

from app.services.export.compress import (
    MAX_LEVEL,
    build_compressed_render_model,
    is_protected,
    score_bullet,
)
from app.services.export.options import RenderOptions
from app.services.export.pdf_renderer import render_pdf_paged
from app.services.export.render_config import get_render_config
from app.services.export.render_model import build_render_model


def _bullet(text: str, *, status: str = "safe_to_use", action: str = "pending",
            keywords: list[str] | None = None) -> dict:
    return {
        "id": f"b-{abs(hash(text)) % 10_000}",
        "text": text,
        "source_evidence": "ev",
        "truth_guard_status": status,
        "user_action": action,
        "keywords_used": keywords or [],
    }


def _entry(company: str, bullets: list[dict]) -> dict:
    return {"company": company, "title": "Engineer", "start_date": "2020",
            "end_date": "2024", "bullets": bullets}


def _pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


# --- render config --------------------------------------------------------------


def test_render_config_table_complete() -> None:
    for target in (1, 2, 3):
        for density in ("compact", "standard", "spacious"):
            cfg = get_render_config(target, density)
            assert cfg.page_target == target
            assert cfg.density == density
            # px-read-as-pt sizes (decision 0014 §4).
            assert (cfg.name_pt, cfg.heading_pt, cfg.body_pt, cfg.meta_pt) == (18, 12, 10, 9)
            assert cfg.recent_bullet_cap >= cfg.older_bullet_cap >= 1


def test_render_config_legacy_when_no_target() -> None:
    cfg = get_render_config(None)
    assert cfg.page_target is None
    assert cfg.body_pt == 10.5  # Period 9 layout preserved
    assert cfg.recent_bullet_cap > 50  # effectively no compression


def test_density_caps_increase_with_room() -> None:
    compact = get_render_config(1, "compact")
    standard = get_render_config(1, "standard")
    spacious = get_render_config(1, "spacious")
    assert compact.recent_bullet_cap < standard.recent_bullet_cap < spacious.recent_bullet_cap
    assert compact.summary_cap < standard.summary_cap < spacious.summary_cap


# --- scoring + floor ------------------------------------------------------------


def test_score_is_additive_keyword_metric_plain() -> None:
    pri = {"kubernetes"}
    kw_metric = _bullet("Scaled Kubernetes to cut costs 40%.", keywords=["Kubernetes"])
    kw_only = _bullet("Deployed Kubernetes clusters.", keywords=["Kubernetes"])
    impact_only = _bullet("Cut costs by 40%.")
    plain = _bullet("Maintained internal tooling.")
    # 3*keyword + 2*impact + 1*number: keyword+metric is highest; keyword-only
    # and impact-only both land at 3; plain is 0.
    assert score_bullet(kw_metric, pri) == 6
    assert score_bullet(kw_only, pri) == 3
    assert score_bullet(impact_only, pri) == 3
    assert score_bullet(plain, pri) == 0
    assert score_bullet(kw_metric, pri) > score_bullet(kw_only, pri) > score_bullet(plain, pri)


def test_is_protected_floor() -> None:
    pri = {"fastapi"}
    assert is_protected(_bullet("Reduced latency by 38%."), pri)  # impact metric
    assert is_protected(_bullet("Built FastAPI services.", keywords=["FastAPI"]), pri)  # keyword
    assert not is_protected(_bullet("Mentored two interns."), pri)


def test_protected_bullets_never_dropped_even_over_cap() -> None:
    # 5 protected bullets in one entry, compact recent cap is 4: all survive.
    protected = [_bullet(f"Cut metric {i} by {i}0%.") for i in range(1, 6)]
    cv = {"work_experience": [_entry("Acme", protected)], "projects": []}
    cfg = get_render_config(1, "compact")
    model, report = build_compressed_render_model(cv, config=cfg, level=MAX_LEVEL)
    kept = model["work_experience"][0]["bullets"]
    assert len(kept) == 5  # floor beats the cap of 4
    assert report["protected_kept"] == 5
    assert not any(d["kind"] == "bullet" for d in report["dropped"])


# --- subset invariant + determinism ---------------------------------------------


def _voluminous_cv() -> dict:
    return {
        "candidate": {"full_name": "Dana Engineer"},
        "professional_summary": (
            "Senior engineer with broad backend experience. " * 8
        ),
        "skills": [
            {"category": "Backend", "items": ["FastAPI", "Django", "Flask"]},
            {"category": "More", "items": ["fastapi", "Redis"]},  # dup FastAPI
        ],
        "work_experience": [
            _entry("Acme", [_bullet(f"Maintained subsystem {i} for the team.") for i in range(6)]),
            _entry("Globex", [_bullet(f"Supported service {i} in production.") for i in range(6)]),
            _entry("Initech", [_bullet(f"Handled ticket queue {i} weekly.") for i in range(6)]),
            _entry("Umbrella", [_bullet(f"Wrote docs for module {i}.") for i in range(6)]),
        ],
        "projects": [
            {"name": f"Project {i}", "tech_stack": [], "links": [],
             "bullets": [_bullet(f"Shipped feature {i}.")]}
            for i in range(4)
        ],
        "education": [],
        "certifications": [],
    }


def test_compressed_is_always_subset_of_gated_model() -> None:
    cv = _voluminous_cv()
    base = build_render_model(cv)
    base_texts = {
        b for section in ("work_experience", "projects")
        for entry in base[section] for b in entry["bullets"]
    }
    cfg = get_render_config(1, "compact")
    for level in range(MAX_LEVEL + 1):
        model, _ = build_compressed_render_model(cv, config=cfg, level=level)
        out_texts = {
            b for section in ("work_experience", "projects")
            for entry in model[section] for b in entry["bullets"]
        }
        assert out_texts <= base_texts, f"level {level} leaked non-gated content"


def test_levels_progressively_compress() -> None:
    cv = _voluminous_cv()
    cfg = get_render_config(1, "standard")

    def bullet_count(model: dict) -> int:
        return sum(
            len(e["bullets"]) for s in ("work_experience", "projects") for e in model[s]
        )

    counts = [
        bullet_count(build_compressed_render_model(cv, config=cfg, level=lvl)[0])
        for lvl in range(MAX_LEVEL + 1)
    ]
    assert counts == sorted(counts, reverse=True)  # monotonically non-increasing
    assert counts[0] > counts[MAX_LEVEL]  # something actually compressed


def test_level_zero_no_compression_when_within_caps() -> None:
    cv = {
        "professional_summary": "Short summary.",
        "skills": [{"category": "Backend", "items": ["FastAPI"]}],
        "work_experience": [_entry("Acme", [_bullet("Built one service.")])],
        "projects": [],
    }
    cfg = get_render_config(1, "compact")
    _model, report = build_compressed_render_model(cv, config=cfg, level=0)
    assert report["applied"] is False
    assert report["dropped"] == []
    assert report["steps_applied"] == []


def test_skill_dedupe_at_level_two() -> None:
    cv = _voluminous_cv()
    cfg = get_render_config(1, "standard")
    model, report = build_compressed_render_model(cv, config=cfg, level=2)
    all_items = [i.lower() for g in model["skills"] for i in g["items"]]
    assert len(all_items) == len(set(all_items))  # no dupes across groups
    assert "fastapi" in report["skills_deduped"] or "FastAPI" in report["skills_deduped"]


def test_summary_truncated_at_sentence_boundary_level_three() -> None:
    cfg = get_render_config(1, "compact")
    cv = {"professional_summary": "Senior engineer with broad backend experience. " * 8,
          "work_experience": [], "projects": []}
    model, report = build_compressed_render_model(cv, config=cfg, level=3)
    summary = model["professional_summary"]
    assert report["summary_truncated"] is True
    assert len(summary) <= cfg.summary_cap
    assert summary.endswith(".")  # sentence boundary, never mid-word


def test_compression_is_deterministic() -> None:
    cv = _voluminous_cv()
    cfg = get_render_config(1, "compact")
    a_model, a_report = build_compressed_render_model(cv, config=cfg, level=2)
    b_model, b_report = build_compressed_render_model(cv, config=cfg, level=2)
    assert a_model == b_model
    assert a_report == b_report


# --- measure loop (produced PDF) ------------------------------------------------


def test_measure_loop_fits_one_page_and_reports_drops() -> None:
    cv = _voluminous_cv()
    content, report, model, info = render_pdf_paged(
        cv, RenderOptions(page_target=1, density="compact")
    )
    assert content[:5] == b"%PDF-"
    assert info.pages == 1
    assert report["measured_pages"] == 1
    assert report["page_overflow"] is False
    assert report["applied"] is True
    # A dropped bullet's text is absent from the PDF but listed in the report.
    dropped_texts = [d["text"] for d in report["dropped"] if d["kind"] == "bullet"]
    assert dropped_texts
    pdf_text = _pdf_text(content)
    assert all(d not in pdf_text for d in dropped_texts)


def test_larger_target_drops_less() -> None:
    cv = _voluminous_cv()
    _c1, r1, _m1, _i1 = render_pdf_paged(cv, RenderOptions(page_target=1, density="compact"))
    _c2, r2, _m2, _i2 = render_pdf_paged(cv, RenderOptions(page_target=2, density="standard"))
    assert len(r2["dropped"]) <= len(r1["dropped"])


def test_protected_floor_overflow_keeps_evidence() -> None:
    # 8 entries x 5 long protected bullets (each an impact metric): far more
    # than one page, and the floor cannot be cut to fit.
    cv = {
        "candidate": {"full_name": "Dana"},
        "professional_summary": "",
        "skills": [],
        "work_experience": [
            _entry(
                f"Co{e}",
                [
                    _bullet(
                        f"Raised KPI {e}-{i} by {i+1}0% year over year while mentoring "
                        "engineers and improving the reliability of core production services."
                    )
                    for i in range(5)
                ],
            )
            for e in range(8)
        ],
        "projects": [],
        "education": [],
        "certifications": [],
    }
    content, report, _model, info = render_pdf_paged(
        cv, RenderOptions(page_target=1, density="compact")
    )
    assert info.pages > 1  # floor overflows a single page
    assert report["page_overflow"] is True
    assert not any(d["kind"] == "bullet" for d in report["dropped"])  # nothing dropped
    text = _pdf_text(content)
    assert "Raised KPI 0-0" in text  # protected evidence present


def test_docx_renders_the_same_compressed_model() -> None:
    from docx import Document

    from app.services.export.docx_renderer import render_docx

    cv = _voluminous_cv()
    opts = RenderOptions(page_target=1, density="compact")
    _pdf, report, model, _info = render_pdf_paged(cv, opts)
    doc = Document(io.BytesIO(render_docx(model, opts)))
    docx_text = "\n".join(p.text for p in doc.paragraphs)

    # DOCX body uses the (target, density) config size, not the legacy 10.5pt.
    assert doc.styles["Normal"].font.size.pt == get_render_config(1, "compact").body_pt
    dropped = [d["text"] for d in report["dropped"] if d["kind"] == "bullet"]
    assert dropped and all(d not in docx_text for d in dropped)  # parity with PDF drops
    kept = [b for e in model["work_experience"] for b in e["bullets"]]
    assert all(k in docx_text for k in kept)  # kept content present in both


def test_measure_loop_is_deterministic() -> None:
    cv = _voluminous_cv()
    opts = RenderOptions(page_target=1, density="compact")
    _c1, r1, _m1, i1 = render_pdf_paged(cv, opts)
    _c2, r2, _m2, i2 = render_pdf_paged(cv, opts)
    assert i1.pages == i2.pages
    assert r1["level"] == r2["level"]
    assert r1["dropped"] == r2["dropped"]
