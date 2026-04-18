# CLAUDE.md — JobBachao Operating Rules for Claude Code

> **This file replaces the previous CLAUDE.md** (which was stale — it described a Next.js/Anthropic-API project that does not exist in this repo).
> Last updated: 2026-04-18
> This file is loaded at the start of every Claude Code session. Read it fully before doing anything else.

---

## 0. What this project actually is (ground truth)

**JobBachao** is a production AI career-risk-intelligence platform.

- **Live URL**: https://job-fortress.lovable.app (brand is JobBachao; legacy repo name is job-fortress)
- **Stack**: Vite + React 18 + TypeScript + shadcn/ui + Tailwind + Framer Motion · Supabase (Lovable Cloud) · Deno edge functions · Gemini 3 Pro/Flash via Lovable AI gateway · Tavily + Firecrawl · Razorpay · Vitest
- **Package manager**: Bun — `bun.lock` is canonical (Bun v1.2+ text format); use `bun install`. `package-lock.json` coexists pending verification of Lovable's build command and will be resolved in a follow-up PR.
- **Scale**: 79 edge functions, 126 migrations, 52 components, 17 pages, 932 commits
- **Traffic reality**: single-digit scans per day as of 2026-04-17; this is a pre-PMF product with sophisticated engineering
- **Revenue model**: ₹499/scan · ₹1,999/yr Pro · Razorpay integration exists but order-creation handed to external consultant
- **Historical note**: this repo was pivoted from a child-health app (KidSutra). Residue exists in `.lovable/bugs.md`, old git backups, and possibly other places. Do not be confused by KidSutra references.

## 1. Known structural hazards (must be addressed before any new feature work)

These are active hazards in the repo. Claude Code must be aware of them.

### Hazard A — Parallel codebase: `job-fortress-v2/`
There is a committed, nearly-complete parallel copy of the entire project at `job-fortress-v2/`. It contains 73 edge functions vs 79 in root, different code in `process-scan/index.ts` (1,328 lines in v2 vs 1,136 in root), and a different App.tsx. **Which one deploys is unclear.**

- **Rule**: Until the human operator resolves this, DO NOT touch `job-fortress-v2/`. If a task seems to require work in v2, STOP and ask.
- **Expected resolution**: either delete v2 or move it out of the repo (e.g., a separate branch) before further development.

### Hazard B — Five `.git_old*` directories
`.git_old`, `.git_old3`, `.git_old4`, `.git_old5`, `.git_ux_final` all exist at repo root. These are historical git-folder backups from previous rewrites. They pollute directory listings and can confuse tools.

- **Rule**: Treat these as read-only archaeology. Do not modify, do not commit new changes to them. Flag their removal to the human operator when appropriate.

### Hazard C — Tests exist but don't run
There are 15+ test files (`*.test.ts`) but `vitest` is not installed in `node_modules/`. `npm test` and `bun test` both fail.

- **Rule**: Before writing any new test, verify the test runner works. If it doesn't, fixing test infrastructure IS the first task of the current session.

### Hazard D — Security bypasses still active in production-adjacent code
- `_shared/subscription-guard.ts` has `TESTING_BYPASS = true` — all Pro features accessible to free users.
- `activate-subscription/index.ts` has a DEV MODE fallback that issues Pro status without Razorpay verification.
- See `_audit/MASTER_AUDIT_REPORT.md` for 13 P0 issues and 77 total audit findings.

- **Rule**: Do not introduce new Pro-gated features until `TESTING_BYPASS` is false in prod and the P0 audit issues are resolved.

### Hazard E — No cron on `generate-weekly-brief`
The edge function and the `weekly_briefs` table exist. The cron trigger does not. The feature silently never fires.

- **Rule**: Do not reference Weekly Briefs as if they work, in UI or marketing, until the cron is wired.

### Hazard F — God files
- `supabase/functions/process-scan/index.ts` — 1,136 lines
- `src/lib/scan-engine.ts` — 841 lines
- `src/components/SideHustleGenerator.tsx` — 798 lines
- `src/components/VerdictReveal.tsx` — 492 lines

These have been marked "acceptable" by the team after prior audit cycles. **Do not refactor them** unless explicitly asked.

## 2. The core operating rules

### Rule 1: Read before edit
Before modifying any file, Claude Code must:
1. Read the file fully, not just the region being changed
2. `grep -r` for all callers/imports of functions being changed
3. Check recent `git log` on that file for context
4. State explicitly what depends on current behavior

### Rule 2: Additive over modifying
Prefer new files/modules over changing existing ones. When modifying:
- Change the minimum lines needed
- Do NOT rename, restyle, or refactor unrelated code
- Do NOT "clean up while I'm here"
- Preserve function signatures unless explicitly changing contracts

### Rule 3: Never touch these without explicit approval
- `_shared/det-*.ts` files (the deterministic scoring engine — this is core IP)
- `_shared/agent-prompts.ts` (carefully calibrated; every change is behavior-breaking)
- `_shared/zod-schemas.ts` (boundary contracts)
- Any file in `supabase/migrations/` (migrations are append-only)
- `activate-subscription/`, `razorpay-webhook/` (payment path — consultant scope)
- `subscription-guard.ts` (do not flip `TESTING_BYPASS` without explicit operator confirmation)
- Any file over 500 lines

### Rule 4: Feature flags for everything new
Ship behind `import.meta.env.VITE_FEATURE_<NAME>` (frontend) or a `FEATURE_<NAME>` env check (edge function). Default OFF in production. Rollout: dev → internal → 1% → 10% → 100%.

