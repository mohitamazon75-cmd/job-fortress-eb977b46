# CLAUDE.md — JobBachao Project Instructions

> This file is loaded automatically by Claude Code at the start of every session.
> It defines how Claude should think, code, test, and protect this project.
> Last updated: 2026-04

---

## Project Overview

**JobBachao** is an AI-powered job risk scoring tool. Users enter a job title and
receive an AI displacement risk score, breakdown of at-risk vs safe tasks, skills
to build, and a 90-day action plan.

**Stack**: Next.js · TypeScript · Tailwind CSS · Anthropic Claude API · Vercel  
**Core value proposition**: Credible, specific, fast. Not vague. Not scary. Useful.  
**Simplicity score in user testing: 8.2/10 — protect this at all costs.**

---

## 1. Token Optimization (Read First)

Claude Code sessions have a finite context window. Waste nothing.

### Rules
- **Read only what you need.** Never `cat` an entire file to answer a question
  about one function. Use `grep`, `sed`, or targeted reads.
- **One change at a time.** Make a change, verify it works, then move on.
  Do not batch 5 unrelated changes into one step.
- **Use `@filename` references** to pull in context instead of pasting code.
- **Compact proactively.** If context is getting long, run `/compact` before
  starting a new major task. Do not let the window fill up.
- **Prefer diffs over full rewrites.** When editing a file, use targeted edits
  not full file replacement unless more than 60% of the file is changing.
- **Summarize before deep dives.** Before reading a module, state what you are
  looking for. Stop reading once you find it.
- **No exploratory sprawl.** Do not read 10 files "just to understand" before
  writing a line of code. Read the minimum needed, then act.

### Model routing guidance
| Task | Model to use |
|------|-------------|
| Renaming a variable, fixing a typo | Haiku |
| Writing a new function, fixing a bug | Sonnet |
| Architectural decisions, security review | Opus |

---

## 2. Code Quality Standards

### General principles
- **Correct first, fast second, clever never.** Code that is hard to read is
  a liability, not an asset.
- **No magic numbers.** Every constant gets a named variable with a comment
  explaining its origin.
- **Fail loudly in dev, gracefully in prod.** Use assertions and invariant checks
  in development. In production, catch errors, log them, and show the user
  something useful.
- **Small functions.** If a function is longer than 40 lines, it is doing too
  much. Split it.
- **Explicit over implicit.** No clever one-liners that require mental unpacking.
  Name things what they are.

### TypeScript rules
- Strict mode always on (`"strict": true` in tsconfig).
- No `any` types. Use `unknown` and narrow it properly.
- All API response shapes must have a `zod` schema. Parse at the boundary,
  trust inside.
- All async functions must handle both the happy path and the error path.
- Exported functions must have JSDoc comments with `@param`, `@returns`,
  and `@throws` if applicable.

### File organization
```
/app               ← Next.js App Router pages
/components        ← UI components (one component per file)
/lib               ← Business logic, API clients, utilities
  /enrichment      ← O*NET, BLS, data enrichment modules
  /ai              ← Claude prompt templates and API calls
  /cache           ← LocalStorage + server-side cache logic
/types             ← All TypeScript interfaces and zod schemas
/tests             ← All test files (mirrors /lib and /components)
/public            ← Static assets only
```

- Components are PascalCase. Utilities are camelCase. Types are PascalCase.
- One export per file unless it's a utilities barrel file.
- No business logic in components. Components call lib functions.

### Naming conventions
| Thing | Convention | Example |
|-------|-----------|---------|
| React component | PascalCase | `RiskScoreCard.tsx` |
| Utility function | camelCase | `normalizeJobTitle.ts` |
| Type / Interface | PascalCase | `OnetOccupation` |
| Zod schema | camelCase + Schema | `riskResultSchema` |
| API route | kebab-case | `/api/risk-score` |
| Constant | SCREAMING_SNAKE | `MAX_CACHE_AGE_DAYS` |
| Test file | same name + `.test.ts` | `normalizeJobTitle.test.ts` |

---

## 3. Testing Protocol

### Philosophy
**Nothing ships untested.** Every function in `/lib` has a test. Every API route
has an integration test. Every critical UI flow has an E2E test.

### Test structure
```
tests/
  unit/          ← Pure function tests (no network, no DOM)
  integration/   ← API route tests, database interactions
  e2e/           ← Playwright tests for user flows
```

