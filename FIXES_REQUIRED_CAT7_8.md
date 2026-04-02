# Required Fixes — Categories 7 & 8 + UX Flow

## CRITICAL (Block Launch)

### FIX-C1: Pass isProUser to InsightCards
**File**: `/src/pages/Index.tsx`
**Lines**: 100-120 (add state), 542 (update JSX)

**Problem**: InsightCards always receives `isProUser={undefined}`, defaults to `false`. Free users see full 9-card arc instead of 3-card arc. Prefetch burns API budget on non-converting users (~$0.03/user).

**Fix**:
```tsx
// Add near top of Index component (after session state setup)
const [isProUser, setIsProUser] = useState(false);

useEffect(() => {
  const checkProStatus = async () => {
    if (!session?.user?.id) {
      setIsProUser(false);
      return;
    }

    const { data } = await supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('user_id', session.user.id)
      .single();

    if (data?.tier) {
      setIsProUser(data.tier === 'pro' || data.tier === 'pro_monthly');
    } else {
      setIsProUser(false);
    }
  };

  checkProStatus();
}, [session?.user?.id]);

// Then update line 542:
// OLD:
<InsightCards report={scanReport} onComplete={handleInsightCardsComplete} scanId={scanId} biggest_concern={scanGoals?.biggest_concern} />

// NEW:
<InsightCards report={scanReport} onComplete={handleInsightCardsComplete} scanId={scanId} biggest_concern={scanGoals?.biggest_concern} isProUser={isProUser} />
```

**Test**:
1. Sign in as free user → InsightCards shows 3 cards only
2. Sign in as pro user → InsightCards shows 9 cards
3. Verify no extra API calls for free users

---

## HIGH (Fix Before UAT)

### FIX-H1: Add type="button" to Non-Form Buttons
**File**: `/src/components/SkillCrisisResponseCenter.tsx`
**Lines**: 227, 270, 473

**Problem**: Buttons without `type="button"` default to `type="submit"` when inside forms. If these appear in a form context, they'll submit the form unintentionally.

**Fix**:
```tsx
// Line 227 — OLD:
<button autoFocus onClick={onClose} className="p-2 hover:bg-muted ...">

// NEW:
<button type="button" autoFocus onClick={onClose} className="p-2 hover:bg-muted ...">

// Line 270 — same fix
<button type="button" autoFocus onClick={onClose} className="p-2 hover:bg-muted ...">

// Line 473 — OLD:
<button onClick={() => setShowAllAlerts(true)} className="text-xs ...">

// NEW:
<button type="button" onClick={() => setShowAllAlerts(true)} className="text-xs ...">
```

**Test**: Verify buttons don't submit any parent forms (should be none currently, but defensive coding).

---

### FIX-H2: Support defaultTier in ProUpgradeModal
**File**: `/src/components/ProUpgradeModal.tsx` + `/src/components/cards/ConversionGateCard.tsx` + `/src/components/InsightCards.tsx`

**Problem**: ConversionGateCard passes `defaultTier` ('year' or 'scan'/'month') to onUpgrade callback, but ProUpgradeModal doesn't accept or use it. User clicks "₹300/month" → modal shows "year" selected.

**Fix**:

**Part 1 — Update ProUpgradeModal.tsx**:
```tsx
// Line 7-10, OLD:
interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (tier: string) => void;
}

// NEW:
interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (tier: string) => void;
  defaultTier?: 'year' | 'month';
}

// Line 65-66, OLD:
export default function ProUpgradeModal({ isOpen, onClose, onSuccess }: ProUpgradeModalProps) {
  const [selected, setSelected] = useState<'month' | 'year'>('year');

// NEW:
export default function ProUpgradeModal({ isOpen, onClose, onSuccess, defaultTier }: ProUpgradeModalProps) {
  const [selected, setSelected] = useState<'month' | 'year'>(defaultTier === 'month' ? 'month' : 'year');
```

