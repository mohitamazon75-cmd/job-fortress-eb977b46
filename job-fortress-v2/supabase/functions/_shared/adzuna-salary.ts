// Adzuna Salary Enrichment — Real Indian job market salary data
// Free API: https://developer.adzuna.com (requires ADZUNA_API_ID + ADZUNA_API_KEY)
// Returns aggregated salary range from real job postings in India

interface AdzunaSalaryResult {
  role: string;
  avg_salary_inr: string | null;          // e.g. "₹12L - ₹18L/yr" or null
  median_salary_inr: number | null;        // median in INR
  sample_count: number;                    // number of job postings sampled
  salary_source: "adzuna_live" | "not_available";
  fetched_at: string;                      // ISO timestamp
}

interface AdzunaCredentials {
  apiId: string;
  apiKey: string;
}

export async function fetchAdzunaSalaryForRole(
  role: string,
  creds: AdzunaCredentials,
): Promise<AdzunaSalaryResult> {
  const fetched_at = new Date().toISOString();

  // Guard against missing credentials
  if (!creds.apiId || !creds.apiKey) {
    return {
      role,
      avg_salary_inr: null,
      median_salary_inr: null,
      sample_count: 0,
      salary_source: "not_available",
      fetched_at,
    };
  }

  try {
    const encodedRole = encodeURIComponent(role);
    const adzunaUrl = new URL("https://api.adzuna.com/v1/api/jobs/in/search/1");
    adzunaUrl.searchParams.set("app_id", creds.apiId);
    adzunaUrl.searchParams.set("app_key", creds.apiKey);
    adzunaUrl.searchParams.set("results_per_page", "20");
    adzunaUrl.searchParams.set("what", role);
    adzunaUrl.searchParams.set("where", "India");
    adzunaUrl.searchParams.set("salary_include_unknown", "0");
    adzunaUrl.searchParams.set("content-type", "application/json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(adzunaUrl.toString(), {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        role,
        avg_salary_inr: null,
        median_salary_inr: null,
        sample_count: 0,
        salary_source: "not_available",
        fetched_at,
      };
    }

    const data = await resp.json();
    const results = data.results || [];

    // Extract and filter salary data
    const salaries: number[] = [];
    for (const job of results) {
      if (job.salary_min && job.salary_max) {
        // Filter out clearly wrong or outlier data
        if (job.salary_min < 100000 || job.salary_max > 50000000) {
          continue;
        }
        const midpoint = (job.salary_min + job.salary_max) / 2;
        salaries.push(midpoint);
      }
    }

    if (salaries.length === 0) {
      return {
        role,
        avg_salary_inr: null,
        median_salary_inr: null,
        sample_count: 0,
        salary_source: "not_available",
        fetched_at,
      };
    }

    // Calculate median
    salaries.sort((a, b) => a - b);
    const median =
      salaries.length % 2 === 0
        ? (salaries[salaries.length / 2 - 1] + salaries[salaries.length / 2]) /
          2
        : salaries[Math.floor(salaries.length / 2)];

    // Format as: ₹{median}L - ₹{median*1.3}L/yr
    const medianInLakhs = median / 100000;
    const upperBandInLakhs = (median * 1.3) / 100000;
    const avg_salary_inr = `₹${medianInLakhs.toFixed(0)}L - ₹${upperBandInLakhs.toFixed(0)}L/yr`;

    return {
      role,
      avg_salary_inr,
      median_salary_inr: Math.round(median),
      sample_count: salaries.length,
      salary_source: "adzuna_live",
      fetched_at,
    };
  } catch (e: any) {
    // Any error (timeout, network, parsing) returns unavailable
    return {
      role,
      avg_salary_inr: null,
      median_salary_inr: null,
      sample_count: 0,
      salary_source: "not_available",
      fetched_at,
    };
  }
}

export async function enrichRolesWithAdzunaSalary(
  roles: Array<{ role: string; [key: string]: any }>,
  env: Record<string, string>,
): Promise<Array<{ role: string; avg_salary_inr: string | null; [key: string]: any }>> {
  // Extract Adzuna credentials
  const apiId = env.ADZUNA_API_ID || "";
  const apiKey = env.ADZUNA_API_KEY || "";

  // Graceful null if credentials missing
  if (!apiId || !apiKey) {
    return roles;
  }

  const creds: AdzunaCredentials = { apiId, apiKey };

  // Run up to 3 parallel fetches
  const batchSize = 3;
  const enrichedRoles = [...roles];

  for (let i = 0; i < roles.length; i += batchSize) {
    const batch = roles.slice(i, i + batchSize);
    const salaryPromises = batch.map((r) =>
      fetchAdzunaSalaryForRole(r.role, creds)
    );

    const salaryResults = await Promise.all(salaryPromises);

    for (let j = 0; j < salaryResults.length; j++) {
      const roleIndex = i + j;
      const salaryData = salaryResults[j];
      enrichedRoles[roleIndex] = {
        ...enrichedRoles[roleIndex],
        avg_salary_inr: salaryData.avg_salary_inr,
      };
    }
  }

  return enrichedRoles;
}
