#!/usr/bin/env python3
"""
Phase 2 — KG Coverage Test
Goal: measure what fraction of our 67 KG job_family values can be mapped
to a SOC code in the Atlas unified_exposure dataset.

Output: prints a coverage table + writes data/external/kg-soc-mapping.json
with explicit mappings (and explicit "unmapped" markers for the empty-state
UI per the user's "honest empty state" choice).
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / "data/external/jobs-exposure-atlas/unified_exposure.csv"
OUT = ROOT / "data/external/kg-soc-mapping.json"

# Frozen 67-value KG job_family enum (from market_signals.job_family, 2026-05-02)
KG_FAMILIES = [
    "accountant","architect","backend_developer","bank_teller","bpo_l1_support",
    "brand_manager","business_analyst","call_center_agent","chartered_accountant",
    "civil_engineer","cloud_architect","content_writer","copywriter","customer_support",
    "cybersecurity_analyst","data_analyst","data_entry_operator","data_scientist",
    "database_administrator","devops_engineer","digital_marketer","doctor",
    "email_marketer","financial_analyst","fitness_trainer","frontend_developer",
    "full_stack_developer","graphic_designer","hr_generalist","insurance_underwriter",
    "investment_banker","it_support_engineer","journalist","lawyer_litigation",
    "legal_associate","loan_officer","logistics_coordinator","management_consultant",
    "manual_qa_engineer","mechanical_engineer","medical_coder","ml_engineer",
    "mobile_developer","motion_designer","nurse","performance_marketer","pharmacist",
    "product_designer","product_manager","project_manager","psychologist","qa_tester",
    "real_estate_agent","recruiter","research_scientist","risk_analyst","sales_executive",
    "scrum_master","sdr_bdr","social_media_manager","solutions_architect",
    "supply_chain_manager","tax_consultant","teacher","technical_writer",
    "ui_ux_designer","video_editor",
]

# Hand-curated KG-family → Atlas-title mapping. Keys are KG enums; values are
# the EXACT title (or list of candidate titles) from unified_exposure.csv.
# Every mapping must be verifiable by inspection — no fuzzy matching. Unmapped
# families return [] (and surface as honest empty state in the UI).
EXPLICIT_MAP = {
    # Direct 1:1
    "accountant": ["Accountants and auditors"],
    "chartered_accountant": ["Accountants and auditors"],
    "tax_consultant": ["Tax examiners and collectors, and revenue agents", "Accountants and auditors"],
    "architect": ["Architects"],
    "civil_engineer": ["Civil engineers"],
    "mechanical_engineer": ["Mechanical engineers"],
    "doctor": ["Physicians and surgeons"],
    "nurse": ["Registered nurses"],
    "pharmacist": ["Pharmacists"],
    "psychologist": ["Psychologists"],
    "teacher": ["High school teachers"],
    "lawyer_litigation": ["Lawyers"],
    "legal_associate": ["Paralegals and legal assistants", "Lawyers"],
    "journalist": ["Reporters, correspondents, and broadcast news analysts"],
    "graphic_designer": ["Graphic designers"],
    "video_editor": ["Film and video editors and camera operators"],
    "motion_designer": ["Multimedia artists and animators", "Graphic designers"],
    "fitness_trainer": ["Fitness trainers and instructors"],
    "real_estate_agent": ["Real estate brokers and sales agents"],
    "recruiter": ["Human resources specialists"],
    "hr_generalist": ["Human resources specialists"],
    "management_consultant": ["Management analysts"],
    "investment_banker": ["Securities, commodities, and financial services sales agents"],
    "financial_analyst": ["Financial analysts"],
    "risk_analyst": ["Financial analysts", "Financial risk specialists"],
    "loan_officer": ["Loan officers"],
    "insurance_underwriter": ["Insurance underwriters"],
    "bank_teller": ["Tellers"],
    "supply_chain_manager": ["Logisticians"],
    "logistics_coordinator": ["Logisticians"],
    # Tech roles
    "backend_developer": ["Software developers"],
    "frontend_developer": ["Web developers"],
    "full_stack_developer": ["Software developers"],
    "mobile_developer": ["Software developers"],
    "ml_engineer": ["Software developers", "Computer and information research scientists"],
    "data_scientist": ["Data scientists"],
    "data_analyst": ["Data scientists", "Operations research analysts"],
    "business_analyst": ["Management analysts", "Operations research analysts"],
    "research_scientist": ["Computer and information research scientists"],
    "devops_engineer": ["Software developers", "Network and computer systems administrators"],
    "cloud_architect": ["Computer network architects"],
    "solutions_architect": ["Computer network architects", "Software developers"],
    "database_administrator": ["Database administrators"],
    "cybersecurity_analyst": ["Information security analysts"],
    "it_support_engineer": ["Computer support specialists"],
    "qa_tester": ["Software developers", "Software quality assurance analysts and testers"],
    "manual_qa_engineer": ["Software developers", "Software quality assurance analysts and testers"],
    "ui_ux_designer": ["Web developers", "Graphic designers"],
    "product_designer": ["Web developers", "Graphic designers"],
    # Marketing / sales
    "digital_marketer": ["Market research analysts and marketing specialists"],
    "performance_marketer": ["Market research analysts and marketing specialists"],
    "email_marketer": ["Market research analysts and marketing specialists"],
    "social_media_manager": ["Market research analysts and marketing specialists", "Public relations specialists"],
    "brand_manager": ["Advertising, promotions, and marketing managers"],
    "copywriter": ["Writers and authors"],
    "content_writer": ["Writers and authors"],
    "technical_writer": ["Technical writers"],
    "sales_executive": ["Wholesale and manufacturing sales representatives"],
    "sdr_bdr": ["Wholesale and manufacturing sales representatives"],
    # PM / ops
    "product_manager": ["General and operations managers"],  # Imperfect; PMs aren't in BLS taxonomy
    "project_manager": ["Project management specialists"],
    "scrum_master": ["Project management specialists"],
    # BPO / support / data entry
    "customer_support": ["Customer service representatives"],
    "call_center_agent": ["Customer service representatives"],
    "bpo_l1_support": ["Customer service representatives"],
    "data_entry_operator": ["Data entry keyers"],
    "medical_coder": ["Medical records specialists"],
}

def load_atlas() -> dict[str, dict]:
    """Load atlas keyed by lowercased title for lookup."""
    out: dict[str, dict] = {}
    with open(ATLAS) as f:
        reader = csv.DictReader(f)
        for row in reader:
            out[row["title"].strip().lower()] = row
    return out

def main() -> int:
    atlas = load_atlas()
    print(f"Loaded {len(atlas)} occupations from Atlas\n")

    mapped: dict[str, list[dict]] = {}
    unmapped: list[str] = []
    bad_titles: list[tuple[str, str]] = []

    for fam in KG_FAMILIES:
        candidates = EXPLICIT_MAP.get(fam, [])
        if not candidates:
            unmapped.append(fam)
            mapped[fam] = []
            continue
        rows: list[dict] = []
        for title in candidates:
            row = atlas.get(title.strip().lower())
            if row is None:
                bad_titles.append((fam, title))
                continue
            rows.append({
                "atlas_title": row["title"],
                "soc": row["soc"],
                "consensus_score": float(row["consensus_score"]) if row["consensus_score"] else None,
                "n_sources": int(row["n_sources"]) if row["n_sources"] else 0,
                "disagreement": float(row["disagreement"]) if row["disagreement"] else None,
                "karpathy": float(row["karpathy_normalized"]) if row["karpathy_normalized"] else None,
                "openai": float(row["openai_beta"]) if row["openai_beta"] else None,
                "anthropic": float(row["anthropic_observed"]) if row["anthropic_observed"] else None,
                "frey_osborne": float(row["frey_osborne_prob"]) if row["frey_osborne_prob"] else None,
            })
        mapped[fam] = rows
        if not rows:
            unmapped.append(fam)

    total = len(KG_FAMILIES)
    n_mapped = sum(1 for f in KG_FAMILIES if mapped[f])
    n_unmapped = len(unmapped)
    coverage_pct = round(100 * n_mapped / total, 1)

    # ── Quality breakdown for mapped ──
    triple_source = sum(1 for f in KG_FAMILIES if mapped[f] and any(r["n_sources"] >= 3 for r in mapped[f]))
    double_source = sum(1 for f in KG_FAMILIES if mapped[f] and max((r["n_sources"] for r in mapped[f]), default=0) == 2)
    single_source = sum(1 for f in KG_FAMILIES if mapped[f] and max((r["n_sources"] for r in mapped[f]), default=0) == 1)

    print(f"=== KG → Atlas Mapping Coverage ===")
    print(f"Total KG families:        {total}")
    print(f"Mapped:                   {n_mapped} ({coverage_pct}%)")
    print(f"  └─ 3-source consensus:  {triple_source}")
    print(f"  └─ 2-source consensus:  {double_source}")
    print(f"  └─ 1-source only:       {single_source}")
    print(f"Unmapped (empty state):   {n_unmapped}")
    if bad_titles:
        print(f"\n⚠️  {len(bad_titles)} bad title references (typos in EXPLICIT_MAP):")
        for fam, title in bad_titles:
            print(f"   {fam} → '{title}' NOT FOUND in Atlas")

    if unmapped:
        print(f"\nUnmapped families (will show honest empty state):")
        for f in unmapped:
            print(f"  - {f}")

    # ── Gate decision ──
    print(f"\n=== Phase 2 Gate Decision ===")
    if coverage_pct >= 80:
        print(f"✅ {coverage_pct}% ≥ 80% — PROCEED to Phase 3")
        gate = "PROCEED"
    elif coverage_pct >= 60:
        print(f"🟡 {coverage_pct}% in 60-80% — PROCEED with explicit empty state for {n_unmapped} families")
        gate = "PROCEED_WITH_EMPTY_STATE"
    else:
        print(f"❌ {coverage_pct}% < 60% — STOP, reconsider approach")
        gate = "STOP"

    # Write mapping artifact
    OUT.write_text(json.dumps({
        "_meta": {
            "snapshot_date": "2026-05-02",
            "kg_family_count": total,
            "coverage_pct": coverage_pct,
            "triple_source_count": triple_source,
            "double_source_count": double_source,
            "single_source_count": single_source,
            "unmapped_count": n_unmapped,
            "gate_decision": gate,
            "atlas_source": "data/external/jobs-exposure-atlas/unified_exposure.csv",
        },
        "mapping": mapped,
        "unmapped": unmapped,
    }, indent=2))
    print(f"\nWrote {OUT.relative_to(ROOT)}")

    return 0 if gate != "STOP" else 1

if __name__ == "__main__":
    sys.exit(main())
