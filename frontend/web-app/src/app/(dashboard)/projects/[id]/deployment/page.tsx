'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { devopsApi } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  Rocket,
  Play,
  RotateCcw,
  Plus,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Server,
  GitBranch,
  ArrowRight,
  FileText,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────

interface Pipeline {
  id: string;
  name: string;
  trigger: string;
  stages: PipelineStage[];
  last_run_status: string;
  last_run_at?: string;
}

interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
}

interface Deployment {
  id: string;
  environment: string;
  version: string;
  status: string;
  triggered_by: string;
  created_at: string;
}

// ── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_PIPELINES: Pipeline[] = [
  {
    id: 'p1',
    name: 'xccelera-api-ci',
    trigger: 'push',
    stages: [
      { name: 'Build', status: 'success' },
      { name: 'Test', status: 'success' },
      { name: 'Scan', status: 'success' },
      { name: 'Deploy', status: 'running' },
    ],
    last_run_status: 'running',
    last_run_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'p2',
    name: 'frontend-deploy',
    trigger: 'manual',
    stages: [
      { name: 'Build', status: 'success' },
      { name: 'Test', status: 'success' },
      { name: 'Deploy Staging', status: 'success' },
      { name: 'Deploy Prod', status: 'pending' },
    ],
    last_run_status: 'success',
    last_run_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

const DEMO_DEPLOYMENTS: Deployment[] = [
  { id: 'd1', environment: 'production', version: 'v2.4.1', status: 'deployed', triggered_by: 'AI Pipeline', created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 'd2', environment: 'staging', version: 'v2.5.0-rc1', status: 'running', triggered_by: 'dev@xccelera.ai', created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { id: 'd3', environment: 'dev', version: 'v2.5.0-dev', status: 'failed', triggered_by: 'CI Bot', created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
  { id: 'd4', environment: 'staging', version: 'v2.4.0', status: 'deployed', triggered_by: 'dev@xccelera.ai', created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
];

const DEMO_CHART_DATA = [
  { week: 'Wk 1', deployments: 3 },
  { week: 'Wk 2', deployments: 7 },
  { week: 'Wk 3', deployments: 5 },
  { week: 'Wk 4', deployments: 9 },
  { week: 'Wk 5', deployments: 6 },
  { week: 'Wk 6', deployments: 11 },
  { week: 'Wk 7', deployments: 8 },
  { week: 'Wk 8', deployments: 14 },
];

// ── Stage Status Icon ──────────────────────────────────────────────────────

function StageIcon({ status }: { status: PipelineStage['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === 'running') return <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
  if (status === 'failed') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  if (status === 'skipped') return <ChevronRight className="w-3.5 h-3.5 text-slate-500" />;
  return <Clock className="w-3.5 h-3.5 text-slate-500" />;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DeploymentPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [pipelines, setPipelines] = useState<Pipeline[]>(DEMO_PIPELINES);
  const [deployments, setDeployments] = useState<Deployment[]>(DEMO_DEPLOYMENTS);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreatePipeline, setShowCreatePipeline] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);

  // Create Pipeline form
  const [newPipeline, setNewPipeline] = useState({ name: '', trigger: 'push', stages: 'Build,Test,Deploy' });

  // Deploy form
  const [deployForm, setDeployForm] = useState({ environment: 'staging', version: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plRes, depRes] = await Promise.all([
        devopsApi.listPipelines(projectId),
        devopsApi.listDeployments(projectId),
      ]);
      if (plRes.data?.length) setPipelines(plRes.data);
      if (depRes.data?.length) setDeployments(depRes.data);
    } catch {
      // use demo data
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRunPipeline = async (id: string) => {
    try {
      await devopsApi.runPipeline(id);
      fetchData();
    } catch { /* ignore */ }
  };

  const handleCreatePipeline = async () => {
    const stages = newPipeline.stages.split(',').map(s => ({ name: s.trim(), status: 'pending' as const }));
    try {
      await devopsApi.createPipeline({ project_id: projectId, name: newPipeline.name, trigger: newPipeline.trigger, stages });
      setShowCreatePipeline(false);
      setNewPipeline({ name: '', trigger: 'push', stages: 'Build,Test,Deploy' });
      fetchData();
    } catch {
      setShowCreatePipeline(false);
    }
  };

  const handleDeploy = async () => {
    try {
      await devopsApi.createDeployment({ project_id: projectId, ...deployForm });
      setShowDeploy(false);
      fetchData();
    } catch { setShowDeploy(false); }
  };

  const handleRollback = async (depId: string) => {
    try {
      await devopsApi.rollback(depId);
      setRollbackTarget(null);
      fetchData();
    } catch { setRollbackTarget(null); }
  };

  const handleGetReleaseNotes = async () => {
    setNotesLoading(true);
    setShowReleaseNotes(true);
    try {
      const res = await devopsApi.getReleaseNotes(projectId);
      setReleaseNotes(res.data?.notes ?? res.data ?? '## Release v2.5.0\n\n### New Features\n- AI-powered pipeline orchestration\n- Automated rollback on failure\n\n### Bug Fixes\n- Fixed memory leak in auth service\n- Resolved race condition in deployment queue\n\n### Breaking Changes\n- None');
    } catch {
      setReleaseNotes('## Release Notes\n\nAuto-generated release notes will appear here.');
    } finally {
      setNotesLoading(false);
    }
  };

  const ENVIRONMENTS = [
    { name: 'Development', env: 'dev', color: 'from-blue-500 to-cyan-500', status: 'active', version: 'v2.5.0-dev', lastDeploy: '5m ago' },
    { name: 'Staging', env: 'staging', color: 'from-amber-500 to-orange-500', status: 'running', version: 'v2.5.0-rc1', lastDeploy: '30m ago' },
    { name: 'Production', env: 'production', color: 'from-emerald-500 to-teal-500', status: 'deployed', version: 'v2.4.1', lastDeploy: '3h ago' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-emerald-400" />
            Deployment &amp; DevOps
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">CI/CD pipelines, deployments, and release management</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGetReleaseNotes}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            Release Notes
          </button>
          <button
            onClick={() => setShowDeploy(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-lg"
          >
            <Rocket className="w-3.5 h-3.5" />
            Deploy
          </button>
        </div>
      </div>

      {/* 1. Environments */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-slate-400" />
          Environments
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ENVIRONMENTS.map((env) => (
            <div key={env.env} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${env.color} flex items-center justify-center shadow-lg`}>
                  <Server className="w-5 h-5 text-white" />
                </div>
                <Badge status={env.status} />
              </div>
              <p className="text-sm font-semibold text-white">{env.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">Version: <span className="text-slate-200 font-mono">{env.version}</span></p>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last deploy: {env.lastDeploy}
              </p>
              {env.env === 'production' && (
                <div className="mt-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-amber-400 font-medium">Approval Gate Required</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Pipelines */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-slate-400" />
            Pipelines
          </h3>
          <button
            onClick={() => setShowCreatePipeline(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-400 border border-blue-500/30 hover:border-blue-500/60 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Pipeline
          </button>
        </div>

        {loading ? (
          <LoadingSpinner size="sm" label="Loading pipelines..." />
        ) : (
          <div className="space-y-3">
            {pipelines.map((pipeline) => (
              <div key={pipeline.id} className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white font-mono">{pipeline.name}</p>
                      <Badge status={pipeline.trigger} />
                      <Badge status={pipeline.last_run_status} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {pipeline.stages.length} stages
                      {pipeline.last_run_at && ` • Last run ${format(new Date(pipeline.last_run_at), 'MMM d, HH:mm')}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRunPipeline(pipeline.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all shrink-0"
                  >
                    <Play className="w-3 h-3" />
                    Run
                  </button>
                </div>

                {/* Pipeline stage visualization */}
                <div className="mt-3 flex items-center gap-1 flex-wrap">
                  {pipeline.stages.map((stage, i) => (
                    <div key={stage.name} className="flex items-center gap-1">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        stage.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
                        stage.status === 'running' ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' :
                        stage.status === 'failed' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                        'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        <StageIcon status={stage.status} />
                        {stage.name}
                      </div>
                      {i < pipeline.stages.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Active Deployments */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Rocket className="w-4 h-4 text-slate-400" />
          Deployments
        </h3>
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Environment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Version</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Triggered By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {deployments.map((dep) => (
                  <tr key={dep.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${
                        dep.environment === 'production' ? 'text-emerald-400 bg-emerald-500/10' :
                        dep.environment === 'staging' ? 'text-amber-400 bg-amber-500/10' :
                        'text-blue-400 bg-blue-500/10'
                      }`}>
                        {dep.environment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-300">{dep.version}</td>
                    <td className="px-4 py-3"><Badge status={dep.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{dep.triggered_by}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(dep.created_at), 'MMM d, HH:mm')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRollbackTarget(dep.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-amber-400 border border-amber-500/20 hover:border-amber-500/50 rounded bg-amber-500/5 hover:bg-amber-500/15 transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rollback
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Deployment History Chart */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          Deployment Frequency (Last 8 Weeks)
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={DEMO_CHART_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Line type="monotone" dataKey="deployments" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Approval Gates for Production */}
      <div className="bg-[#0f172a] border border-amber-500/20 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          Production Approval Gates
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { gate: 'Code Review', status: 'approved', by: 'Tech Lead', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
            { gate: 'QA Sign-off', status: 'approved', by: 'QA Team', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
            { gate: 'Product Owner', status: 'pending', by: 'Awaiting approval', icon: <Clock className="w-4 h-4 text-amber-400" /> },
          ].map((gate) => (
            <div key={gate.gate} className={`flex items-center gap-3 p-3 rounded-lg border ${gate.status === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
              {gate.icon}
              <div>
                <p className="text-xs font-medium text-slate-200">{gate.gate}</p>
                <p className="text-[10px] text-slate-500">{gate.by}</p>
              </div>
              <Badge status={gate.status} className="ml-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Create Pipeline */}
      {showCreatePipeline && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white">Create Pipeline</h3>
              <button onClick={() => setShowCreatePipeline(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Pipeline Name</label>
                <input
                  type="text"
                  value={newPipeline.name}
                  onChange={e => setNewPipeline(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. api-deploy-pipeline"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Trigger</label>
                <select
                  value={newPipeline.trigger}
                  onChange={e => setNewPipeline(p => ({ ...p, trigger: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="push">On Push</option>
                  <option value="manual">Manual</option>
                  <option value="schedule">Scheduled</option>
                  <option value="pr">On Pull Request</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Stages (comma-separated)</label>
                <input
                  type="text"
                  value={newPipeline.stages}
                  onChange={e => setNewPipeline(p => ({ ...p, stages: e.target.value }))}
                  placeholder="Build, Test, Scan, Deploy"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {newPipeline.stages && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {newPipeline.stages.split(',').map((s, i, arr) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="px-2 py-0.5 text-[10px] bg-slate-700 text-slate-300 rounded border border-slate-600">{s.trim()}</span>
                        {i < arr.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-slate-600" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreatePipeline(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreatePipeline} disabled={!newPipeline.name} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                Create Pipeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Deploy */}
      {showDeploy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white">Create Deployment</h3>
              <button onClick={() => setShowDeploy(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Environment</label>
                <select
                  value={deployForm.environment}
                  onChange={e => setDeployForm(f => ({ ...f, environment: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="dev">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Version</label>
                <input
                  type="text"
                  value={deployForm.version}
                  onChange={e => setDeployForm(f => ({ ...f, version: e.target.value }))}
                  placeholder="e.g. v2.5.0"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowDeploy(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleDeploy} disabled={!deployForm.version} className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Release Notes */}
      {showReleaseNotes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Release Notes
              </h3>
              <button onClick={() => setShowReleaseNotes(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {notesLoading ? (
                <LoadingSpinner size="md" label="Generating release notes..." />
              ) : (
                <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-slate-900 rounded-lg p-4 border border-slate-800">{releaseNotes}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Rollback */}
      {rollbackTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-amber-500/30 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Confirm Rollback</p>
                <p className="text-xs text-slate-400">This will revert to the previous version.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRollbackTarget(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => handleRollback(rollbackTarget)} className="px-4 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors">
                Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
