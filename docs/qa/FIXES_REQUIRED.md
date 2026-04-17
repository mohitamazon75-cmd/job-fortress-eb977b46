# Job Fortress QA Audit — Required Fixes

## Issue 1: Salary Range Hallucination (HIGH)

**File:** `supabase/functions/best-fit-jobs/index.ts`
**Lines:** 158-159, 218-219

### Current Code (WRONG)
```typescript
// Line 158
const systemPrompt = `... Extract salary info only if explicitly stated in the snippet. If not stated, return null for salary fields — do not estimate.`;

// Line 218-219 — CONTRADICTS ABOVE
"salary_range": { type: "string", description: "Salary range if available, or estimated range" }
```

### Fixed Code
```typescript
// Line 158 — Make stronger
const systemPrompt = `... Extract salary info ONLY if explicitly stated in the snippet. If not found, MUST return null. Do NOT estimate, infer, extrapolate, or provide salary ranges that are not explicitly stated in the source material.`;

// Line 218-219 — Fix schema
"salary_range": { 
  type: "string", 
  nullable: true,
  description: "Salary range ONLY if explicitly stated in the job snippet. Must be null if salary information is not found in the listing." 
}
```

---

## Issue 2: Missing JWT Timing-Safe Validation (HIGH)

**File:** `supabase/functions/activate-subscription/index.ts`
**Lines:** 24-44

### Current Code (VULNERABLE)
```typescript
try {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
```

### Fixed Code
```typescript
import { validateJwtClaims } from "../_shared/abuse-guard.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    // Add proper JWT validation with timing-safe comparison
    const { userId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
    if (jwtBlocked) return jwtBlocked;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Now userId is validated and safe to use
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("status, plan_type")
      .eq("razorpay_payment_id", payment_id)
      .eq("user_id", userId)  // Use validated userId
      .maybeSingle();
```

---

## Issue 3: Timing-Safe Signature Comparison (MEDIUM)

**File:** `supabase/functions/razorpay-webhook/index.ts`
**Lines:** 32-38

### Current Code (LEAKS TIMING INFO)
```typescript
const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
const expectedHex = Array.from(new Uint8Array(sig))
  .map(b => b.toString(16).padStart(2, "0"))
  .join("");

if (expectedHex !== signature) {  // Direct comparison — timing attack risk
  console.warn("[razorpay-webhook] Invalid signature");
```

