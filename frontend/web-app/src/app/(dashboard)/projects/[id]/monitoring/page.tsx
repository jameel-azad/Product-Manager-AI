'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { meeApi } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  Activity,
  AlertTriangle,
  Cpu,
  Download,
  RefreshCw,
  Zap,
  Clock,
  BarChart3,
  TrendingUp,
  Users,
  Bot,
  Shield,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────

interface Metrics {
  events_captured: number;
  ai_agent_actions: number;
  anomalies_detected: number;
  evidence_records: number;
  agents?: AgentMetric[];
}

interface AgentMetric {
  name: string;
  tasks_completed: number;
  success_rate: number;
  avg_time_ms: number;
}

interface ActivityEvent {
  id: string;
  event_type: string;
  description: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  engine?: string;
}

interface Anomaly {
  id: string;
  title: string;
  description: string;
  severity: string;
  detected_at: string;
  status: string;
}

interface Comparison {
  human_tasks_per_day: number;
  ai_tasks_per_day: number;
  human_error_rate: number;
  ai_error_rate: number;
  human_avg_time_hrs: number;
  ai_avg_time_hrs: number;
  efficiency_gain: number;
}

// ── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_METRICS: Metrics = {
  events_captured: 14872,
  ai_agent_actions: 3241,
  anomalies_detected: 7,
  evidence_records: 892,
  agents: [
    { name: 'Requirements AI', tasks_completed: 142, success_rate: 97, avg_time_ms: 1240 },
    { name: 'Code Generator', tasks_completed: 89, success_rate: 94, avg_time_ms: 3820 },
    { name: 'Test Generator', tasks_completed: 231, success_rate: 99, avg_time_ms: 960 },
    { name: 'Deploy Agent', tasks_completed: 56, success_rate: 91, avg_time_ms: 12000 },
    { name: 'MEE Monitor', tasks_completed: 14872, success_rate: 100, avg_time_ms: 12 },
  ],
};

const DEMO_ACTIVITY: ActivityEvent[] = [
  { id: '1', event_type: 'deployment', description: 'Deployment v2.4.1 pushed to production successfully', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), severity: 'info', engine: 'DevOps' },
  { id: '2', event_type: 'anomaly', description: 'Memory spike detected in auth-service pod (>85%)', timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(), severity: 'warning', engine: 'MEE' },
  { id: '3', event_type: 'ai_action', description: 'Test suite generated: 47 test cases for UserAuthModule', timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(), severity: 'info', engine: 'TestGen' },
  { id: '4', event_type: 'error', description: 'API call failure: /api/v1/users returned 503 (3 retries)', timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(), severity: 'error', engine: 'API Monitor' },
  { id: '5', event_type: 'ai_action', description: 'Requirements extracted from product_spec.pdf (32 items)', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), severity: 'info', engine: 'REQ-AI' },
  { id: '6', event_type: 'critical', description: 'Database connection pool exhausted — auto-scaling triggered', timestamp: new Date(Date.now() - 31 * 60 * 1000).toISOString(), severity: 'critical', engine: 'DB Monitor' },
  { id: '7', event_type: 'deployment', description: 'Pipeline xccelera-api:v2.5.0-rc1 started in staging', timestamp: new Date(Date.now() - 38 * 60 * 1000).toISOString(), severity: 'info', engine: 'DevOps' },
  { id: '8', event_type: 'ai_action', description: 'Sprint 12 backlog auto-generated: 23 stories created', timestamp: new Date(Date.now() - 52 * 60 * 1000).toISOString(), severity: 'info', engine: 'Planning AI' },
];

const DEMO_ANOMALIES: Anomaly[] = [
  { id: 'a1', title: 'Memory Spike in Auth Service', description: 'Pod memory usage exceeded 85% threshold for 10+ minutes', severity: 'warning', detected_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(), status: 'open' },
  { id: 'a2', title: 'Database Connection Pool Exhausted', description: 'Max connections reached; auto-scaling triggered', severity: 'critical', detected_at: new Date(Date.now() - 31 * 60 * 1000).toISOString(), status: 'resolved' },
  { id: 'a3', title: 'Elevated API Error Rate', description: '3.2% error rate detected on /api/v1/orders endpoint', severity: 'warning', detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status: 'investigating' },
];

