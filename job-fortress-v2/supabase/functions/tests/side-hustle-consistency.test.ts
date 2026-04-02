import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const profile = {
  report: {
    role: "Senior Product Manager",
    industry: "EdTech",
    all_skills: ["Product Strategy", "User Research", "SQL", "A/B Testing", "Roadmap Planning", "Stakeholder Management", "Figma", "Data Analysis", "Go-to-Market"],
    execution_skills: ["Sprint planning", "Cross-team coordination", "PRD writing"],
    strategic_skills: ["Market positioning", "Competitive analysis", "Pricing strategy"],
    moat_skills: ["EdTech domain expertise", "B2B SaaS GTM"],
    ai_tools_replacing: ["ChatGPT", "Notion AI", "Jasper"],
    seniority_tier: "MANAGER",
    years_experience: "6-8",
    linkedin_name: "Ananya Verma",
    linkedin_company: "Byju's",
    cognitive_moat: "Deep understanding of Indian education buyer psychology",
    geo_advantage: "India EdTech ecosystem insider",
    automation_risk: 45,
    salary_bleed_monthly: 12000,
    months_remaining: 30,
    top_contributors: [{factor: "AI content generation reducing PM-led copy"}, {factor: "No-code tools shrinking PM scope"}]
  },
  country: "IN"
};

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "apikey": SUPABASE_ANON_KEY
};

async function runOnce(label: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-side-hustles`, {
    method: "POST", headers, body: JSON.stringify(profile)
  });
  const data = await res.json();
  return { label, status: res.status, data };
}

Deno.test("Same profile 3 runs — creative consistency check", async () => {
  // Run all 3 in parallel
  const [r1, r2, r3] = await Promise.all([
    runOnce("Run 1"),
    runOnce("Run 2"),
    runOnce("Run 3"),
  ]);

  const allRuns = [r1, r2, r3];
  const allIdeaNames: string[][] = [];

  const GENERIC_BLACKLIST = [
    "freelance", "consulting", "newsletter", "course", "coaching",
    "agency", "freelancing", "mentor", "tutoring", "blog"
  ];

  for (const run of allRuns) {
    console.log(`\n═══ ${run.label} (status: ${run.status}) ═══`);
    const ideas = run.data.ideas || [];
    const names: string[] = [];

    for (const idea of ideas) {
      console.log(`  💡 ${idea.ideaName}`);
      console.log(`     ${idea.oneLineThesis}`);
      console.log(`     Model: ${idea.businessModel} | Conf: ${idea.confidenceScore} | Diff: ${idea.difficulty}`);
      console.log(`     Buyer: ${idea.targetBuyer}`);
      console.log(`     Earnings: ₹${idea.monthlyEarnings?.conservative}-${idea.monthlyEarnings?.realistic}-${idea.monthlyEarnings?.upside}/mo`);
      console.log(`     Signals: ${idea.profileSignalsUsed?.join(", ")}`);
      names.push(idea.ideaName);
    }
    allIdeaNames.push(names);

    if (ideas.length < 2) throw new Error(`${run.label} returned only ${ideas.length} ideas`);
  }

  // Flatten all names
  const flat = allIdeaNames.flat();

  // Check for generic names
  console.log(`\n═══ QUALITY CHECKS ═══`);
  const genericFound: string[] = [];
  for (const name of flat) {
    const lower = name.toLowerCase();
    for (const banned of GENERIC_BLACKLIST) {
      if (lower.includes(banned)) {
        genericFound.push(`"${name}" contains "${banned}"`);
      }
    }
  }
  if (genericFound.length > 0) {
    console.log(`⚠️ Generic names detected: ${genericFound.join("; ")}`);
  } else {
    console.log("✅ No generic/banned terms in any idea name");
  }

  // Check for jargon compound names (CamelCase brand names)
  const jargonPattern = /^[A-Z][a-z]+[A-Z][a-z]+/;
  const jargonNames = flat.filter(n => jargonPattern.test(n.split(" ")[0]));
  if (jargonNames.length > 0) {
    console.log(`⚠️ Jargon brand-style names: ${jargonNames.join("; ")}`);
  } else {
    console.log("✅ No jargon/brand-style compound names");
  }

  // Check variety across runs
  const uniqueNames = new Set(flat);
  const totalNames = flat.length;
  const uniqueRatio = uniqueNames.size / totalNames;
  console.log(`\n═══ VARIETY ACROSS RUNS ═══`);
  console.log(`Total ideas: ${totalNames} | Unique names: ${uniqueNames.size} | Ratio: ${(uniqueRatio * 100).toFixed(0)}%`);

  for (let i = 0; i < allIdeaNames.length; i++) {
    console.log(`  Run ${i+1}: ${allIdeaNames[i].join(" | ")}`);
  }

  if (uniqueRatio < 0.5) {
    console.log("⚠️ Low variety — more than half the ideas are duplicates across runs");
  } else {
    console.log("✅ Good variety across runs");
  }

  // Check business model diversity within each run
  for (let i = 0; i < allRuns.length; i++) {
    const models = (allRuns[i].data.ideas || []).map((idea: any) => idea.businessModel);
    const uniqueModels = new Set(models);
    console.log(`  Run ${i+1} models: ${models.join(", ")} (${uniqueModels.size} unique)`);
  }

  console.log("\n✅ All 3 runs completed successfully");
});
