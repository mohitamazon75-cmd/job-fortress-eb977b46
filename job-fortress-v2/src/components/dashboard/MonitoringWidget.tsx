import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, TrendingUp, Shield, Bell, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MonitoringSummary {
  date: string;
  total_calls: number;
  total_errors: number;
  error_rate_pct: number;
  functions_active: number;
}

interface UsageStat {
  function_name: string;
  call_count: number;
  error_count: number;
  avg_latency_ms: number | null;
}

interface MonitoringAlert {
  id: string;
  alert_type: string;
  function_name: string | null;
  message: string;
  severity: string;
  created_at: string;
}

interface MonitoringData {
  summary: MonitoringSummary;
  usage_by_function: UsageStat[];
  active_alerts: MonitoringAlert[];
  recent_errors: { function_name: string; error_message: string; created_at: string }[];
  errors_by_function: Record<string, number>;
}

export default function MonitoringWidget() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('monitoring-dashboard');
      if (err) throw err;
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="text-sm text-destructive font-medium">⚠️ Monitoring unavailable: {error}</p>
        <button onClick={fetchData} className="text-xs text-primary mt-2 underline">Retry</button>
      </div>
    );
  }

  const { summary, usage_by_function, active_alerts, recent_errors } = data;
  const hasAlerts = active_alerts.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-black tracking-tight text-foreground uppercase">System Monitor</h3>
          {hasAlerts && (
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold animate-pulse">
              {active_alerts.length} ALERT{active_alerts.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        <button onClick={fetchData} className="text-muted-foreground hover:text-foreground p-1">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5">
        <StatCard label="Total Calls" value={summary.total_calls} icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Errors" value={summary.total_errors} icon={<AlertTriangle className="w-4 h-4" />} danger={summary.total_errors > 0} />
        <StatCard label="Error Rate" value={`${summary.error_rate_pct}%`} icon={<Shield className="w-4 h-4" />} danger={summary.error_rate_pct > 10} />
        <StatCard label="Active Fn" value={summary.functions_active} icon={<Activity className="w-4 h-4" />} />
      </div>

      {/* Active Alerts */}
      {hasAlerts && (
        <div className="px-4 sm:px-5 pb-3">
          <p className="text-[10px] font-bold text-destructive uppercase tracking-widest mb-2">Active Alerts</p>
          <div className="space-y-2">
            {active_alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className={`text-xs p-2.5 rounded-lg border ${
                alert.severity === 'critical' 
                  ? 'bg-destructive/10 border-destructive/30 text-destructive' 
                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
              }`}>
                <div className="flex items-start gap-2">
                  <Bell className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold uppercase text-[11px] tracking-wider">{alert.alert_type.replace('_', ' ')}</span>
                    <p className="mt-0.5">{alert.message}</p>
                    <p className="text-[10px] opacity-60 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage By Function */}
      {usage_by_function.length > 0 && (
        <div className="px-4 sm:px-5 pb-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Today's Usage</p>
          <div className="space-y-1.5">
            {usage_by_function.slice(0, 8).map(fn => {
              const errPct = fn.call_count > 0 ? Math.round((fn.error_count / fn.call_count) * 100) : 0;
              return (
                <div key={fn.function_name} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-muted/50 transition">
                  <span className="font-mono text-foreground truncate max-w-[140px]">{fn.function_name}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{fn.call_count} calls</span>
                    {fn.error_count > 0 && (
                      <span className="text-destructive font-bold">{fn.error_count} err ({errPct}%)</span>
                    )}
                    {fn.avg_latency_ms && <span>{fn.avg_latency_ms}ms</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {recent_errors.length > 0 && (
        <div className="px-4 sm:px-5 pb-5 border-t border-border pt-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Recent Errors (24h)</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {recent_errors.slice(0, 10).map((err, i) => (
              <div key={i} className="text-[11px] text-muted-foreground py-1 border-b border-border/50 last:border-0">
                <span className="font-mono text-destructive">{err.function_name}</span>
                <span className="mx-1.5">·</span>
                <span className="truncate">{err.error_message?.slice(0, 80)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAlerts && summary.total_errors === 0 && (
        <div className="px-5 pb-5 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle className="w-4 h-4 text-prophet-green" />
          All systems operational
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ label, value, icon, danger }: { label: string; value: number | string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${danger ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${danger ? 'text-destructive' : 'text-muted-foreground'}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-black ${danger ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
