#!/usr/bin/env python3
"""Build a unified exposure dataset joining Karpathy, OpenAI, Anthropic, and Frey & Osborne."""

import json
import numpy as np
import pandas as pd

# ── 1. Load all sources ──────────────────────────────────────────────────────

# Karpathy occupations (base)
occ = pd.read_csv("occupations.csv")
with open("data.json") as f:
    data_json = pd.DataFrame(json.load(f))
# Merge exposure score from data.json via slug
occ = occ.merge(data_json[["slug", "exposure", "exposure_rationale"]], on="slug", how="left")

# Frey & Osborne
fo = pd.read_csv("frey_osborne.csv")

# OpenAI GPTs are GPTs
oai = pd.read_csv("openai_gpts.csv")

# Anthropic observed exposure
ant = pd.read_csv("anthropic_exposure.csv")

# ── 2. Normalize SOC codes ──────────────────────────────────────────────────

def normalize_soc(code):
    """Normalize SOC code to 7-char format XX-XXXX."""
    if pd.isna(code):
        return None
    code = str(code).strip()
    # Strip O*NET .00/.XX suffixes → keep first 7 chars
    if "." in code:
        code = code.split(".")[0]
    # Ensure 7-char format
    if len(code) == 7 and code[2] == "-":
        return code
    return None

occ["soc"] = occ["soc_code"].apply(normalize_soc)
fo["soc"] = fo["_ - code"].apply(normalize_soc)
ant["soc"] = ant["occ_code"].apply(normalize_soc)
oai["soc"] = oai["O*NET-SOC Code"].apply(normalize_soc)

# OpenAI has O*NET sub-occupations (e.g. 11-1011.00, 11-1011.03) that map
# to the same 6-digit SOC. Average their scores per SOC prefix.
oai_agg = (
    oai.groupby("soc")
    .agg(
        openai_beta=("dv_rating_beta", "mean"),
        openai_alpha=("dv_rating_alpha", "mean"),
        human_beta=("human_rating_beta", "mean"),
        openai_n_sub=("dv_rating_beta", "size"),
    )
    .reset_index()
)

# Frey & Osborne: average by SOC if duplicates
fo_agg = (
    fo.groupby("soc")
    .agg(
        frey_osborne_prob=("probability", "mean"),
        fo_median_wage=("median_ann_wage", "mean"),
        fo_n_employed=("numbEmployed", "sum"),
    )
    .reset_index()
)

# Anthropic: should be unique per soc, but aggregate just in case
ant_agg = (
    ant.groupby("soc")
    .agg(anthropic_observed=("observed_exposure", "mean"))
    .reset_index()
)

# ── 3. Join everything onto Karpathy base ────────────────────────────────────

df = occ.copy()
df = df.merge(oai_agg, on="soc", how="left")
df = df.merge(ant_agg, on="soc", how="left")
df = df.merge(fo_agg, on="soc", how="left")

# ── 4. Derived columns ──────────────────────────────────────────────────────

df["karpathy_normalized"] = df["exposure"] / 10.0

df["theory_reality_gap"] = df["openai_beta"] - df["anthropic_observed"]

df["llm_shift"] = df["karpathy_normalized"] - df["frey_osborne_prob"]

# Consensus: average of available scores
score_cols = ["karpathy_normalized", "openai_beta", "anthropic_observed"]
scores = df[score_cols]
df["consensus_score"] = scores.mean(axis=1, skipna=True)
df["n_sources"] = scores.notna().sum(axis=1)

# Disagreement: max - min of available scores
df["disagreement"] = scores.max(axis=1, skipna=True) - scores.min(axis=1, skipna=True)
# Only meaningful when at least 2 sources present
df.loc[df["n_sources"] < 2, "disagreement"] = np.nan

# ── 5. Output CSV ───────────────────────────────────────────────────────────

out_cols = [
    "title", "category", "soc", "median_pay_annual", "entry_education",
    "num_jobs_2024", "exposure", "exposure_rationale",
    "karpathy_normalized", "openai_beta", "openai_alpha", "human_beta",
    "anthropic_observed", "frey_osborne_prob",
    "theory_reality_gap", "llm_shift", "consensus_score", "n_sources",
    "disagreement",
]
df[out_cols].to_csv("unified_exposure.csv", index=False)
print(f"Wrote unified_exposure.csv with {len(df)} rows, {len(out_cols)} columns\n")

# ── 6. Summary statistics ───────────────────────────────────────────────────

print("=" * 80)
print("MATCH RATES")
print("=" * 80)
total = len(df)
for col, label in [
    ("karpathy_normalized", "Karpathy (base)"),
    ("openai_beta", "OpenAI GPTs-are-GPTs (β)"),
    ("anthropic_observed", "Anthropic observed"),
    ("frey_osborne_prob", "Frey & Osborne"),
]:
    n = df[col].notna().sum()
    print(f"  {label:35s}: {n:3d} / {total} ({100*n/total:.0f}%)")

print(f"\n{'=' * 80}")
print("TOP 10 BY CONSENSUS SCORE (avg of available sources)")
print("=" * 80)
top_consensus = df.nlargest(10, "consensus_score")[
    ["title", "karpathy_normalized", "openai_beta", "anthropic_observed", "consensus_score"]
]
print(top_consensus.to_string(index=False))

print(f"\n{'=' * 80}")
print("TOP 10 BY THEORY–REALITY GAP (openai_beta − anthropic_observed)")
print("=" * 80)
gap = df.dropna(subset=["theory_reality_gap"]).nlargest(10, "theory_reality_gap")
print(gap[["title", "openai_beta", "anthropic_observed", "theory_reality_gap"]].to_string(index=False))

print(f"\n{'=' * 80}")
print("TOP 10 BY LLM SHIFT (karpathy − frey_osborne; newly exposed by LLMs)")
print("=" * 80)
shift = df.dropna(subset=["llm_shift"]).nlargest(10, "llm_shift")
print(shift[["title", "karpathy_normalized", "frey_osborne_prob", "llm_shift"]].to_string(index=False))

print(f"\n{'=' * 80}")
print("TOP 10 BY DISAGREEMENT (max − min of available scores)")
print("=" * 80)
disagree = df.dropna(subset=["disagreement"]).nlargest(10, "disagreement")
print(disagree[["title", "karpathy_normalized", "openai_beta", "anthropic_observed", "disagreement"]].to_string(index=False))

print(f"\n{'=' * 80}")
print("LLM DISRUPTION DELTA: low Frey&Osborne (<0.3) → high Karpathy (≥0.7)")
print("=" * 80)
switched = df[
    (df["frey_osborne_prob"] < 0.3) & (df["karpathy_normalized"] >= 0.7)
].sort_values("llm_shift", ascending=False)
print(f"  Found {len(switched)} occupations")
if len(switched) > 0:
    top_switched = switched.head(10)
    print(
        top_switched[
            ["title", "karpathy_normalized", "frey_osborne_prob", "llm_shift"]
        ].to_string(index=False)
    )

print(f"\n{'=' * 80}")
print("CATEGORY-LEVEL AVERAGES BY SOURCE")
print("=" * 80)
cat_avg = (
    df.groupby("category")[
        ["karpathy_normalized", "openai_beta", "anthropic_observed", "frey_osborne_prob"]
    ]
    .mean()
    .sort_values("karpathy_normalized", ascending=False)
)
pd.set_option("display.max_rows", 50)
pd.set_option("display.width", 120)
pd.set_option("display.float_format", lambda x: f"{x:.3f}")
print(cat_avg.to_string())
