/**
 * @fileoverview Persists raw resume text, parsed profile JSON, and LinkedIn
 * scrape payloads into resume_artifacts / linkedin_snapshots.
 *
 * Goldmine layer: every successful ingestion is captured for future ML,
 * cohort analytics, and longitudinal SkillDNA. Writes are fire-and-forget
 * — failures are logged but never throw, so they cannot break the scan.
 *
 * data_retention_consent is a per-row mirror of scans.data_retention_consent.
 * When false, the row is eligible for the 90-day DPDP auto-purge.
 */

export interface ResumeArtifactInput {
  scanId: string;
  userId: string | null;
  resumeFilePath: string | null;
  rawText: string;
  parsedJson: Record<string, unknown>;
  extractionModel: string;
  extractionConfidence: string;
  parserVersion?: string;
  missingFields?: string[];
  extractedYearsExperience?: number | null;
  dataRetentionConsent: boolean;
}

export interface LinkedinSnapshotInput {
  scanId: string;
  userId: string | null;
  linkedinUrl: string;
  rawPayload: Record<string, unknown>;
  sourceProvider?: string;
  scrapeConfidence?: string;
  dataRetentionConsent: boolean;
}

export async function recordResumeArtifact(
  supabase: any,
  input: ResumeArtifactInput,
): Promise<void> {
  try {
    const { error } = await supabase.from("resume_artifacts").insert({
      scan_id: input.scanId,
      user_id: input.userId,
      resume_file_path: input.resumeFilePath,
      raw_text: input.rawText,
      parsed_json: input.parsedJson ?? {},
      extraction_model: input.extractionModel,
      extraction_confidence: input.extractionConfidence,
      parser_version: input.parserVersion ?? "gemini-vision-v1",
      missing_fields: input.missingFields ?? [],
      extracted_years_experience: input.extractedYearsExperience ?? null,
      data_retention_consent: input.dataRetentionConsent,
    });
    if (error) {
      console.warn("[artifact-recorder] resume_artifacts insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[artifact-recorder] resume_artifacts threw:", (e as Error).message);
  }
}

export async function recordLinkedinSnapshot(
  supabase: any,
  input: LinkedinSnapshotInput,
): Promise<void> {
  try {
    const { error } = await supabase.from("linkedin_snapshots").insert({
      scan_id: input.scanId,
      user_id: input.userId,
      linkedin_url: input.linkedinUrl,
      raw_payload: input.rawPayload ?? {},
      source_provider: input.sourceProvider ?? "apify",
      scrape_confidence: input.scrapeConfidence ?? null,
      data_retention_consent: input.dataRetentionConsent,
    });
    if (error) {
      console.warn("[artifact-recorder] linkedin_snapshots insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[artifact-recorder] linkedin_snapshots threw:", (e as Error).message);
  }
}
