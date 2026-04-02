// ═══════════════════════════════════════════════════════════════
// Career Genome Sequencer — Adversarial Multi-Agent Debate Engine
// 3 competing AI agents stream a live debate. When agents
// disagree by >20 points, an Evidence Collector agent fetches
// real-time web data to resolve the dispute.
// ═══════════════════════════════════════════════════════════════

import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { guardRequest, validateJwtClaims } from "../_shared/abuse-guard.ts";
import { AI_URL, PRO_MODEL } from "../_shared/ai-agent-caller.ts";
import { tavilySearch } from "../_shared/tavily-search.ts";
import { logTokenUsageRaw } from "../_shared/token-tracker.ts";
import {
  PROSECUTOR_SYSTEM,
  DEFENDER_SYSTEM,
  JUDGE_SYSTEM,
  buildCaseFile,
} from "./agent-prompts.ts";

// ── SSE Helper ──────────────────────────────────────────────
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Stream Agent Response ───────────────────────────────────
async function streamAgentResponse(
  apiKey: string,
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  writer: { write: (chunk: Uint8Array) => Promise<void> },
  encoder: TextEncoder,
  model = PRO_MODEL,
): Promise<string> {
  let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
  await writer.write(encoder.encode(sseEvent({
    type: "agent_start",
    agent: agentName,
    timestamp: Date.now(),
  })));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[${agentName}] AI error [${resp.status}]:`, errText.slice(0, 200));
      await writer.write(encoder.encode(sseEvent({
        type: "agent_error",
        agent: agentName,
        error: `Model returned ${resp.status}`,
      })));
      return "";
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          // Capture usage data from final chunk
          if (parsed.usage) {
            usageData = parsed.usage;
          }
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
            await writer.write(encoder.encode(sseEvent({
              type: "agent_token",
              agent: agentName,
              token: content,
            })));
          }
        } catch { /* partial JSON, skip */ }
      }
    }

    await writer.write(encoder.encode(sseEvent({
      type: "agent_complete",
      agent: agentName,
      timestamp: Date.now(),
    })));

    // Log token usage for this agent
    if (usageData) {
      logTokenUsageRaw(
        "career-genome", agentName, model,
        usageData.prompt_tokens || 0,
        usageData.completion_tokens || 0,
      );
    }

    return fullContent;
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[${agentName}] Stream error:`, err);
    await writer.write(encoder.encode(sseEvent({
      type: "agent_error",
      agent: agentName,
      error: err instanceof Error ? err.message : "Unknown error",
    })));
    return "";
  }
}

// ── Score Extraction ────────────────────────────────────────
function extractScore(text: string, label: string): number | null {
  const regex = new RegExp(`${label}:\\s*(\\d+)`, "i");
  const match = text.match(regex);
  return match ? Math.min(100, Math.max(0, parseInt(match[1], 10))) : null;
}