### Required test coverage
| Module | Minimum coverage |
|--------|-----------------|
| `/lib/enrichment/*` | 90% — these are data-critical |
| `/lib/ai/*` | 85% — test prompt assembly, not the AI response |
| `/lib/cache/*` | 90% — cache bugs cause stale data silently |
| `/components/*` | 70% — focus on logic branches, not rendering |
| `/app/api/*` | 80% — test status codes, error cases, and schemas |

### Test-writing rules
- **Write the test before the implementation** for all new features.
  Use `/tdd` to enter TDD mode.
- Each test must have a single, clear assertion. One test = one behavior.
- All external APIs (O*NET, BLS, Anthropic) must be mocked in tests.
  Never make real network calls in the test suite.
- Test the failure cases as thoroughly as the happy path:
  - What if O*NET returns 404?
  - What if the AI returns malformed JSON?
  - What if the job title has special characters?
  - What if the cache is corrupted?
- E2E tests cover these exact user flows:
  1. User enters a known job title → result loads correctly
  2. User enters an unknown job title → fallback mode, no error shown
  3. User enters an empty string → validation message shown
  4. Result is cached → second identical query loads from cache
  5. Share card button → generates and downloads image

### Running tests
```bash
npm run test              # Unit + integration
npm run test:e2e          # Playwright E2E
npm run test:coverage     # Coverage report
npm run test:watch        # Watch mode during development
```

**Before marking any task complete:** Run `npm run test` and confirm 0 failures.
Do not declare something "done" if tests are red or untested.

---

## 4. Proprietary IP Protection

JobBachao's competitive moat is the combination of:
1. **The enrichment pipeline** — how we blend O*NET + BLS + AI
2. **The prompt template** — the exact structure that produces useful output
3. **The scoring algorithm** — how we weight automation risk vs growth vs skill signals

### Rules for protecting IP

**Never expose the AI prompt to the client.**
- All calls to the Anthropic API happen server-side only (`/app/api/` routes).
- The system prompt and user prompt template live in `/lib/ai/prompts.ts` —
  server only, never imported by any client component.
- API routes return the structured result, not the raw prompt or raw AI response.

**Obfuscate the enrichment logic.**
- The specific combination of O*NET fields, BLS weightings, and how we
  normalize/combine them is our secret sauce.
- This logic lives in `/lib/enrichment/` and is never exposed via API responses.
- Return scores and labels to the client, never raw source data or the formula.

**Rate limit everything.**
```typescript
// Every API route must have rate limiting
// Use Vercel's built-in rate limiting or upstash/ratelimit
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 req/min per IP
  analytics: true,
})
```

**Input validation at the API boundary.**
- All inputs are validated with Zod before any processing.
- Job title: max 100 chars, stripped of HTML, trimmed.
- Industry: must be from the allowed enum list.
- Seniority: must be from the allowed enum list.
- Any input that fails validation returns 400 with a user-friendly message.
  It is never passed to the AI or enrichment pipeline.

**Environment variables — never in code.**
```bash
# .env.local (never committed)
ANTHROPIC_API_KEY=
ONET_API_KEY=          # If using authenticated O*NET endpoints
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```
- Run `git grep -i "sk-ant"` before every commit. If it matches, abort.
- The `.gitignore` must include `.env`, `.env.local`, `.env.production`.

**No logging of user inputs in production.**
- Job titles entered by users must not be logged to any external service.
- Internal analytics (aggregate counts, performance metrics) are fine.
- PII rule: if it could identify a person's job situation, don't log it.

---

## 5. External API Usage

### O*NET Web Services
- Base URL: `https://services.onetcenter.org/ws/`
- Cache all responses for **7 days** (occupation data is slow-changing).
- On failure: log error internally, proceed with AI-only mode silently.
- Never surface O*NET error codes to users.
- Respect the terms of service: do not scrape, use the official API only.

### BLS Data
- Cache for **30 days** (projection data is released annually).
- Store cached BLS data server-side (Redis/KV), not client-side.
- Treat 10-year projections as directional signals, not precise predictions.

### Anthropic Claude API
- Model: `claude-sonnet-4-20250514` (never use Haiku for the main risk analysis —
  quality matters here).
- `max_tokens: 1000` for risk analysis responses.
- Always validate the AI response against the expected JSON schema with Zod.
  If it fails validation, retry once. If it fails again, return an error.
- Set a `timeout: 15000` (15s). If exceeded, return a timeout error to the user
  with a "Try again" button — never hang.
- Log API latency (not content) to monitor for degradation.