### Fixed Code
```typescript
// Import from abuse-guard (it already exists there)
import { timingSafeEqual } from "../_shared/abuse-guard.ts";

// Then in handler:
const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
const expectedHex = Array.from(new Uint8Array(sig))
  .map(b => b.toString(16).padStart(2, "0"))
  .join("");

// Use timing-safe comparison
const signatureMatch = await timingSafeEqual(expectedHex, signature);
if (!signatureMatch) {
  console.warn("[razorpay-webhook] Invalid signature");
  return new Response(
    JSON.stringify({ error: "Invalid signature" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

NOTE: Export `timingSafeEqual` from `abuse-guard.ts` if not already exported:
```typescript
// In _shared/abuse-guard.ts, add to exports:
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  // Already implemented in lines 11-27
}
```

---

## Issue 4: Race Condition in Scan Deduplication (MEDIUM)

**File:** `supabase/functions/create-scan/index.ts`
**Lines:** 38-57

### Current Code (ALLOWS DUPLICATE PROCESSING)
```typescript
if (userId) {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("scans")
    .select("id, access_token")
    .eq("user_id", userId)
    .eq("scan_status", "processing")
    .gte("created_at", twoMinAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return new Response(
      JSON.stringify({ id: existing.id, accessToken: existing.access_token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

Issue: Returns existing scan but trigger happens OUTSIDE this if block (lines 86-95), so if called again, process-scan gets triggered twice.

### Fixed Code

**Option A: Database Constraint (Recommended)**

Add migration to database:
```sql
CREATE UNIQUE INDEX scans_user_linkedin_processing 
  ON scans(user_id, linkedin_url, DATE(created_at))
  WHERE scan_status = 'processing';
```

Then in function, catch the constraint violation:
```typescript
if (userId && linkedinUrl) {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("scans")
    .select("id, access_token")
    .eq("user_id", userId)
    .eq("linkedin_url", linkedinUrl)
    .eq("scan_status", "processing")
    .gte("created_at", twoMinAgo)
    .single();

  if (existing) {
    console.log(`[create-scan] Returning existing scan ${existing.id}`);
    return new Response(
      JSON.stringify({ 
        id: existing.id, 
        accessToken: existing.access_token,
        duplicate: true  // Signal to client
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Try insert, catch constraint violation
const { data, error } = await supabase
  .from("scans")
  .insert(insertPayload)
  .select("id, access_token")
  .single();

if (error?.code === "23505") {  // Unique constraint violation
  console.warn("[create-scan] Duplicate scan detected after insert attempt");
  return new Response(
    JSON.stringify({ 
      error: "Scan already in progress",
      code: "DUPLICATE_SCAN"
    }),
    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## Issue 5: Error Message Information Leakage (MEDIUM)

**File:** `supabase/functions/best-fit-jobs/index.ts`
**Lines:** 260-276, 281-293

### Current Code (EXPOSES INTERNALS)
```typescript
} catch (e) {
  console.error("[BestFitJobs] Failed to parse tool call:", e);
  return new Response(JSON.stringify({
    error: "schema_validation_failed",
    message: "Failed to parse AI response",  // Reveals internal parsing
    retryable: true,
    fallback: null,
  }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Fallback parsing...
if (!result) {
  const content = aiData.choices?.[0]?.message?.content || "";
  try {
    result = JSON.parse(content);
  } catch (e) {
    console.error("[BestFitJobs] Failed to parse content:", e);
    return new Response(JSON.stringify({
      error: "schema_validation_failed",
      message: "Failed to parse AI response",
      retryable: true,
      fallback: null,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
```

### Fixed Code
```typescript
} catch (e) {
  // Log full error server-side for debugging
  console.error("[BestFitJobs] AI tool call parsing failed:", e);
  
  // Return generic error to client
  return new Response(JSON.stringify({
    error: "Unable to process job listings",
    retry_after: 30
  }), { 
    status: 500, 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });
}

// Fallback parsing...
if (!result) {
  const content = aiData.choices?.[0]?.message?.content || "";
  try {
    result = JSON.parse(content);
  } catch (e) {
    // Log full error server-side for debugging
    console.error("[BestFitJobs] AI content parsing failed:", e);
    
    // Return generic error to client
    return new Response(JSON.stringify({
      error: "Unable to process job listings",
      retry_after: 60
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}
```

---

## Issue 6: Confusing Validation Functions (LOW)

**File:** `supabase/functions/_shared/abuse-guard.ts`

### Current Code (CONFUSING)
```typescript
export function validateRequest(req: Request): string | null { ... }
export function guardRequest(req: Request, corsHeaders: Record<string, string>): Response | null { ... }
export async function validateJwtClaims(...) { ... }
```

Both `validateRequest()` and `guardRequest()` do similar things but:
- `validateRequest()` returns string (error reason)
- `guardRequest()` returns Response | null and handles size check

Most functions use `guardRequest()`, but `validateRequest()` is also public, causing confusion.

### Fixed Code

**In abuse-guard.ts:**
```typescript
// BEFORE: Both exported
export function validateRequest(req: Request): string | null { ... }
export function guardRequest(req: Request, corsHeaders: Record<string, string>): Response | null { ... }

// AFTER: Make validateRequest private, consolidate
// Keep only:
/**
 * Validates that a request is legitimate (from app frontend or server-to-server).
 * Returns null if valid, or a 403/413 Response if blocked.
 * 
 * Checks:
 * - Request body size (10MB limit)
 * - Origin header (trusted origins only)
 * - Authorization header (Bearer token required)
 * 
 * This is the ONLY validation function to use in edge functions.
 */
export function guardRequest(req: Request, corsHeaders: Record<string, string>): Response | null {
  // Body size check (10MB limit)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    console.warn(`[AbuseGuard] Rejected oversized body: ${contentLength} bytes`);
    return new Response(
      JSON.stringify({ error: "Request body too large" }),
      { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate origin and auth (private function below)
  const reason = _validateRequest(req);  // Private helper
  if (reason) {
    console.warn(`[AbuseGuard] Blocked request: ${reason}`);
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return null;
}

// PRIVATE helper — not exported
function _validateRequest(req: Request): string | null {
  const origin = req.headers.get("origin");
  
  if (origin && !isTrustedOrigin(origin)) {
    return `Untrusted origin: ${origin}`;
  }

  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return "Missing authorization";
  }

  const token = auth.slice(7).trim();
  if (token.length < 20) {
    return "Invalid authorization token";
  }

  return null;
}

// Keep these exports
export async function isServiceRoleCall(req: Request): Promise<boolean> { ... }
export async function validateJwtClaims(...) { ... }
export async function timingSafeEqual(a: string, b: string): Promise<boolean> { ... }
```

**Update all edge functions to use ONLY `guardRequest()`:**
```typescript
// Before
import { validateRequest, guardRequest } from "../_shared/abuse-guard.ts";

// After — remove validateRequest
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";

// Then in handler use consistent pattern:
const blocked = guardRequest(req, corsHeaders);
if (blocked) return blocked;

const { userId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
if (jwtBlocked) return jwtBlocked;
```

---

## Summary of Changes

| Issue | Severity | File | Type | Lines |
|-------|----------|------|------|-------|
| Salary hallucination | HIGH | best-fit-jobs | Schema + prompt | 158, 218-219 |
| JWT validation | HIGH | activate-subscription | Auth logic | 24-44 |
| Signature timing | MEDIUM | razorpay-webhook | Crypto | 32-38 |
| Scan deduplication | MEDIUM | create-scan | DB constraint | 38-57 |
| Error messages | MEDIUM | best-fit-jobs | Error handling | 260-293 |
| Validation functions | LOW | abuse-guard.ts | Code organization | 57-78 |

---

## Testing After Fixes

```bash
# 1. Test best-fit-jobs with no salary in snippet
curl -X POST https://YOUR_URL/functions/v1/best-fit-jobs \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "Software Engineer",
    "industry": "Tech",
    "country": "IN"
  }'
# Verify: salary_range is null when not in listing

# 2. Test activate-subscription with invalid token
curl -X POST https://YOUR_URL/functions/v1/activate-subscription \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"payment_id": "pay_123", "tier": "pro"}'
# Verify: 401 Unauthorized (not error message leak)

# 3. Test razorpay-webhook with bad signature
curl -X POST https://YOUR_URL/functions/v1/razorpay-webhook \
  -H "x-razorpay-signature: badsignature" \
  -H "Content-Type: application/json" \
  -d '{"event": "payment.captured"}'
# Verify: 401 with "Invalid signature" (no timing leak)

# 4. Test create-scan with duplicate request
curl -X POST https://YOUR_URL/functions/v1/create-scan \
  -H "Authorization: Bearer $ANON_KEY" \
  -d '{"linkedinUrl": "https://linkedin.com/in/test"}'
# Wait <2 min, repeat
# Verify: Second request returns same scanId (no double trigger)
```

