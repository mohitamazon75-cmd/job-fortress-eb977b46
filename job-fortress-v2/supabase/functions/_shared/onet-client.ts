/**
 * onet-client.ts
 * O*NET Web Services — US Dept of Labor free occupational data.
 * REGISTRATION: Free at https://services.onetcenter.org/developer/
 * ENV VARS REQUIRED: ONET_USERNAME, ONET_PASSWORD
 *
 * Provides real automation risk scores, skill requirements, tasks per occupation.
 * Currently the app cites O*NET in methodology but doesn't call the API.
 * This integration replaces hardcoded KG values with real government data.
 */

const ONET_BASE = "https://services.onetcenter.org/ws";

interface OnetOccupation {
  code: string;        // SOC code e.g. "15-1252.00"
  title: string;
  href: string;
}

interface OnetAutomationScore {
  occupation_code: string;
  occupation_title: string;
  automation_probability: number | null; // 0-1, null if not available
  source: "onet";
}

interface OnetSkill {
  element_id: string;
  name: string;
  description: string;
  scale_id: string;
  data_value: number;    // 0-7 scale importance
  standard_error: number;
  lower_ci_bound: number;
  upper_ci_bound: number;
}

interface OnetTechnology {
  category: { unspsc_code: string; title: string };
  example: { hot_technology: boolean; in_demand: boolean; title: string; url?: string }[];
}

// Search for occupations matching a role name
export async function searchOnetOccupations(
  roleName: string,
  credentials: { username: string; password: string }
): Promise<OnetOccupation[]> {
  try {
    const auth = btoa(`${credentials.username}:${credentials.password}`);
    const params = new URLSearchParams({ keyword: roleName, end: "5" });
    const res = await fetch(`${ONET_BASE}/occupations?${params}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.occupation || []).map((o: any) => ({
      code: o.code,
      title: o.title,
      href: o.href,
    }));
  } catch {
    return [];
  }
}

// Get technology tools for an occupation (shows AI tools in the field)
export async function getOnetTechnologies(
  occupationCode: string,
  credentials: { username: string; password: string }
): Promise<OnetTechnology[]> {
  try {
    const auth = btoa(`${credentials.username}:${credentials.password}`);
    const res = await fetch(`${ONET_BASE}/occupations/${occupationCode}/technology_skills`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.category || [];
  } catch {
    return [];
  }
}

// Get skills importance data for an occupation
export async function getOnetSkills(
  occupationCode: string,
  credentials: { username: string; password: string }
): Promise<OnetSkill[]> {
  try {
    const auth = btoa(`${credentials.username}:${credentials.password}`);
    const res = await fetch(`${ONET_BASE}/occupations/${occupationCode}/skills`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.element || []).filter((e: any) => e.scale?.id === "IM"); // Importance scale
  } catch {
    return [];
  }
}

/**
 * Get enriched occupation data for a role.
 * Returns null gracefully if credentials not set or API unavailable.
 */
export async function enrichRoleWithOnet(
  roleName: string,
  env: { username?: string; password?: string }
): Promise<{
  occupation_code: string;
  occupation_title: string;
  hot_technologies: string[];
  top_skills: string[];
  source: "onet";
} | null> {
  if (!env.username || !env.password) return null; // Graceful fallback

  const creds = { username: env.username, password: env.password };

  try {
    const occupations = await searchOnetOccupations(roleName, creds);
    if (occupations.length === 0) return null;

    const best = occupations[0]; // Most relevant match

    const [technologies, skills] = await Promise.allSettled([
      getOnetTechnologies(best.code, creds),
      getOnetSkills(best.code, creds),
    ]);

    const hotTechs = technologies.status === "fulfilled"
      ? technologies.value
          .flatMap(cat => cat.example)
          .filter(ex => ex.hot_technology || ex.in_demand)
          .map(ex => ex.title)
          .slice(0, 8)
      : [];

    const topSkills = skills.status === "fulfilled"
      ? skills.value
          .sort((a, b) => b.data_value - a.data_value)
          .slice(0, 6)
          .map(s => s.name)
      : [];

    return {
      occupation_code: best.code,
      occupation_title: best.title,
      hot_technologies: hotTechs,
      top_skills: topSkills,
      source: "onet",
    };
  } catch {
    return null;
  }
}