### Rule 5: Tests first, or say why not
For any new code: write at least one test. If the test runner is broken, fix that before writing new code. Exception: one-line typo fixes.

### Rule 6: Verification before completion
Never claim "done" without:
- Running `bun run lint` (show output)
- Running `bun run test` (show output — must actually execute, not just "the file exists")
- Running `bun run build` (show output — must succeed)
- Manually exercising the changed flow (curl the edge function, click through the UI, etc.)
- Confirming the regression checklist in `docs/claude-code/03_REGRESSION_PREVENTION.md`

### Rule 7: Database changes are sacred
Migrations are append-only, named with timestamp, and every new migration must:
- Be tested against a staging copy of the prod schema first
- Include a documented reverse (even if it's "not reversible — data loss acceptable because X")
- Never drop columns/tables in the same migration that adds new code paths

### Rule 8: Scope discipline
If unrelated issues are discovered during work:
- Log them in `docs/BACKLOG.md`
- Do NOT fix them in the current PR
- Surface to operator for prioritization

### Rule 9: Ask before large changes
Stop and ask the operator before:
- Modifying any file over 300 lines
- Touching auth, payment, or scoring-engine code
- Adding a new dependency
- Making changes that touch more than 5 files

### Rule 10: Honor the existing taste
This codebase has opinions: deterministic engines over LLM scoring, shadcn components, Tailwind semantic tokens (`--prophet-green`, `--prophet-gold`, etc.), Framer Motion for animation, Zod for boundaries. Match these. Do not introduce Radix primitives directly, do not use inline colors, do not introduce new animation libraries.

## 3. Tech stack specifics (use these, not analogues)

| Concern | Correct tool in THIS repo |
|---|---|
| Data fetching | `@tanstack/react-query` |
| Forms | `react-hook-form` + `@hookform/resolvers/zod` |
| Validation | `zod` (at every boundary) |
| UI primitives | `@radix-ui/*` via shadcn (see `src/components/ui/`) |
| Styling | Tailwind with semantic tokens from `tailwind.config.ts` |
| Animation | `framer-motion` |
| Notifications | `sonner` (not react-hot-toast) |
| Routing | `react-router-dom@6` |
| Icons | `lucide-react` |
| LLM calls | Lovable AI Gateway (no direct API keys in this repo) |
| Search | Tavily API (edge functions only) |
| Scraping | Firecrawl (edge functions only) |
| HTML sanitization | `dompurify` |
| Charts | `recharts` |
| Package manager | `bun` |

## 4. Directory map (authoritative)

```
/                           ← main codebase
  CLAUDE.md                 ← this file
  docs/
    claude-code/            ← Claude Code operating docs (this package)
      00_CURRENT_REALITY.md
      01_STABILIZATION_SPRINT.md
      02_NEW_IP_ROADMAP.md
      03_REGRESSION_PREVENTION.md
    qa/                     ← existing QA/audit history (read-only reference)
  src/
    components/             ← 52 components, one per file
    pages/                  ← 17 route-level pages
    lib/                    ← scoring engine, classifiers, utilities
    hooks/                  ← React hooks
    features/               ← feature-scoped modules
    integrations/           ← Supabase client, etc.
    test/                   ← frontend tests (vitest)
  supabase/
    functions/
      _shared/              ← 37 shared modules (treat as library code)
      <79 individual edge fns>
    migrations/             ← 126 append-only SQL files
  _audit/                   ← pre-existing audit reports
  job-fortress-v2/          ← FROZEN — see Hazard A
  .git_old*/                ← FROZEN — see Hazard B
  .lovable/                 ← Lovable IDE metadata (contains KidSutra residue — ignore)
```

## 5. The phased plan

| Phase | Goal | Duration | Reference |
|---|---|---|---|
| 0 | Acknowledge & document current reality | 1 day | `docs/claude-code/00_CURRENT_REALITY.md` |
| 1 | Stabilization sprint (repo cleanup, test infra, P0 security) | 2–4 weeks | `docs/claude-code/01_STABILIZATION_SPRINT.md` |
| 2 | Get actual users (not a code phase — ship to 100 users) | 4–8 weeks | — |
| 3 | New IP layers (WhatsApp agent, TrustScore, Longitudinal SkillDNA) | 3+ months | `docs/claude-code/02_NEW_IP_ROADMAP.md` |

**Claude Code does not get to skip Phase 1. No new features, new cards, new edge functions, or new database tables are allowed until Phase 1 acceptance criteria are met.**

## 6. Communication protocol

When Claude Code reports progress:
- Concise; no celebratory language
- Evidence (command output, diffs, screenshots) over assertions
- Surface unknowns as explicit questions
- Maintain `docs/DECISIONS.md` for non-obvious choices

When Claude Code hits a problem:
- Stop; do not improvise
- Describe the problem, list options, recommend a path
- Wait for human decision before proceeding on anything risky

## 7. Emergency stop conditions

Halt and request guidance if:
- A migration would drop data
- A change could affect authentication or payments
- Tests fail and the fix isn't obvious
- A secret/credential is encountered in code
- A dependency needs a major-version upgrade
- The task would violate any rule above
- `job-fortress-v2/` or `.git_old*/` would be touched

## 8. Skills to invoke (from the operator's installed set)

Claude Code should actively use:
- `sequential-thinking` — any non-trivial change
- `brainstorming` — before any new feature
- `test-driven-development` — for all new logic
- `verification-before-completion` — mandatory before "done"
- `regression-check` — mandatory after any fix
- `deep-qa-sweep` — before any production-impacting deploy
- `karpathy-guidelines` — default against over-engineering

Invoke them in reasoning, not just reference them.
