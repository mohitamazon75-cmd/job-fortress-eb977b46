/**
 * SectorPulse — Layer E render component.
 *
 * Renders 2–4 dated, cited news beats (hiring/layoff/funding) for the
 * user's sector. Slots into the space the salary block used to occupy.
 *
 * Defense-in-depth: even though the edge fn enforces a domain whitelist,
 * we re-validate every URL on render. If a beat's URL is not trusted,
 * it is silently dropped. If zero beats survive, the entire strip is
 * omitted (no "no news" filler).
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { detectFamily, applySectorTieBreaker } from "@/lib/card1-personalization";
import { getSectorDescriptor, isTrustedNewsUrl } from "@/lib/sector-classifier";

interface PulseBeat {
  headline: string;
  source_name: string;
  source_url: string;
  published_at: string;
  signal: "hiring" | "layoff" | "funding";
  company?: string;
}

interface PulseResponse {
  beats: PulseBeat[];
  window_days: number;
  fetched_at: string;
  cached: boolean;
  reason?: string;
  sector_label: string;
}

const SIGNAL_META = {
  hiring: { icon: "▲", label: "HIRING", color: "#1F7A3D" },
  funding: { icon: "◆", label: "FUNDING", color: "#1F4F8A" },
  layoff: { icon: "▼", label: "LAYOFF", color: "#B8341C" },
} as const;

function relativeDays(iso: string): string {
  const days = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export interface SectorPulseProps {
  role: string;
  city: string;
  /** Test/preview override — bypasses the network call. */
  pulseOverride?: PulseResponse;
}

export default function SectorPulse({ role, city, pulseOverride }: SectorPulseProps) {
  const sector = useMemo(() => {
    const family = applySectorTieBreaker(detectFamily(role.toLowerCase()), "");
    return getSectorDescriptor(family);
  }, [role]);

  const enabled = !pulseOverride && Boolean(sector);

  const query = useQuery({
    queryKey: ["sector-pulse", sector?.query_fragment, city],
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24h, matches edge fn cache
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sector-pulse", {
        body: { sector: sector!.query_fragment, sector_label: sector!.label, city },
      });
      if (error) throw error;
      return data as PulseResponse;
    },
  });

  // No sector → silent (founder/exec/creator/generic)
  if (!sector) return null;

  const pulse = pulseOverride ?? query.data;

  // Loading state — show a slim skeleton so users know something is coming.
  if (!pulse && query.isLoading) {
    return (
      <div data-testid="sector-pulse-loading" style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mb-ink3)", marginBottom: 10 }}>
          Sector Pulse · {sector.label} · scanning…
        </div>
        <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 16 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0", opacity: 0.5 }}>
              <div style={{ width: 70, height: 12, background: "var(--mb-rule)", borderRadius: 3 }} />
              <div style={{ flex: 1, height: 12, background: "var(--mb-rule)", borderRadius: 3 }} />
              <div style={{ width: 90, height: 12, background: "var(--mb-rule)", borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!pulse) return null;

  // Defense-in-depth: drop any beat whose URL isn't trusted, even if the
  // server already filtered. Caps at 4 visible beats, dedup by URL.
  const seen = new Set<string>();
  const safeBeats = pulse.beats.filter(b => {
    if (!isTrustedNewsUrl(b.source_url)) return false;
    let key = b.source_url;
    try { const u = new URL(b.source_url); key = `${u.hostname.replace(/^www\./, "")}${u.pathname}`.toLowerCase(); } catch { /* ignore */ }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
  if (safeBeats.length === 0) return null;

  // Compute the actual window from the oldest beat shown — keeps the label honest.
  const oldestDays = Math.max(0, ...safeBeats.map(b => Math.round((Date.now() - new Date(b.published_at).getTime()) / (1000 * 60 * 60 * 24))));
  const displayWindow = Math.min(pulse.window_days || 30, Math.max(7, oldestDays));

  return (
    <div data-testid="sector-pulse" style={{ marginBottom: 22 }}>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--mb-ink3)",
          marginBottom: 10,
        }}
      >
        Sector Pulse · {sector.label} · last {displayWindow} days
      </div>
      <div
        style={{
          background: "white",
          border: "1.5px solid var(--mb-rule)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {safeBeats.map((b, i) => {
          const meta = SIGNAL_META[b.signal];
          return (
            <a
              key={`${b.source_url}-${i}`}
              href={b.source_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="sector-pulse-beat"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                columnGap: 14,
                alignItems: "center",
                padding: "12px 16px",
                borderTop: i === 0 ? "none" : "1px solid var(--mb-rule)",
                fontFamily: "'DM Sans', sans-serif",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: meta.color,
                  whiteSpace: "nowrap",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {meta.icon} {meta.label}
              </span>
              <span style={{ fontSize: 14, color: "var(--mb-ink)", fontWeight: 600, lineHeight: 1.4 }}>
                {b.headline}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--mb-ink3)", whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace" }}>
                {b.source_name} · {relativeDays(b.published_at)}
              </span>
            </a>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: "var(--mb-ink3)",
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        News curated from trusted Indian and global business press. Click any item to read the source. We present facts only — interpretation is yours.
      </div>
    </div>
  );
}