function extractTrajectory(text: string): string {
  const match = text.match(/TRAJECTORY:\s*(ASCENDING|STABLE|DECLINING|CRITICAL)/i);
  return match?.[1]?.toUpperCase() || "STABLE";
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreFlight(req);
  const corsHeaders = getCorsHeaders(req);

  const blocked = guardRequest(req, corsHeaders);
  if (blocked) return blocked;

  const { userId, blocked: jwtBlocked } = await validateJwtClaims(req, corsHeaders);
  if (jwtBlocked) return jwtBlocked;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { report, scanId } = body;
  if (!report) {
    return new Response(JSON.stringify({ error: "Missing report data" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[CareerGenome] Starting adversarial debate for scan ${scanId}, user ${userId}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const writer = {
        write: async (chunk: Uint8Array) => controller.enqueue(chunk),
      } as { write: (chunk: Uint8Array) => Promise<void> };

      try {
        const caseFile = buildCaseFile(report);
        const roleName = report.current_role || report.role_detected || "this professional";

        // ═══ PHASE 1: PROSECUTOR ═══
        await writer.write(encoder.encode(sseEvent({
          type: "phase",
          phase: "prosecution",
          label: `Prosecutor is building the case against ${roleName}...`,
        })));

        const prosecutorOutput = await streamAgentResponse(
          apiKey, "Prosecutor", PROSECUTOR_SYSTEM,
          `You are prosecuting the career viability of a ${roleName}. Analyze this profile and build your case:\n\n${caseFile}`,
          writer, encoder, "google/gemini-3.1-pro-preview",
        );

        const threatScore = extractScore(prosecutorOutput, "THREAT_SCORE") ?? 50;

        // ═══ PHASE 2: DEFENDER ═══
        await writer.write(encoder.encode(sseEvent({
          type: "phase",
          phase: "defense",
          label: `Defender is mounting the counter-argument for ${roleName}...`,
        })));

        const defenderOutput = await streamAgentResponse(
          apiKey, "Defender", DEFENDER_SYSTEM,
          `The Prosecutor has made their case against a ${roleName}. Review the profile and prosecution, then mount your defense. Counter specific claims.\n\n${caseFile}\n\n══ PROSECUTION ARGUMENT ══\n${prosecutorOutput}`,
          writer, encoder, "google/gemini-3.1-pro-preview",
        );

        const resilienceScore = extractScore(defenderOutput, "RESILIENCE_SCORE") ?? 50;

        // ═══ PHASE 2.5: EVIDENCE COLLECTION ═══
        const disagreement = Math.abs(threatScore - (100 - resilienceScore));
        let evidenceOutput = "";

        if (disagreement > 20) {
          await writer.write(encoder.encode(sseEvent({
            type: "phase",
            phase: "evidence",
            label: "High uncertainty detected — deploying live web intelligence...",
          })));

          const role = report.current_role || report.role_detected || "professional";
          const industry = report.industry || "technology";

          const [threatEvidence, defenseEvidence] = await Promise.all([
            tavilySearch({
              query: `${role} ${industry} AI automation job displacement 2025 2026`,
              searchDepth: "advanced", maxResults: 3, days: 90, topic: "news",
            }),
            tavilySearch({
              query: `${role} ${industry} human skills irreplaceable AI limitations 2025 2026`,
              searchDepth: "advanced", maxResults: 3, days: 90, topic: "news",
            }),
          ]);

          const allResults = [
            ...(threatEvidence?.results || []).map((r: any) => ({ ...r, side: "prosecution" })),
            ...(defenseEvidence?.results || []).map((r: any) => ({ ...r, side: "defense" })),
          ];

          for (const r of allResults) {
            await writer.write(encoder.encode(sseEvent({
              type: "evidence",
              title: r.title,
              url: r.url,
              snippet: r.content?.slice(0, 150) || "",
              score: r.score,
              side: r.side,
            })));
          }

          evidenceOutput = allResults.map(
            (r: any) => `[${r.side.toUpperCase()} EVIDENCE] ${r.title}: ${r.content?.slice(0, 200)} (${r.url})`
          ).join("\n\n");
        }

        // ═══ PHASE 3: JUDGE ═══
        await writer.write(encoder.encode(sseEvent({
          type: "phase",
          phase: "judgment",
          label: "Judge is deliberating the final verdict...",
        })));

        const judgePrompt = `You are presiding over a career viability debate for a ${roleName}.

══ CASE FILE ══
${caseFile}

══ PROSECUTION (Threat Score: ${threatScore}/100) ══
${prosecutorOutput}

══ DEFENSE (Resilience Score: ${resilienceScore}/100) ══
${defenderOutput}

${evidenceOutput ? `══ LIVE EVIDENCE COLLECTED ══\n${evidenceOutput}` : ""}

Deliver your verdict. Reference specific claims from both sides.`;

        const judgeOutput = await streamAgentResponse(
          apiKey, "Judge", JUDGE_SYSTEM, judgePrompt,
          writer, encoder, "google/gemini-3.1-pro-preview",
        );

        const finalScore = extractScore(judgeOutput, "FINAL_VERDICT_SCORE") ?? Math.round((threatScore + (100 - resilienceScore)) / 2);
        const uncertainty = judgeOutput.match(/UNCERTAINTY:\s*(LOW|MEDIUM|HIGH)/i)?.[1] || (disagreement > 20 ? "HIGH" : "MEDIUM");
        const trajectory = extractTrajectory(judgeOutput);

        // ═══ FINAL SYNTHESIS ═══
        await writer.write(encoder.encode(sseEvent({
          type: "verdict",
          threat_score: threatScore,
          resilience_score: resilienceScore,
          final_score: finalScore,
          uncertainty,
          trajectory,
          disagreement,
          evidence_triggered: disagreement > 20,
          role: roleName,
        })));

        await writer.write(encoder.encode(sseEvent({ type: "done" })));
      } catch (err) {
        console.error("[CareerGenome] Fatal error:", err);
        await writer.write(encoder.encode(sseEvent({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
