import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, TrendingUp, Shield, Bell, CheckCircle,
  RefreshCw, Users, Zap, DollarSign, BarChart3, Clock, LogOut,
  Brain, CheckCircle2, XCircle, ArrowDownRight, Filter, ThumbsUp, ThumbsDown,
  Coins, ArrowUpRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdminData {
  summary: {
    date: string;
    total_calls: number;
    total_errors: number;
    error_rate_pct: number;
    functions_active: number;
    total_users: number;
    total_scans: number;
    scans_7d: number;
    estimated_cost_usd_today: number;
    llm_calls_today: number;
  };
  usage_by_function: {
    function_name: string;
    call_count: number;
    error_count: number;
    avg_latency_ms: number | null;
  }[];
  active_alerts: {
    id: string;
    alert_type: string;
    function_name: string | null;
    message: string;
    severity: string;
    created_at: string;
  }[];
  recent_errors: { function_name: string; error_message: string; created_at: string }[];
  scans_by_status: Record<string, number>;
  recent_scans: { id: string; scan_status: string; created_at: string; industry: string; role_detected: string; user_id: string }[];
  recent_users: { id: string; email: string; display_name: string; created_at: string }[];
  agent1_quality: {
    total: number;
    success: number;
    timeouts: number;
    success_rate_pct: number;
    fallback_rate_pct: number;
    avg_skills_extracted: number;
    recent: {
      status: string;
      role: string;
      seniority: string;
      skills: number;
      fallbacks: string[];
      job_family: string;
      created_at: string;
    }[];
  };
  funnel?: {
    stages: { stage: string; count: number }[];
    micro_feedback: Record<string, { up: number; down: number }>;
    total_events_7d: number;
  };
  token_costs?: {
    total_actual_7d: number;
    total_estimated_7d: number;
    overall_variance_pct: number;
    by_function: {
      function_name: string;
      calls_7d: number;
      actual_total_cost: number;
      actual_per_call: number;
      estimated_per_call: number;
      variance_pct: number;
      total_tokens: number;
      top_model: string;
    }[];
    total_token_calls_7d: number;
  };
  role_source_distribution?: {
    total: number;
    window_hours: number;
    counts: Record<string, number>;
    pct: {
      headline: number;
      "experience[0]": number;
      affinda: number;
      regex: number;
      NONE: number;
    };
    health: 'healthy' | 'watch' | 'degraded';
  };
  profile_confidence_distribution?: {
    total: number;
    window_hours: number;
    counts: Record<string, number>;
    pct: { high: number; medium: number; low: number };
    health: 'healthy' | 'watch' | 'degraded';
  };
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'costs' | 'users' | 'scans' | 'errors' | 'funnel'>('overview');
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Role check: verify user is admin before rendering any admin UI
  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) {
          navigate('/');
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from('user_roles' as any)
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (profileErr || !profile) {
          navigate('/');
          return;
        }

        if ((profile as any).role !== 'admin') {
          navigate('/');
          return;
        }

        setIsAdmin(true);
      } catch (e) {
        navigate('/');
      }
    };

    checkAdminRole();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // P0 FIX: Use getUser() for server-validated auth, then getSession() only for the token
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) { navigate('/auth'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/auth'); return; }

      const { data: result, error: err } = await supabase.functions.invoke('admin-dashboard', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (err) throw err;
      // Silently redirect non-admins — don't confirm the route exists or show partial UI
      if (result?.error === 'Forbidden') { navigate('/'); return; }
      if (result?.error) throw new Error(result.error);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Admin Access Required</h1>
          <p className="text-sm text-muted-foreground">{error || 'Unable to load dashboard'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Retry</button>
            <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg border border-border text-sm font-medium">Back to App</button>
          </div>
        </div>
      </div>
    );
  }

  const { summary } = data;
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'costs' as const, label: 'Costs', icon: Coins },
    { id: 'funnel' as const, label: 'Funnel', icon: Filter },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'scans' as const, label: 'Scans', icon: Zap },
    { id: 'errors' as const, label: 'Errors', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">JOB BACHAO ADMIN</h1>
              <p className="text-[10px] text-muted-foreground">{summary.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Stats — always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Users" value={summary.total_users} icon={<Users className="w-4 h-4" />} />
          <StatCard label="Total Scans" value={summary.total_scans} icon={<Zap className="w-4 h-4" />} />
          <StatCard label="Scans (7d)" value={summary.scans_7d} icon={<TrendingUp className="w-4 h-4" />} />
          <StatCard label="API Calls Today" value={summary.total_calls} icon={<Activity className="w-4 h-4" />} />
          <StatCard label="Est. Cost Today" value={`$${summary.estimated_cost_usd_today}`} icon={<DollarSign className="w-4 h-4" />} accent />
          <StatCard label="Error Rate" value={`${summary.error_rate_pct}%`} icon={<AlertTriangle className="w-4 h-4" />} danger={summary.error_rate_pct > 10} />
        </div>

        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'costs' && <CostsTab data={data} />}
        {activeTab === 'funnel' && <FunnelTab data={data} />}
        {activeTab === 'users' && <UsersTab data={data} />}
        {activeTab === 'scans' && <ScansTab data={data} />}
        {activeTab === 'errors' && <ErrorsTab data={data} />}
      </main>
    </div>
  );
}

