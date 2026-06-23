'use client';

import { useEffect, useState } from 'react';
import { projectsApi, devopsApi } from '@/lib/api';
import { Rocket, CheckCircle, XCircle, Clock, GitBranch, RefreshCw, Play } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  success: 'text-green-400 bg-green-400/10 border-green-400/20',
  failed:  'text-red-400 bg-red-400/10 border-red-400/20',
  running: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-3.5 h-3.5" />,
  failed:  <XCircle className="w-3.5 h-3.5" />,
  running: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
  pending: <Clock className="w-3.5 h-3.5" />,
};

const ENVIRONMENTS = ['development', 'staging', 'production'];
const ENV_STYLES: Record<string, string> = {
  development: 'bg-slate-700/50 border-slate-600 text-slate-300',
  staging:     'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
  production:  'bg-green-500/10 border-green-500/20 text-green-300',
};

export default function DeploymentPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    projectsApi.list().then(r => {
      setProjects(r.data);
      if (r.data.length > 0) setSelectedProject(r.data[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    Promise.all([
      devopsApi.listDeployments(selectedProject.id),
      devopsApi.listPipelines(selectedProject.id),
    ]).then(([d, p]) => {
      setDeployments(d.data ?? []);
      setPipelines(p.data ?? []);
    }).finally(() => setLoading(false));
  }, [selectedProject]);

  const latestByEnv = ENVIRONMENTS.reduce<Record<string, any>>((acc, env) => {
    const found = deployments.filter(d => d.environment === env).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    acc[env] = found;
    return acc;
  }, {});

  const handleDeploy = async (env: string) => {
    if (!selectedProject) return;
    setDeploying(true);
    try {
      const res = await devopsApi.createDeployment({ project_id: selectedProject.id, environment: env, version: 'v1.0.0', triggered_by: 'manual' });
      setDeployments(prev => [res.data, ...prev]);
    } catch (e) { console.error(e); }
    setDeploying(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Deployment & CI/CD</h1>
          <p className="text-slate-400 text-sm mt-1">Pipeline management, deployments, and environment status</p>
        </div>
      </div>

      {/* Project selector */}
      <div className="flex gap-2">
        {projects.map(p => (
          <button key={p.id} onClick={() => setSelectedProject(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedProject?.id === p.id ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Environment cards */}
      <div className="grid grid-cols-3 gap-4">
        {ENVIRONMENTS.map(env => {
          const dep = latestByEnv[env];
          return (
            <div key={env} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border capitalize ${ENV_STYLES[env]}`}>{env}</span>
                {dep && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${STATUS_STYLES[dep.status] ?? STATUS_STYLES.pending}`}>
                    {STATUS_ICON[dep.status]} {dep.status}
                  </span>
                )}
              </div>
              {dep ? (
                <>
                  <p className="text-white font-semibold text-sm">{dep.version ?? 'latest'}</p>
                  <p className="text-slate-500 text-xs mt-1">Triggered: {dep.triggered_by}</p>
                  <p className="text-slate-600 text-xs">{new Date(dep.created_at).toLocaleDateString()}</p>
                </>
              ) : (
                <p className="text-slate-500 text-xs">No deployments yet</p>
              )}
              {env !== 'production' && (
                <button onClick={() => handleDeploy(env)} disabled={deploying}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                  <Rocket className="w-3 h-3" /> Deploy
                </button>
              )}
              {env === 'production' && (
                <button onClick={() => handleDeploy(env)} disabled={deploying}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                  <Rocket className="w-3 h-3" /> Deploy to Production
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pipelines */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">CI/CD Pipelines</span>
          <span className="ml-auto text-xs text-slate-500">{pipelines.length} configured</span>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500 text-sm text-center">Loading...</p>
        ) : pipelines.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-slate-500 text-sm mb-2">No pipelines yet.</p>
            <p className="text-slate-600 text-xs">Go to a project → Deployment to create a pipeline.</p>
          </div>
        ) : pipelines.map(pipe => (
          <div key={pipe.id} className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">{pipe.name}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {(pipe.stages ?? []).map((stage: any, i: number) => (
                  <span key={i} className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {stage.name ?? stage}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-xs text-slate-500 capitalize">{pipe.trigger}</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-lg text-xs transition-colors">
              <Play className="w-3 h-3" /> Run
            </button>
          </div>
        ))}
      </div>

      {/* Deployment history */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <Rocket className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">Deployment History</span>
        </div>
        {deployments.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm text-center">No deployments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase border-b border-slate-800">
                <th className="px-5 py-3 text-left font-medium">Version</th>
                <th className="px-4 py-3 text-left font-medium">Environment</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Triggered by</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map(d => (
                <tr key={d.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-5 py-3 text-slate-300 font-mono text-xs">{d.version ?? 'latest'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs border capitalize ${ENV_STYLES[d.environment]}`}>{d.environment}</span></td>
                  <td className="px-4 py-3"><span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded text-xs border ${STATUS_STYLES[d.status] ?? STATUS_STYLES.pending}`}>{STATUS_ICON[d.status]}{d.status}</span></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{d.triggered_by}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