**Part 2 — Update InsightCards.tsx**:
```tsx
// Line 432-438, OLD:
{card.id === 'conversion-gate' && (
  <ErrorBoundary>
    <ConversionGateCard
      report={report}
      onUpgrade={() => setShowProModal(true)}
    />
  </ErrorBoundary>
)}

// NEW:
{card.id === 'conversion-gate' && (
  <ErrorBoundary>
    <ConversionGateCard
      report={report}
      onUpgrade={(tier) => {
        setProDefaultTier(tier === 'scan' ? 'month' : 'year');
        setShowProModal(true);
      }}
    />
  </ErrorBoundary>
)}

// Add state at top of InsightCards:
const [proDefaultTier, setProDefaultTier] = useState<'year' | 'month'>('year');

// Line 474-478, update ProUpgradeModal:
<ProUpgradeModal
  isOpen={showProModal}
  onClose={() => setShowProModal(false)}
  onSuccess={() => setShowProModal(false)}
  defaultTier={proDefaultTier}
/>
```

**Test**:
1. Click "₹300/month" CTA → Modal opens with "month" selected
2. Click "₹1,999/year" CTA → Modal opens with "year" selected
3. Pricing toggle works as expected

---

## MEDIUM (Fix Before Beta / Nice to Have)

### FIX-M1: Migrate Hardcoded Hex Colors to CSS Variables
**Files**:
- `/src/components/cards/ScoreTrendCard.tsx` (lines 37-39, 72-82, 321-339)
- `/src/components/cards/DoomClockCard.tsx` (lines 24-28, 104, 127-183)

**Problem**: Charts use hardcoded hex colors (`#ef4444`, `#f59e0b`, etc.) in inline styles and returned values. Won't respond to dark mode CSS variable changes.

**Why**: Low priority because colors are visually correct now, but this breaks future dark mode theming.

**Approach** (sketch):
```tsx
// In tailwind.config.ts, consider adding:
// These are already in use via prophet colors, but explicit mapping helps:
extend: {
  colors: {
    chart: {
      critical: 'hsl(var(--destructive))',    // red
      high: 'hsl(var(--prophet-gold))',        // amber
      medium: 'hsl(var(--prophet-gold))',      // amber (reuse)
      safe: 'hsl(var(--prophet-green))',       // green
      neutral: 'hsl(var(--muted-foreground))', // slate
    }
  }
}

// Then in components:
const colorMap = {
  critical: 'rgb(239, 68, 68)',  // Tailwind red-500
  high: 'rgb(245, 158, 11)',     // Tailwind amber-500
  medium: 'rgb(245, 158, 11)',
  safe: 'rgb(34, 197, 94)',      // Tailwind green-500
};

// Or better yet, use computed styles:
const getChartColor = (urgency: 'critical' | 'high' | 'medium' | 'safe') => {
  const root = document.documentElement;
  const computed = getComputedStyle(root);
  if (urgency === 'critical') {
    return computed.getPropertyValue('--destructive'); // user supplies actual color
  }
  // ... etc
};
```

**Test**: Change dark mode CSS variables, verify chart colors update (once implemented).

---

## GO/NO-GO CHECKLIST

Before marking "Ready for UAT", verify:

- [ ] **FIX-C1** merged: isProUser passed to InsightCards
  - Free user sees 3 cards
  - Pro user sees 9 cards
  - No extra API calls for free users

- [ ] **FIX-H1** merged: All buttons have `type="button"`
  - grep output confirms no more `<button` without `type=`

- [ ] **FIX-H2** merged: defaultTier flow working
  - Click "₹300/month" → modal shows month selected
  - Click "₹1,999/year" → modal shows year selected

- [ ] All other findings remain PASS ✓
  - Run grep checks to confirm:
    ```bash
    # Verify no new hardcoded colors added
    grep -rn '#[0-9a-f]\{6\}' src/ --include='*.tsx' | grep -v node_modules | wc -l

    # Verify no missing alt text
    grep -rn '<img ' src/ --include='*.tsx' | grep -v 'alt=' | wc -l
    ```

---

## Estimated Effort

| Fix | Time |
|-----|------|
| FIX-C1 (isProUser) | 30 min |
| FIX-H1 (type="button") | 15 min |
| FIX-H2 (defaultTier) | 45 min |
| Testing | 30 min |
| **Total** | **2 hours** |

---

## Post-Fix Verification

Run these commands to verify no regressions:

```bash
# Check for new intro of old issues
npm run lint

# Build for production
npm run build

# Search for any remaining issues
grep -rn "type=" src/components/*.tsx | grep -i button | head -5
grep -rn "isProUser" src/pages/Index.tsx

# Verify InsightCards receives prop
grep -A 10 "InsightCards" src/pages/Index.tsx | grep isProUser
```

**All checks should pass before UAT sign-off.**
