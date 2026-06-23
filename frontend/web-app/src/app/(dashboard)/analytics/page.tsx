'use client';

import { useEffect, useState } from 'react';
import { projectsApi, analyticsApi } from '@/lib/api';
import { BarChart3, TrendingUp, CheckCircle, Zap, Users, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

export default function AnalyticsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [velocity, setVelocity] = useState<any>(null);
  const [sdlcProgress, setSdlcProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    projectsApi.list().then(r => {
      setProjects(r.data);
      if (r.data.length > 0) setSelectedProject(r.data[0]);
    });
    analyticsApi.getPlatformSummary().then(r => setSummary(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    Promise.all([
      analyticsApi.getKpis(selectedProject.id),
      analyticsApi.getVelocity(selectedProject.id),
      analyticsApi.getSdlcProgress(selectedProject.id),
    ]).then(([k, v, s]) => {
      setKpis(k.data);
      setVelocity(v.data);
      setSdlcProgress(s.data?.phases ?? []);
    }).finally(() => setLoading(false));
  }, [selectedProject]);

  const velocityData = velocity?.sprints ?? [
    { name: 'Sprint 1', completed_points: 28, planned_points: 35 },
    { name: 'Sprint 2', completed_points: 34, planned_points: 35 },
    { name: 'Sprint 3', completed_points: 31, planned_points: 40 },
    { name: 'Sprint 4', completed_points: 38, planned_points: 40 },
  ];

  const aiVsHumanData = [
    { name: 'Requirements', ai: 85, human: 15 },
    { name: 'Code Gen',     ai: 90, human: 10 },
    { name: 'Test Cases',   ai: 78, human: 22 },
    { name: 'Docs',         ai: 95, human: 5  },
    { name: 'Code Review',  ai: 70, human: 30 },
  ];

  const kpiCards = kpis ? [
    { label: 'Requirements', value: `${kpis.completed_requirements}/${kpis.total_requirements}`, sub: 'approved', icon: <CheckCircle className="w-5 h-5 text-green-400" />, color: 'text-green-400' },
    { label: 'Backlog Items', value: `${kpis.completed_backlog}/${kpis.total_backlog}`, sub: 'done', icon: <Target className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
    { label: 'AI Jobs', value: kpis.completed_ai_jobs, sub: 'completed', icon: <Zap className="w-5 h-5 text-purple-400" />, color: 'text-purple-400' },
    { label: 'Test Coverage', value: `${kpis.test_coverage ?? 0}%`, sub: 'coverage', icon: <TrendingUp className="w-5 h-5 text-yellow-400" />, color: 'text-yellow-400' },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics & KPIs</h1>
          <p className="text-slate-400 text-sm mt-1">Project velocity, AI productivity, and delivery metrics</p>
        </div>
      </div>

      {/* Platform summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Projects', value: summary.total_projects ?? projects.length },
            { label: 'Requirements', value: summary.total_requirements ?? '—' },
            { label: 'AI Jobs Run', value: summary.total_ai_jobs ?? '—' },
            { label: 'Deployments', value: summary.recent_deployments ?? '—' },
          ].map(s => (
            <div key={s.label} className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Project selector */}
      <div className="flex gap-2">
        {projects.map(p => (
          <button key={p.id} onClick={() => setSelectedProject(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedProject?.id === p.id ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
            {p.name}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      {kpiCards.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {kpiCards.map(k => (
            <div key={k.label} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 card-glow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-xs">{k.label}</span>
                {k.icon}
              </div>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-slate-500 text-xs mt-1">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Velocity chart */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Sprint Velocity</span>
            <span className="text-xs text-slate-500 ml-auto">story points</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={velocityData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0' }} />
              <Bar dataKey="planned_points" name="Planned" fill="#1e3a5f" radius={[4,4,0,0]} />
              <Bar dataKey="completed_points" name="Completed" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AI vs Human */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">AI vs Human Contribution</span>
            <span className="text-xs text-slate-500 ml-auto">% of output</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={aiVsHumanData} layout="vertical" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0' }} formatter={(v: any) => `${v}%`} />
              <Bar dataKey="ai" name="AI" fill="#7c3aed" radius={[0,4,4,0]} stackId="a" />
              <Bar dataKey="human" name="Human" fill="#1e3a5f" radius={[0,4,4,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-600" /><span className="text-xs text-slate-400">AI Generated</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1e3a5f]" /><span className="text-xs text-slate-400">Human Written</span></div>
          </div>
        </div>
      </div>

      {/* SDLC phase progress */}
      {sdlcProgress.length > 0 && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">SDLC Phase Progress — {selectedProject?.name}</span>
          </div>
          <div className="space-y-3">
            {sdlcProgress.map((phase: any) => (
              <div key={phase.name} className="flex items-center gap-4">
                <span className="text-xs text-slate-400 w-28 shrink-0">{phase.name}</span>
                <div className="flex-1 bg-slate-800 rounded-full h-2">
                  <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500" style={{ width: `${phase.completion_pct ?? 0}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-10 text-right">{phase.completion_pct ?? 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
