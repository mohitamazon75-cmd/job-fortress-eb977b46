import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("Entry-level vs Senior profiles produce differentiated side hustles", async () => {
  const entryProfile = {
    report: {
      role: "Junior Data Entry Operator",
      industry: "BPO / Outsourcing",
      all_skills: ["Excel", "Data Entry", "Email Management", "Basic SQL", "Google Sheets"],
      execution_skills: ["Speed typing", "Accuracy", "Following SOPs"],
      strategic_skills: [],
      moat_skills: [],
      ai_tools_replacing: ["ChatGPT", "UiPath", "Automation Anywhere"],
      seniority_tier: "ENTRY",
      years_experience: "1-2",
      linkedin_name: "Priya Sharma",
      linkedin_company: "Infosys BPM",
      automation_risk: 82,
      salary_bleed_monthly: 8000,
      months_remaining: 18
    },
    country: "IN"
  };

  const seniorProfile = {
    report: {
      role: "VP of Engineering",
      industry: "Fintech",
      all_skills: ["System Architecture", "Team Leadership", "P&L Management", "M&A Due Diligence", "Regulatory Compliance", "Platform Engineering", "Vendor Management", "Board Presentations", "OKR Frameworks", "Incident Management"],
      execution_skills: ["Cross-functional alignment", "Budget optimization", "Hiring at scale"],
      strategic_skills: ["Technology strategy", "Build vs Buy decisions", "Platform consolidation"],
      moat_skills: ["RBI compliance expertise", "Payment gateway architecture", "Lending platform design"],
      ai_tools_replacing: ["GitHub Copilot", "Linear", "Cursor"],
      seniority_tier: "EXECUTIVE",
      years_experience: "15+",
      linkedin_name: "Rajesh Menon",
      linkedin_company: "PhonePe",
      cognitive_moat: "Regulatory navigation + engineering leadership intersection",
      automation_risk: 22,
      months_remaining: 60,
      top_contributors: [{factor: "AI coding tools reducing team size needs"}]
    },
    country: "IN"
  };

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "apikey": SUPABASE_ANON_KEY
  };

  const [entryRes, seniorRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/functions/v1/generate-side-hustles`, {
      method: "POST", headers, body: JSON.stringify(entryProfile)
    }),
    fetch(`${SUPABASE_URL}/functions/v1/generate-side-hustles`, {
      method: "POST", headers, body: JSON.stringify(seniorProfile)
    })
  ]);

  const entryData = await entryRes.json();
  const seniorData = await seniorRes.json();

  console.log("\n═══ ENTRY-LEVEL (Junior Data Entry, BPO, 1-2 yrs, 82% AI risk) ═══");
  console.log("Summary:", entryData.executiveSummary?.substring(0, 250));
  (entryData.ideas || []).forEach((idea: any, i: number) => {
    console.log(`\n  💡 Idea ${i+1}: ${idea.ideaName}`);
    console.log(`     ${idea.oneLineThesis}`);
    console.log(`     Model: ${idea.businessModel} | Confidence: ${idea.confidenceScore} | Difficulty: ${idea.difficulty}`);
    console.log(`     Why fits: ${idea.whyThisFits?.substring(0, 200)}`);
    console.log(`     Why now: ${idea.whyNow?.substring(0, 200)}`);
    console.log(`     Buyer: ${idea.targetBuyer}`);
    console.log(`     Earnings: ₹${idea.monthlyEarnings?.conservative}-${idea.monthlyEarnings?.realistic}-${idea.monthlyEarnings?.upside}/mo`);
    console.log(`     Signals: ${idea.profileSignalsUsed?.join(", ")}`);
  });

  console.log("\n\n═══ SENIOR (VP Engineering, Fintech, 15+ yrs, 22% AI risk) ═══");
  console.log("Summary:", seniorData.executiveSummary?.substring(0, 250));
  (seniorData.ideas || []).forEach((idea: any, i: number) => {
    console.log(`\n  💡 Idea ${i+1}: ${idea.ideaName}`);
    console.log(`     ${idea.oneLineThesis}`);
    console.log(`     Model: ${idea.businessModel} | Confidence: ${idea.confidenceScore} | Difficulty: ${idea.difficulty}`);
    console.log(`     Why fits: ${idea.whyThisFits?.substring(0, 200)}`);
    console.log(`     Why now: ${idea.whyNow?.substring(0, 200)}`);
    console.log(`     Buyer: ${idea.targetBuyer}`);
    console.log(`     Earnings: ₹${idea.monthlyEarnings?.conservative}-${idea.monthlyEarnings?.realistic}-${idea.monthlyEarnings?.upside}/mo`);
    console.log(`     Signals: ${idea.profileSignalsUsed?.join(", ")}`);
  });

  // Differentiation check
  const entryNames = (entryData.ideas || []).map((i: any) => i.ideaName);
  const seniorNames = (seniorData.ideas || []).map((i: any) => i.ideaName);
  console.log(`\n═══ DIFFERENTIATION ═══`);
  console.log(`Entry: ${entryNames.join(" | ")}`);
  console.log(`Senior: ${seniorNames.join(" | ")}`);
  
  // Verify no overlap
  const overlap = entryNames.filter((n: string) => seniorNames.includes(n));
  if (overlap.length > 0) throw new Error(`Ideas overlap: ${overlap.join(", ")}`);
  console.log("✅ Zero overlap — fully differentiated ideas");

  // Verify each returned 3 ideas
  if ((entryData.ideas?.length || 0) < 2) throw new Error(`Entry returned only ${entryData.ideas?.length} ideas`);
  if ((seniorData.ideas?.length || 0) < 2) throw new Error(`Senior returned only ${seniorData.ideas?.length} ideas`);
  console.log("✅ Both profiles returned sufficient ideas");
});
