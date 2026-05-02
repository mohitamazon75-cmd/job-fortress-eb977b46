# External Datasets — Provenance & License

This directory holds frozen copies of third-party datasets that JobBachao consumes deterministically.
**Do not modify these files in place** — re-download from source if a refresh is needed.

---

## `jobs-exposure-atlas/`

**Source**: https://github.com/mathias3/jobs-exposure-atlas (MIT)
**Snapshot date**: 2026-05-02
**Why we use it**: A single SOC-code-keyed table that fuses four independent academic AI-exposure
studies, giving us per-occupation `consensus_score`, `n_sources`, and `disagreement` metrics that
we surface to users as the "Cross-Validated AI Exposure" badge.

### Files

| File | Source-of-source | What it contains |
|---|---|---|
| `unified_exposure.csv` | Atlas's own fusion (built by `build_unified.py`) | 342 occupations × 19 columns. **This is our primary lookup table.** |
| `data.json` | Karpathy `/jobs` (BLS OOH + Gemini Flash scoring) | Per-occupation LLM exposure score (0-10) + rationale text |
| `anthropic_exposure.csv` | Anthropic Economic Index | Observed deployment per SOC code |
| `frey_osborne.csv` | Frey & Osborne (2017) | Pre-LLM probability per SOC code |
| `openai_gpts.csv` | OpenAI "GPTs are GPTs" (2023) | Theoretical task exposure per O*NET-SOC |

### Citations to render to users

- Karpathy, A. (2026) — *US Job Market Visualizer*. Bureau of Labor Statistics OOH + Gemini Flash scoring.
- OpenAI (2023) — *GPTs are GPTs: An Early Look at the Labor Market Impact Potential of LLMs*.
- Anthropic (2025) — *Anthropic Economic Index*. Observed Claude usage by occupation.
- Frey, C. B. & Osborne, M. A. (2017) — *The future of employment: How susceptible are jobs to computerisation?*

---

## `karpathy-jobs/`

**Source**: https://github.com/karpathy/jobs (no explicit license — public domain BLS data)
**Snapshot date**: 2026-05-02
**Why we use it**: Authoritative BLS Occupational Outlook Handbook scrape — gives us pay,
education, employment counts, and BLS projected outlook. Used as the canonical role
metadata when Atlas's row is missing fields.

### Files

| File | What it contains |
|---|---|
| `occupations.csv` | 342 occupations: SOC code, title, slug, pay, jobs, outlook, education, BLS source URL |
| `occupations.json` | Slug → URL mapping for citation links back to BLS |

---

## Refresh policy

These are static datasets. Refresh only when:
1. Atlas publishes a new `unified_exposure.csv` with revised consensus scores
2. A new academic study is added to the fusion (currently Karpathy + OpenAI + Anthropic + Frey-Osborne)

When refreshing, bump the snapshot date above and re-run `bun test` — fixtures may need updating.