### Rate limit awareness
| API | Free tier limit | Our limit |
|-----|----------------|-----------|
| O*NET | 150 req/day unauth | Cache aggressively |
| BLS | Unlimited | Cache aggressively |
| Anthropic | Per billing | Rate limit users |

---

## 6. Performance Standards

- **Time to first result: < 3 seconds** on a standard connection.
- **Cached result load time: < 300ms.**
- **Bundle size: < 200kb gzipped** for the main page JS.
- **Core Web Vitals targets**: LCP < 2.5s, CLS < 0.1, INP < 200ms.

### Performance rules
- No third-party scripts on the critical path (analytics loads async).
- Images use `next/image` with explicit `width` and `height`.
- Fonts use `next/font` with `display: swap`.
- API routes that call external services run in parallel with `Promise.all()`
  where possible — never sequential awaits for independent calls.
- The Anthropic call and the O*NET call should fire simultaneously:
  ```typescript
  const [onetData, blsData] = await Promise.all([
    fetchOnetData(jobTitle),
    fetchBlsData(jobTitle),
  ])
  // Then use both to build the AI prompt
  ```

---

## 7. Error Handling Hierarchy

```
User sees:          "Something went wrong. Try again." + retry button
                              ↑
Internal fallback:  AI-only mode (no enrichment data)
                              ↑
Logged internally:  Full error details (stack, API response, input params)
                              ↑
Never logged:       The user's job title or any input
```

### Error types and responses
| Error | User sees | Internal action |
|-------|-----------|----------------|
| O*NET 404 | Nothing (silent fallback) | Log + proceed AI-only |
| O*NET timeout | Nothing (silent fallback) | Log + proceed AI-only |
| AI response invalid JSON | "Try again" button | Log + retry once |
| AI timeout (>15s) | "Taking longer than usual..." | Log + show retry |
| Rate limit hit | "Too many requests. Try in a minute." | Log IP |
| Input validation fail | Specific field error message | No logging |
| Unexpected 500 | "Something went wrong. Try again." | Log full error |

---

## 8. Git Workflow

### Commit messages
Follow conventional commits:
```
feat: add O*NET job title autocomplete
fix: handle O*NET 404 gracefully in enrichment pipeline
perf: cache BLS projections server-side to reduce latency
test: add unit tests for normalizeJobTitle edge cases
refactor: split riskScore calculation into separate module
docs: update CLAUDE.md with BLS caching rules
```

### Branch naming
```
feat/onet-autocomplete
fix/onet-404-fallback
perf/bls-server-cache
```

### Before every commit — checklist
```bash
npm run test          # All tests green
npm run lint          # No lint errors
npm run type-check    # No TypeScript errors
git grep -i "sk-ant"  # No API keys in code
git grep -i "ANTHROPIC_API_KEY=" --include="*.ts" --include="*.tsx"
```

Never use `--no-verify` to skip pre-commit hooks.

---

## 9. What Never to Change

These decisions are locked. Do not revisit them without explicit user confirmation:

- **Single required input field.** The job title field is the only required input.
  Do not add more required fields.
- **No login wall.** The core result is always free and ungated.
- **No multi-step wizard.** Everything is on one page.
- **No popups or modals during the result.** The result page is calm and clean.
- **Simplicity first.** If a feature idea requires explaining it to the user,
  it probably doesn't belong here.

---

## 10. Session Startup Checklist

At the start of every Claude Code session:

1. Run `npm run test` — confirm green before touching anything.
2. Run `git status` — understand what's already in progress.
3. Read this file top-to-bottom if it has been more than 2 days since last session.
4. Use `/plan` before implementing any feature that touches more than 2 files.
5. Confirm the task with a one-sentence summary before starting work.

At the end of every session:

1. Run `npm run test` — confirm still green.
2. Run `npm run lint` and `npm run type-check`.
3. Commit work-in-progress to a branch (never leave unstaged changes).
4. Run `/learn` to extract any useful patterns from the session.

---

## 11. Sensitive Decisions Log

Document significant architectural or product decisions here as they are made.
Format: `YYYY-MM · decision · reason`

```
2026-04 · Use server-side API routes for all AI calls · Protect prompt IP
2026-04 · Cache O*NET responses 7 days in Redis · Respect rate limits + speed
2026-04 · claude-sonnet-4 for risk analysis, not Haiku · Quality > cost for core feature
2026-04 · Zod validation at every API boundary · Prevent prompt injection + bad data
```

---

*This file is the source of truth for how Claude Code operates on this project.
When in doubt, refer back here before making any decision.*