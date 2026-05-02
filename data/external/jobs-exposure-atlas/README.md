# The AI Exposure Atlas

Cross-referenced AI exposure data for **342 U.S. occupations** and **143,066,500 workers**, built by joining four independent research streams into one reproducible dataset: [unified_exposure.csv](./unified_exposure.csv).

This repository is not just another AI-jobs chart. The core contribution is a single occupation-level table where Karpathy `/jobs`, OpenAI "GPTs are GPTs", Anthropic observed deployment, and Frey & Osborne can be analyzed side-by-side with consistent SOC normalization.

## Explore The Interactive Atlas

**→ [Open the interactive version](https://mathias3.github.io/jobs-exposure-atlas/)** for the full occupation explorer, multi-chart atlas, and source-by-source drilldown. The site is published from this repository so people can use it directly without downloading the repo first.

## The Current Picture

### Workforce Exposure Frontier

Which occupations combine high exposure with labor-market scale?

![Workforce exposure frontier](assets/charts/workforce_frontier.png)

*Large bubbles combine millions of workers with elevated multi-source exposure. Color shows disagreement across frameworks; size tracks pay.*

### Theory vs Deployment Gap Leaders

Where theoretical capability is running far ahead of observed deployment:

![Theory vs deployment gap leaders](assets/charts/theory_reality_gap.png)

*OpenAI's theoretical exposure and Anthropic's observed exposure are plotted together as a dumbbell view so the adoption gap is visible occupation by occupation.*

### LLM Disruption Delta Occupations

Where the LLM era breaks hardest from older automation assumptions:

![LLM disruption delta occupations](assets/charts/llm_shift.png)

*These occupations were relatively low-risk in Frey & Osborne's pre-LLM framework but jump sharply in Karpathy's LLM-era exposure scores.*

### Category-Level Confrontation Map

Where the four frameworks align, and where they split by occupation family:

![Category confrontation map](assets/charts/category_confrontation.png)

*Employment-weighted category averages make it easy to compare Karpathy, OpenAI, Anthropic, and Frey & Osborne on one consistent grid.*

## Why This Project Exists

Most AI labor market claims compare studies informally, because each source uses different units and assumptions:

1. Theoretical task capability (what models can do in principle).
2. Observed deployment (what organizations actually use).
3. Pre-LLM automation assumptions (robotics/routine-era priors).

This project creates a common spine so those worlds can be confronted directly, occupation by occupation, instead of discussed as separate narratives.

## What Is Original Here

1. First public merged table (in this repo) mapping all four sources at SOC level into one CSV with derived comparatives.
2. Explicit "theory vs reality" metric (`theory_reality_gap = openai_beta - anthropic_observed`).
3. Explicit "pre-LLM vs LLM" metric (`llm_shift = karpathy_normalized - frey_osborne_prob`).
4. Consensus and disagreement columns to separate robust agreement from methodological blindspots.

## Dataset At A Glance

1. Rows: `342` occupations.
2. Columns: `19` columns in [unified_exposure.csv](./unified_exposure.csv).
3. Workforce covered: `143,066,500` jobs (`num_jobs_2024`).
4. Match rate to Karpathy base: OpenAI `238/342` (70%), Anthropic `233/342` (68%), Frey & Osborne `208/342` (61%).

## Key Findings

1. **Frey & Osborne inverts in the LLM era.** Pearson correlation of `frey_osborne_prob` with Karpathy is **-0.135** (208 matched occupations), and with OpenAI is **-0.174**. Physical/manual work that looked automatable in 2013 (waiters/waitresses `0.94`, roofers `0.90`, butchers `0.93`) is low on LLM exposure, while cognitive work flips high.
2. **57 occupations show an LLM Disruption Delta.** `frey < 0.3` and `karpathy >= 0.7` finds 57 flips, led by special effects artists, operations research analysts, writers, editors, lawyers, and graphic designers.
3. **Theory-Reality Gap is large and systematic.** Mean gap is `0.295`; median `0.304`; 97% of matched occupations have positive gap. Examples: music directors/composers (`0.711` theory vs `0.037` observed), writers/authors (`0.877` vs `0.246`).
4. **Largest disagreements expose blindspots.** Insurance underwriters (`0.8375` disagreement), models (`0.8000`), and cost estimators (`0.8000`) are top split cases where assumptions matter more than average score.
5. **Researcher Paradox is visible in the merged evidence.** Developer-class occupations are highly exposed and highly demanded at the same time: software developers, QA, and testers are `0.9` in Karpathy with `$131,450` median pay and `1,895,500` jobs (BLS "much faster than average" growth), while closely related coding occupations in matched OpenAI/Anthropic rows (e.g., computer programmers) show very high theory (`0.95`) and high observed deployment (`0.745`).
6. **Category confrontation is informative.** Math, computing, and legal categories lead in LLM-era exposure; construction/farming/cleaning remain lowest. Office-and-administrative-support is a special case where all four sources are elevated (weighted means: Karpathy `0.811`, OpenAI `0.612`, Anthropic `0.479`, Frey `0.826`).

## Data Sources

### 1) Karpathy `/jobs` (2026)

1. Scope: 342 BLS occupations, exposure on 0-10 scale.
2. Local files: [occupations.csv](./occupations.csv), [data.json](./data.json), [scores.json](./scores.json).
3. Role in pipeline: base occupation spine and rationale text.

### 2) OpenAI "GPTs are GPTs" (Eloundou et al., 2023)

1. Source file: [openai_gpts.csv](./openai_gpts.csv) (from OpenAI public repo `occ_level.csv`).
2. Metric used: `dv_rating_beta` (plus `alpha`, `human_beta` retained).
3. Role in pipeline: theoretical LLM task-time reduction proxy.

### 3) Anthropic Economic Index (Jan 2026)

1. Source files: [anthropic_exposure.csv](./anthropic_exposure.csv), [anthropic_tasks.csv](./anthropic_tasks.csv).
2. Metric used: `observed_exposure`.
3. Role in pipeline: real-world observed deployment on Claude interactions.

### 4) Frey & Osborne (2013/2017 baseline)

1. Source file: [frey_osborne.csv](./frey_osborne.csv).
2. Metric used: occupation automation probability.
3. Role in pipeline: pre-LLM automation baseline for shift analysis.

## Methodology

The build process is implemented in [build_unified.py](./build_unified.py).

1. Normalize SOC/O*NET codes to `XX-XXXX` format (`normalize_soc`), including stripping `.00` style suffixes.
2. Aggregate OpenAI sub-occupations to SOC-level means.
3. Aggregate Frey/Anthropic by SOC (safety against duplicates).
4. Left-join all sources onto Karpathy base occupations.
5. Compute derived columns:

```text
karpathy_normalized = exposure / 10
theory_reality_gap  = openai_beta - anthropic_observed
llm_shift           = karpathy_normalized - frey_osborne_prob
consensus_score     = mean(karpathy_normalized, openai_beta, anthropic_observed)
n_sources           = count(non-null among consensus inputs)
disagreement        = max - min over available consensus inputs
```

## Confrontations Between Data

These are the core analytical confrontations the repository is built for:

1. **Theory vs deployment:** OpenAI high does not imply Anthropic high; adoption friction is measurable.
2. **Pre-LLM vs LLM inversion:** Frey high often maps to LLM low, and vice versa.
3. **Consensus vs disagreement:** some occupations are robustly high; others are methodology-sensitive.
4. **Category-level coherence:** some sectors are stable across frameworks; others diverge strongly.

## Interesting Gotchas And Caveats

1. SOC taxonomies do not perfectly align across data vintages; broad occupations can miss direct one-to-one matches in external sources.
2. Anthropic observed exposure is platform-observed behavior, not full economy deployment.
3. OpenAI beta is a theoretical capability proxy and should not be read as immediate displacement.
4. Frey & Osborne reflects a robotics/routine-era framing; using it as a baseline is intentional, not a claim that it forecasts LLM dynamics.
5. "Exposure" is not "unemployment". The same occupation can show high exposure and strong growth.

## Repository Structure

1. [build_unified.py](./build_unified.py): deterministic data integration script.
2. [build_readme_charts.py](./build_readme_charts.py): generates static chart snapshots used in this README.
3. [unified_exposure.csv](./unified_exposure.csv): final merged dataset.
4. [index.html](./index.html): single-file D3.js interactive (multi-source atlas).
5. [assets/charts/](./assets/charts/): README-ready chart snapshots.
6. Source data files: [occupations.csv](./occupations.csv), [data.json](./data.json), [scores.json](./scores.json), [openai_gpts.csv](./openai_gpts.csv), [anthropic_exposure.csv](./anthropic_exposure.csv), [anthropic_tasks.csv](./anthropic_tasks.csv), [frey_osborne.csv](./frey_osborne.csv).
7. Research notes: [reserach/](./reserach/).

## Run Locally

```bash
python3 -m pip install -r requirements.txt
python3 build_unified.py
python3 build_readme_charts.py
python3 -m http.server 8000
# open http://localhost:8000
```

## Publishing Notes

1. This project is designed for open-source publication as an analysis artifact and data resource.
2. If you add more external datasets, keep source-level provenance and field-level transformation notes in [build_unified.py](./build_unified.py).
3. Before releases, regenerate [unified_exposure.csv](./unified_exposure.csv), rebuild [assets/charts/](./assets/charts/), and verify headline stats in this README.

## Future Integrations (Not Yet In The Unified CSV)

1. Goldman Sachs (2023) sector-level estimates.
2. McKinsey SCI (2025) occupation/skill transition modeling.
3. PwC AI Jobs Barometer (2025) wage premium and augmentation framing.
4. IMF (2024) cross-country exposure splits.
5. WEF Future of Jobs (2025) net job creation/displacement expectations.
6. TEAI / Moravec-style task-theory indices.

## License And Attribution

Each input dataset keeps its original source terms. Review upstream licenses before redistributing derivative packaged datasets.
