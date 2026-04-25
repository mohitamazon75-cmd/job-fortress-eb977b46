// Issue #12: Determinism debug view (admin-only).
//
// Surfaces the determinism_meta block we now persist into final_json_report
// so future score variance can be diagnosed without log diving:
//   - which model + temperature ran for each agent
//   - per-agent wall-clock duration
//   - pipeline-level timing & timeout state
//   - engine version + KG match count
//
// Pure read-only. Gated by AuthGuard requiredRole="admin".

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";

type AgentRun = {
  name: string;
  model: string | null;
  temperature: number | null;
  duration_ms: number;
  status: "success" | "timeout" | "failed" | "skipped";
};

type DeterminismMeta = {
  schema_version: number;
  captured_at: string;
  pipeline: {
    active_model: string;
    fast_model: string;
    global_timeout_ms: number;
    global_duration_ms: number;
    global_timed_out: boolean;
  };
  engine: {
    engine_version: string | null;
    determinism_index: number | null;
    kg_skills_matched: number | null;
    ml_used: boolean;
  };
  agents: {
    parallel_block_ms: number;
    parallel_deadline_ms: number;
    parallel_timed_out: boolean;
    runs: AgentRun[];
  };
};

type ScanRow = {
  id: string;
  created_at: string;
  scan_status: string;
  role_detected: string | null;
  determinism_index: number | null;
  final_json_report: {
    determinism_meta?: DeterminismMeta;
    _diagnostics?: Record<string, unknown>;
    prompt_versions?: Record<string, string>;
  } | null;
};

const statusVariant: Record<AgentRun["status"], "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  timeout: "destructive",
  failed: "destructive",
  skipped: "outline",
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function AdminScanDebug() {
  const { scanId } = useParams<{ scanId: string }>();
  const [scan, setScan] = useState<ScanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!scanId) return;
      setLoading(true);
      const { data, error: err } = await supabase
        .from("scans")
        .select("id,created_at,scan_status,role_detected,determinism_index,final_json_report")
        .eq("id", scanId)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else if (!data) {
        setError("Scan not found");
      } else {
        setScan(data as unknown as ScanRow);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [scanId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="h-32 w-full rounded-xl bg-muted/60 animate-pulse" />
          <div className="h-64 w-full rounded-xl bg-muted/60 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-3">
          <Link to="/admin/monitor" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" /> Back to admin
          </Link>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error || "Scan not found."}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const meta = scan.final_json_report?.determinism_meta;
  const diagnostics = scan.final_json_report?._diagnostics;
  const promptVersions = scan.final_json_report?.prompt_versions;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <Link to="/admin/monitor" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Back to admin
        </Link>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Determinism debug</h1>
          <p className="text-xs text-muted-foreground font-mono break-all">{scan.id}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Status: <span className="font-medium text-foreground">{scan.scan_status}</span></span>
            <span>·</span>
            <span>Role: <span className="font-medium text-foreground">{scan.role_detected ?? "—"}</span></span>
            <span>·</span>
            <span>DI: <span className="font-medium text-foreground">{scan.determinism_index ?? "—"}</span></span>
            <span>·</span>
            <span>Created: <span className="font-medium text-foreground">{new Date(scan.created_at).toLocaleString()}</span></span>
          </div>
        </header>

        {!meta ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No <code className="font-mono">determinism_meta</code> on this scan. It was either run before
                Issue&nbsp;#12 instrumentation shipped, or the scan failed before the meta block was attached.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pipeline + engine summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pipeline</CardTitle></CardHeader>
                <CardContent className="text-xs space-y-1.5">
                  <Row label="Active model" value={meta.pipeline.active_model} />
                  <Row label="Fast model" value={meta.pipeline.fast_model} />
                  <Row label="Global duration" value={formatMs(meta.pipeline.global_duration_ms)} />
                  <Row label="Global timeout" value={formatMs(meta.pipeline.global_timeout_ms)} />
                  <Row label="Soft timeout hit" value={meta.pipeline.global_timed_out ? "yes" : "no"} alert={meta.pipeline.global_timed_out} />
                  <Row label="Captured at" value={new Date(meta.captured_at).toLocaleString()} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Engine</CardTitle></CardHeader>
                <CardContent className="text-xs space-y-1.5">
                  <Row label="Engine version" value={meta.engine.engine_version ?? "—"} />
                  <Row label="Determinism index" value={meta.engine.determinism_index?.toString() ?? "—"} />
                  <Row label="KG skills matched" value={meta.engine.kg_skills_matched?.toString() ?? "—"} />
                  <Row label="ML used" value={meta.engine.ml_used ? "yes" : "no"} />
                  <Row label="Schema version" value={meta.schema_version.toString()} />
                </CardContent>
              </Card>
            </div>

            {/* Per-agent runs */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Agent runs</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Parallel block: {formatMs(meta.agents.parallel_block_ms)}</span>
                  <span>·</span>
                  <span>Deadline: {formatMs(meta.agents.parallel_deadline_ms)}</span>
                  {meta.agents.parallel_timed_out && (
                    <Badge variant="destructive" className="text-[10px]">timed out</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {meta.agents.runs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No agent runs recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 pr-3 font-medium">Agent</th>
                          <th className="text-left py-2 pr-3 font-medium">Model</th>
                          <th className="text-left py-2 pr-3 font-medium">Temp</th>
                          <th className="text-right py-2 pr-3 font-medium">Duration</th>
                          <th className="text-left py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meta.agents.runs.map((r, i) => (
                          <tr key={`${r.name}-${i}`} className="border-b border-border/40">
                            <td className="py-2 pr-3 font-mono">{r.name}</td>
                            <td className="py-2 pr-3 font-mono text-muted-foreground">{r.model ?? "—"}</td>
                            <td className="py-2 pr-3 font-mono text-muted-foreground">{r.temperature ?? "—"}</td>
                            <td className="py-2 pr-3 text-right font-mono">{formatMs(r.duration_ms)}</td>
                            <td className="py-2">
                              <Badge variant={statusVariant[r.status]} className="text-[10px]">{r.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Aux: prompt versions + diagnostics buckets */}
        {promptVersions && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Prompt versions</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1.5">
              {Object.entries(promptVersions).map(([k, v]) => <Row key={k} label={k} value={String(v)} />)}
            </CardContent>
          </Card>
        )}
        {diagnostics && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Diagnostics</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-muted/30 rounded-md p-3 max-h-72 overflow-auto">
                {JSON.stringify(diagnostics, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${alert ? "text-destructive font-semibold" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