// ─── Stat Card ───
function StatCard({ label, value, icon, danger, accent }: { label: string; value: number | string; icon: React.ReactNode; danger?: boolean; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${danger ? 'border-destructive/30 bg-destructive/5' : accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${danger ? 'text-destructive' : accent ? 'text-primary' : 'text-muted-foreground'}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-black ${danger ? 'text-destructive' : accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ data }: { data: AdminData }) {
  const { usage_by_function, active_alerts, summary, agent1_quality: a1, role_source_distribution: rsd, profile_confidence_distribution: pcd } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Role Source Distribution — Gemini-quality health (last 24h) */}
      {rsd && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Filter className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Role Source Distribution (last 24h)</h3>
            <span className="text-[10px] text-muted-foreground">{rsd.total} scans</span>
            <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              rsd.health === 'healthy' ? 'bg-green-500/10 text-green-600' :
              rsd.health === 'watch' ? 'bg-yellow-500/10 text-yellow-600' :
              'bg-destructive/10 text-destructive'
            }`}>
              {rsd.health === 'healthy' ? 'Healthy' : rsd.health === 'watch' ? 'Watch' : 'Degraded'}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-4">
            Which extraction tier produced each role title. Healthy: regex &lt; 5% (pure safety net). Watch: 5–20%. Degraded: regex &gt; 20% — Gemini-quality regression to investigate.
          </p>

          {rsd.total === 0 ? (
            <div className="text-xs text-muted-foreground italic">No resume scans in the last 24h.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-lg p-3 border border-green-500/30 bg-green-500/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Headline</p>
                <p className="text-2xl font-black text-green-600">{rsd.pct.headline}%</p>
                <p className="text-[10px] text-muted-foreground">{rsd.counts.headline} scans · Gemini ✓</p>
              </div>
              <div className="rounded-lg p-3 border border-green-500/30 bg-green-500/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Experience[0]</p>
                <p className="text-2xl font-black text-green-600">{rsd.pct['experience[0]']}%</p>
                <p className="text-[10px] text-muted-foreground">{rsd.counts['experience[0]']} scans · Gemini ✓</p>
              </div>
              <div className="rounded-lg p-3 border border-yellow-500/30 bg-yellow-500/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Affinda</p>
                <p className="text-2xl font-black text-yellow-600">{rsd.pct.affinda}%</p>
                <p className="text-[10px] text-muted-foreground">{rsd.counts.affinda} scans · structured fallback</p>
              </div>
              <div className={`rounded-lg p-3 border ${
                rsd.pct.regex < 5 ? 'border-green-500/30 bg-green-500/5' :
                rsd.pct.regex <= 20 ? 'border-yellow-500/30 bg-yellow-500/5' :
                'border-destructive/30 bg-destructive/5'
              }`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Regex</p>
                <p className={`text-2xl font-black ${
                  rsd.pct.regex < 5 ? 'text-green-600' :
                  rsd.pct.regex <= 20 ? 'text-yellow-600' :
                  'text-destructive'
                }`}>{rsd.pct.regex}%</p>
                <p className="text-[10px] text-muted-foreground">{rsd.counts.regex} scans · safety net</p>
              </div>
              <div className={`rounded-lg p-3 border ${rsd.counts.NONE === 0 ? 'border-border bg-muted/30' : 'border-destructive/30 bg-destructive/5'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">None</p>
                <p className={`text-2xl font-black ${rsd.counts.NONE === 0 ? 'text-foreground' : 'text-destructive'}`}>{rsd.pct.NONE}%</p>
                <p className="text-[10px] text-muted-foreground">{rsd.counts.NONE} scans · failed</p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Agent1 Profiler Quality — top priority widget */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Agent1 Profiler Quality (7d)</h3>
          <span className="text-[10px] text-muted-foreground">{a1.total} scans</span>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className={`rounded-lg p-3 border ${a1.success_rate_pct >= 90 ? 'border-green-500/30 bg-green-500/5' : a1.success_rate_pct >= 70 ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Success Rate</p>
            <p className={`text-2xl font-black ${a1.success_rate_pct >= 90 ? 'text-green-600' : a1.success_rate_pct >= 70 ? 'text-yellow-600' : 'text-destructive'}`}>
              {a1.success_rate_pct}%
            </p>
            <p className="text-[10px] text-muted-foreground">{a1.success} / {a1.total}</p>
          </div>
          <div className={`rounded-lg p-3 border ${a1.timeouts === 0 ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Timeouts</p>
            <p className={`text-2xl font-black ${a1.timeouts === 0 ? 'text-green-600' : 'text-destructive'}`}>{a1.timeouts}</p>
            <p className="text-[10px] text-muted-foreground">Failed extractions</p>
          </div>
          <div className={`rounded-lg p-3 border ${a1.fallback_rate_pct === 0 ? 'border-green-500/30 bg-green-500/5' : a1.fallback_rate_pct <= 20 ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fallback Rate</p>
            <p className={`text-2xl font-black ${a1.fallback_rate_pct === 0 ? 'text-green-600' : a1.fallback_rate_pct <= 20 ? 'text-yellow-600' : 'text-destructive'}`}>
              {a1.fallback_rate_pct}%
            </p>
            <p className="text-[10px] text-muted-foreground">Generic skills used</p>
          </div>
          <div className="rounded-lg p-3 border border-border bg-muted/30">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg Skills</p>
            <p className="text-2xl font-black text-foreground">{a1.avg_skills_extracted}</p>
            <p className="text-[10px] text-muted-foreground">Per extraction</p>
          </div>
        </div>

        {/* Recent entries table */}
        {a1.recent.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-1.5 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-3 py-1.5 font-bold text-muted-foreground uppercase tracking-wider">Role Detected</th>
                  <th className="text-left px-3 py-1.5 font-bold text-muted-foreground uppercase tracking-wider">Seniority</th>
                  <th className="text-left px-3 py-1.5 font-bold text-muted-foreground uppercase tracking-wider">Skills</th>
                  <th className="text-left px-3 py-1.5 font-bold text-muted-foreground uppercase tracking-wider">Fallbacks</th>
                  <th className="text-left px-3 py-1.5 font-bold text-muted-foreground uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody>
                {a1.recent.map((entry, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition">
                    <td className="px-3 py-2">
                      {entry.status === 'success'
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                    </td>
                    <td className="px-3 py-2 text-foreground truncate max-w-[200px]">{entry.role}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        entry.seniority === 'EXECUTIVE' ? 'bg-primary/10 text-primary' :
                        entry.seniority === 'SENIOR_LEADER' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-muted text-muted-foreground'
                      }`}>{entry.seniority}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-foreground">{entry.skills}</td>
                    <td className="px-3 py-2">
                      {entry.fallbacks.length === 0
                        ? <span className="text-green-600 text-[10px]">None</span>
                        : <span className="text-destructive text-[10px] font-mono">{entry.fallbacks.join(', ')}</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* LLM Cost Breakdown */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">LLM Cost Estimate</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-2xl font-black text-primary">${summary.estimated_cost_usd_today}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Today's spend</p>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground">{summary.llm_calls_today}</p>
            <p className="text-[10px] text-muted-foreground uppercase">LLM calls</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">Estimated at ~$0.15/scan avg across reasoning + inference models. Actual costs may vary.</p>
      </motion.div>

      {/* Function Usage */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Function Usage Today</h3>
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {usage_by_function.length === 0 && <p className="text-xs text-muted-foreground">No calls today</p>}
          {usage_by_function.map(fn => {
            const errPct = fn.call_count > 0 ? Math.round((fn.error_count / fn.call_count) * 100) : 0;
            return (
              <div key={fn.function_name} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-muted/50 transition">
                <span className="font-mono text-foreground truncate max-w-[160px]">{fn.function_name}</span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{fn.call_count} calls</span>
                  {fn.error_count > 0 && <span className="text-destructive font-bold">{fn.error_count} err ({errPct}%)</span>}
                  {fn.avg_latency_ms && <span>{fn.avg_latency_ms}ms</span>}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Active Alerts */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Active Alerts</h3>
          {active_alerts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
              {active_alerts.length}
            </span>
          )}
        </div>
        {active_alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-green-500" />
            All systems operational
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {active_alerts.map(alert => (
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
        )}
      </motion.div>
    </div>
  );
}

// ─── Users Tab ───
function UsersTab({ data }: { data: AdminData }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Recent Users ({data.summary.total_users} total)</h3>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Joined</th>
            </tr>
          </thead>
          <tbody>
            {data.recent_users.map(user => (
              <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition">
                <td className="px-4 py-2.5 font-mono text-foreground">{user.email || '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{user.display_name || '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {data.recent_users.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No users yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ─── Scans Tab ───
function ScansTab({ data }: { data: AdminData }) {
  return (
    <div className="space-y-6">
      {/* Status Breakdown */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">Scan Status (7d)</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.scans_by_status).map(([status, count]) => (
            <div key={status} className={`px-3 py-2 rounded-lg border text-xs font-mono ${
              status === 'complete' ? 'border-green-500/30 bg-green-500/5 text-green-600' :
              status === 'failed' ? 'border-destructive/30 bg-destructive/5 text-destructive' :
              'border-border bg-muted/30 text-muted-foreground'
            }`}>
              <span className="font-bold">{count}</span> {status}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Scans Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Recent Scans</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Industry</th>
                <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_scans.map(scan => (
                <tr key={scan.id} className="border-b border-border/50 hover:bg-muted/30 transition">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{scan.id.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      scan.scan_status === 'complete' ? 'bg-green-500/10 text-green-600' :
                      scan.scan_status === 'failed' ? 'bg-destructive/10 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }`}>{scan.scan_status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{scan.industry || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[150px]">{scan.role_detected || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(scan.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Errors Tab ───
function ErrorsTab({ data }: { data: AdminData }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Recent Errors (24h)</h3>
          <span className="text-[10px] text-muted-foreground">{data.recent_errors.length} entries</span>
        </div>
      </div>
      <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
        {data.recent_errors.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            No errors in the last 24 hours
          </div>
        )}
        {data.recent_errors.map((err, i) => (
          <div key={i} className="px-4 py-3 text-xs hover:bg-muted/30 transition">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-bold text-destructive">{err.function_name}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(err.created_at).toLocaleString()}</span>
            </div>
            <p className="text-muted-foreground break-words">{err.error_message?.slice(0, 200)}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Costs Tab ───
function CostsTab({ data }: { data: AdminData }) {
  const tc = data.token_costs;
  if (!tc) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No token usage data recorded yet. Costs will appear after AI calls are made.
      </div>
    );
  }

  const varianceColor = (v: number) =>
    v <= -20 ? 'text-green-600' : v <= 10 ? 'text-foreground' : v <= 30 ? 'text-yellow-600' : 'text-destructive';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 border border-primary/30 bg-primary/5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Actual Cost (7d)</p>
          <p className="text-2xl font-black text-primary">${tc.total_actual_7d.toFixed(2)}</p>
        </div>
        <div className="rounded-xl p-4 border border-border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estimated Cost (7d)</p>
          <p className="text-2xl font-black text-foreground">${tc.total_estimated_7d.toFixed(2)}</p>
        </div>
        <div className={`rounded-xl p-4 border ${tc.overall_variance_pct > 20 ? 'border-destructive/30 bg-destructive/5' : tc.overall_variance_pct < -10 ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-card'}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Variance</p>
          <p className={`text-2xl font-black ${varianceColor(tc.overall_variance_pct)}`}>
            {tc.overall_variance_pct > 0 ? '+' : ''}{tc.overall_variance_pct}%
          </p>
          <p className="text-[10px] text-muted-foreground">{tc.overall_variance_pct > 0 ? 'Over budget' : 'Under budget'}</p>
        </div>
        <div className="rounded-xl p-4 border border-border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tracked Calls</p>
          <p className="text-2xl font-black text-foreground">{tc.total_token_calls_7d}</p>
          <p className="text-[10px] text-muted-foreground">Last 7 days</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Actual vs Estimated Cost by Function (7d)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Function</th>
                <th className="text-right px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Calls</th>
                <th className="text-right px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Actual $/call</th>
                <th className="text-right px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Est $/call</th>
                <th className="text-right px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Variance</th>
                <th className="text-right px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Total Actual</th>
                <th className="text-right px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Tokens</th>
                <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider">Top Model</th>
              </tr>
            </thead>
            <tbody>
              {tc.by_function.map(fn => (
                <tr key={fn.function_name} className="border-b border-border/50 hover:bg-muted/30 transition">
                  <td className="px-4 py-2.5 font-mono text-foreground">{fn.function_name}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{fn.calls_7d}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">${fn.actual_per_call.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">${fn.estimated_per_call.toFixed(2)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${varianceColor(fn.variance_pct)}`}>
                    <span className="inline-flex items-center gap-0.5">
                      {fn.variance_pct > 0 ? <ArrowUpRight className="w-3 h-3" /> : fn.variance_pct < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
                      {fn.variance_pct > 0 ? '+' : ''}{fn.variance_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-primary font-bold">${fn.actual_total_cost.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{fn.total_tokens.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[140px]">{fn.top_model.replace('google/', '').replace('openai/', '')}</td>
                </tr>
              ))}
              {tc.by_function.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No token data recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {tc.by_function.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">Cost Distribution (Actual vs Estimated)</h3>
          <div className="space-y-3">
            {tc.by_function.slice(0, 12).map((fn, i) => {
              const maxCost = Math.max(...tc.by_function.slice(0, 12).map(f => Math.max(f.actual_total_cost, f.estimated_per_call * f.calls_7d)));
              const actualWidth = maxCost > 0 ? (fn.actual_total_cost / maxCost) * 100 : 0;
              const estTotal = fn.estimated_per_call * fn.calls_7d;
              const estWidth = maxCost > 0 ? (estTotal / maxCost) * 100 : 0;
              return (
                <div key={fn.function_name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-foreground truncate max-w-[180px]">{fn.function_name}</span>
                    <span className="text-[10px] text-muted-foreground">${fn.actual_total_cost.toFixed(2)} actual / ${estTotal.toFixed(2)} est</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${actualWidth}%` }}
                        transition={{ duration: 0.5, delay: i * 0.03 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${estWidth}%` }}
                        transition={{ duration: 0.5, delay: i * 0.03 }}
                        className="h-full rounded-full bg-muted-foreground/30"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full bg-primary inline-block" /> Actual</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-muted-foreground/30 inline-block" /> Estimated</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Funnel Tab ───
function FunnelTab({ data }: { data: AdminData }) {
  const funnel = data.funnel;
  if (!funnel) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No funnel data available yet. Events will appear as users interact with the app.
      </div>
    );
  }

  const maxCount = Math.max(...funnel.stages.map(s => s.count), 1);
  const feedbackCards = Object.entries(funnel.micro_feedback);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Funnel Visualization */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Conversion Funnel (7d)</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{funnel.total_events_7d} total events</span>
        </div>
        <div className="space-y-2 mt-4">
          {funnel.stages.map((stage, i) => {
            const prevCount = i > 0 ? funnel.stages[i - 1].count : stage.count;
            const dropOff = prevCount > 0 ? Math.round(((prevCount - stage.count) / prevCount) * 100) : 0;
            const barWidth = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
            return (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 text-right truncate">{stage.stage}</span>
                <div className="flex-1 h-7 bg-muted/30 rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="h-full rounded-lg"
                    style={{ background: `hsl(var(--primary) / ${1 - i * 0.08})` }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-primary-foreground mix-blend-difference">
                    {stage.count}
                  </span>
                </div>
                {i > 0 && dropOff > 0 && (
                  <span className="text-[10px] font-bold text-destructive w-14 text-right flex items-center gap-0.5">
                    <ArrowDownRight className="w-3 h-3" />
                    {dropOff}%
                  </span>
                )}
                {i === 0 && <span className="w-14" />}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Micro-feedback Summary */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <ThumbsUp className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Micro-Feedback by Card (7d)</h3>
        </div>
        {feedbackCards.length === 0 ? (
          <p className="text-xs text-muted-foreground">No micro-feedback collected yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {feedbackCards.map(([cardId, stats]) => {
              const total = stats.up + stats.down;
              const satisfaction = total > 0 ? Math.round((stats.up / total) * 100) : 0;
              return (
                <div key={cardId} className="rounded-lg border border-border p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{cardId.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-primary">
                      <ThumbsUp className="w-3 h-3" />
                      <span className="text-sm font-bold">{stats.up}</span>
                    </div>
                    <div className="flex items-center gap-1 text-destructive">
                      <ThumbsDown className="w-3 h-3" />
                      <span className="text-sm font-bold">{stats.down}</span>
                    </div>
                    <span className={`ml-auto text-xs font-bold ${satisfaction >= 70 ? 'text-green-600' : satisfaction >= 50 ? 'text-yellow-600' : 'text-destructive'}`}>
                      {satisfaction}% positive
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
