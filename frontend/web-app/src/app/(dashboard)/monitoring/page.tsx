'use client';

import { useEffect, useState } from 'react';
import { meeApi } from '@/lib/api';
import { Activity, ShieldCheck, AlertTriangle, Zap, TrendingUp, RefreshCw } from 'lucide-react';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-500/5',
  error:    'border-l-red-400 bg-red-400/5',
  warning:  'border-l-yellow-500 bg-yellow-500/5',
  info:     'border-l-blue-500 bg-blue-500/5',
};
const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500 animate-pulse',
  error:    'bg-red-400',
  warning:  'bg-yellow-400',
  info:     'bg-blue-400',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function MonitoringPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    try {
      const [evRes, mRes, aRes] = await Promise.all([
        meeApi.getActivityFeed({ limit: 30 }),
        meeApi.getMetrics(),
        meeApi.getAnomalies(),
      ]);
      setEvents(evRes.data.events ?? []);
      setMetrics(mRes.data);
      setAnomalies(aRes.data ?? []);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 8000); return () => clearInterval(t); }, []);

  const statCards = [
    { label: 'Events Captured', value: metrics?.total_events_captured ?? events.length, icon: <Activity className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
    { label: 'AI Agent Actions', value: metrics?.agent_actions ?? (events.filter((e: any) => e.engine).length), icon: <Zap className="w-5 h-5 text-purple-400" />, color: 'text-purple-400' },
    { label: 'Anomalies Detected', value: anomalies.length, icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />, color: 'text-yellow-400' },
    { label: 'Evidence Records', value: metrics?.evidence_records ?? events.length, icon: <ShieldCheck className="w-5 h-5 text-green-400" />, color: 'text-green-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoring & Evidence Engine</h1>
          <p className="text-slate-400 text-sm mt-1">Immutable audit trail — every AI and human action recorded</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 card-glow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-medium">{s.label}</span>
              {s.icon}
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Activity feed */}
        <div className="col-span-2 bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Live Activity Feed</span>
            <span className="ml-auto text-xs text-slate-500">{events.length} events</span>
          </div>
          <div className="divide-y divide-slate-800/60 max-h-[480px] overflow-y-auto">
            {loading ? (
              <p className="p-6 text-slate-500 text-sm text-center">Loading events...</p>
            ) : events.length === 0 ? (
              <p className="p-6 text-slate-500 text-sm text-center">No events yet.</p>
            ) : events.map((ev: any) => (
              <div key={ev.id} className={`px-5 py-3.5 border-l-2 ${SEVERITY_STYLES[ev.severity] ?? SEVERITY_STYLES.info}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[ev.severity] ?? 'bg-blue-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-300 capitalize">{ev.event_type?.replace(/_/g, ' ')}</span>
                      {ev.engine && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{ev.engine}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                        ev.severity === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                        ev.severity === 'warning'  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                        'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>{ev.severity}</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{ev.description}</p>
                  </div>
                  <span className="text-slate-600 text-xs shrink-0">{timeAgo(ev.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomalies */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Anomaly Alerts</span>
          </div>
          <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
            {anomalies.length === 0 ? (
              <div className="text-center py-8">
                <ShieldCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 text-sm font-medium">No anomalies</p>
                <p className="text-slate-500 text-xs mt-1">All systems normal</p>
              </div>
            ) : anomalies.map((a: any) => (
              <div key={a.id} className="p-3 bg-slate-900/60 border border-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${a.severity === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-yellow-400'}`} />
                  <span className="text-xs font-semibold text-slate-200 capitalize">{a.event_type?.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{a.description}</p>
                <p className="text-xs text-slate-600 mt-1.5">{timeAgo(a.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MEE info banner */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-5 flex items-center gap-4">
        <ShieldCheck className="w-8 h-8 text-blue-400 shrink-0" />
        <div>
          <p className="text-white font-semibold text-sm">Tamper-proof Evidence Trail</p>
          <p className="text-slate-400 text-xs mt-0.5">Every AI agent action is immutably logged — hot storage for 1 year, cold storage for 7 years. SOC 2 Type II & ISO 27001 compliant.</p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-2xl font-bold text-white">{events.length}</p>
          <p className="text-slate-500 text-xs">records</p>
        </div>
      </div>
    </div>
  );
}