const DEMO_COMPARISON: Comparison = {
  human_tasks_per_day: 12,
  ai_tasks_per_day: 340,
  human_error_rate: 4.2,
  ai_error_rate: 0.8,
  human_avg_time_hrs: 2.4,
  ai_avg_time_hrs: 0.05,
  efficiency_gain: 2733,
};

// ── Engine color map ───────────────────────────────────────────────────────

const ENGINE_COLORS: Record<string, string> = {
  'DevOps': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'MEE': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'TestGen': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'API Monitor': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'REQ-AI': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'DB Monitor': 'text-red-400 bg-red-500/10 border-red-500/20',
  'Planning AI': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

function severityStyles(severity: string) {
  switch (severity) {
    case 'critical': return 'border-l-red-500 bg-red-500/5';
    case 'error': return 'border-l-red-400 bg-red-500/5';
    case 'warning': return 'border-l-amber-400 bg-amber-500/5';
    default: return 'border-l-blue-400 bg-blue-500/5';
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [metrics, setMetrics] = useState<Metrics>(DEMO_METRICS);
  const [activity, setActivity] = useState<ActivityEvent[]>(DEMO_ACTIVITY);
  const [anomalies, setAnomalies] = useState<Anomaly[]>(DEMO_ANOMALIES);
  const [comparison, setComparison] = useState<Comparison>(DEMO_COMPARISON);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const [mRes, aRes, cRes] = await Promise.all([
        meeApi.getMetrics({ project_id: projectId }),
        meeApi.getAnomalies({ project_id: projectId }),
        meeApi.getComparison(projectId),
      ]);
      // Always merge onto demo defaults so missing fields never become undefined
      if (mRes.data) setMetrics((prev) => ({ ...prev, ...mRes.data }));
      if (aRes.data?.length) setAnomalies(aRes.data);
      if (cRes.data) {
        // Backend may return different field names — map onto expected shape
        const d = cRes.data as any;
        setComparison((prev) => ({
          ...prev,
          human_tasks_per_day: d.human_tasks_per_day ?? d.human_tasks ?? prev.human_tasks_per_day,
          ai_tasks_per_day:    d.ai_tasks_per_day    ?? d.ai_tasks    ?? prev.ai_tasks_per_day,
          human_error_rate:    d.human_error_rate    ?? d.human_completion_rate != null ? (100 - d.human_completion_rate * 100) : prev.human_error_rate,
          ai_error_rate:       d.ai_error_rate       ?? d.ai_completion_rate    != null ? (100 - d.ai_completion_rate    * 100) : prev.ai_error_rate,
          human_avg_time_hrs:  d.human_avg_time_hrs  ?? d.human_avg_time_hours  ?? prev.human_avg_time_hrs,
          ai_avg_time_hrs:     d.ai_avg_time_hrs     ?? d.ai_avg_time_hours     ?? prev.ai_avg_time_hrs,
          efficiency_gain:     d.efficiency_gain     ?? prev.efficiency_gain,
        }));
      }
    } catch { /* keep demo data */ }
    finally { setLoading(false); }
  }, [projectId]);

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await meeApi.getActivityFeed({ project_id: projectId, limit: 20 });
      const events = res.data?.events ?? res.data ?? [];
      if (events.length > 0) setActivity(events);
    } catch { /* keep current */ }
    finally { setFeedLoading(false); }
  }, [projectId]);

  useEffect(() => {
    fetchMetrics();
    fetchFeed();
    intervalRef.current = setInterval(() => { fetchFeed(); }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMetrics, fetchFeed]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await meeApi.getEvidence(projectId);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidence-report-${projectId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExportLoading(false); }
  };

  const METRIC_CARDS = [
    { label: 'Events Captured',    value: (metrics.events_captured    ?? 0).toLocaleString(), icon: <Eye className="w-5 h-5" />,          color: 'text-blue-400',    gradient: 'from-blue-500 to-cyan-500' },
    { label: 'AI Agent Actions',   value: (metrics.ai_agent_actions   ?? 0).toLocaleString(), icon: <Bot className="w-5 h-5" />,          color: 'text-violet-400',  gradient: 'from-violet-500 to-purple-500' },
    { label: 'Anomalies Detected', value: (metrics.anomalies_detected ?? 0),                  icon: <AlertTriangle className="w-5 h-5" />, color: 'text-amber-400',   gradient: 'from-amber-500 to-orange-500' },
    { label: 'Evidence Records',   value: (metrics.evidence_records   ?? 0).toLocaleString(), icon: <Shield className="w-5 h-5" />,        color: 'text-emerald-400', gradient: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Monitoring &amp; Evidence Engine
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Real-time AI observability and evidence capture</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Live</span>
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all disabled:opacity-60"
          >
            {exportLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export Evidence
          </button>
        </div>
      </div>

      {/* 1. Header Metrics */}
      {loading ? (
        <LoadingSpinner size="md" label="Loading metrics..." />
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {METRIC_CARDS.map((card) => (
            <div key={card.label} className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white shadow-md`}>
                  {card.icon}
                </div>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500/50" />
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Live Activity Feed */}
        <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              Live Activity Feed
              <span className="text-[10px] text-slate-500 font-normal">(auto-refresh 5s)</span>
            </h3>
            {feedLoading && <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {activity.map((event) => (
              <div
                key={event.id}
                className={`flex items-start gap-3 p-3 rounded-lg border-l-2 border border-slate-800/60 transition-all ${severityStyles(event.severity)}`}
              >
                {/* Engine icon */}
                <div className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold border ${ENGINE_COLORS[event.engine ?? ''] ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                  <Cpu className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    {event.engine && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${ENGINE_COLORS[event.engine] ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                        {event.engine}
                      </span>
                    )}
                    <Badge status={event.event_type} />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{event.description}</p>
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {relativeTime(event.timestamp)}
                    {event.severity === 'critical' && (
                      <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse font-semibold">CRITICAL</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* 4. Anomaly Alerts */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Anomaly Alerts
            </h3>
            <div className="space-y-2">
              {anomalies.map((anomaly) => (
                <div key={anomaly.id} className={`p-3 rounded-lg border ${
                  anomaly.severity === 'critical' ? 'bg-red-500/5 border-red-500/20' :
                  'bg-amber-500/5 border-amber-500/20'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-slate-200 truncate">{anomaly.title}</p>
                    <Badge status={anomaly.status} />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{anomaly.description}</p>
                  <p className="text-[10px] text-slate-600 mt-1">{relativeTime(anomaly.detected_at)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Human vs AI Comparison */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-violet-400" />
              Human vs AI
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Tasks / Day', human: comparison.human_tasks_per_day ?? 0,              ai: comparison.ai_tasks_per_day ?? 0 },
                { label: 'Error Rate',  human: `${comparison.human_error_rate ?? 0}%`,            ai: `${comparison.ai_error_rate ?? 0}%` },
                { label: 'Avg Time',    human: `${comparison.human_avg_time_hrs ?? 0}h`,          ai: `${comparison.ai_avg_time_hrs ?? 0}h` },
              ].map((row) => (
                <div key={row.label}>
                  <p className="text-[10px] text-slate-500 mb-1">{row.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-300">{row.human}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Bot className="w-3 h-3 text-blue-400" />
                      <span className="text-xs text-blue-300">{row.ai}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-center">
                <p className="text-[10px] text-slate-400">Efficiency Gain</p>
                <p className="text-xl font-bold text-emerald-400">{(comparison.efficiency_gain ?? 0).toLocaleString()}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Agent Performance Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            Agent Performance
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400">Agent</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400">Tasks Completed</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 min-w-[180px]">Success Rate</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400">Avg Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {(metrics.agents ?? DEMO_METRICS.agents!).map((agent) => (
                <tr key={agent.name} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <span className="text-xs font-medium text-slate-200">{agent.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-300">{(agent.tasks_completed ?? 0).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${agent.success_rate >= 95 ? 'bg-emerald-500' : agent.success_rate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${agent.success_rate}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300 w-8 shrink-0">{agent.success_rate}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {agent.avg_time_ms >= 1000 ? `${(agent.avg_time_ms / 1000).toFixed(1)}s` : `${agent.avg_time_ms}ms`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
