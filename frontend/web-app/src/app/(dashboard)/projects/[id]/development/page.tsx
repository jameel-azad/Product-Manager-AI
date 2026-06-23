'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { aiApi, requirementsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  Code2,
  Cpu,
  Layers,
  Smartphone,
  GitMerge,
  Play,
  RefreshCw,
  Clock,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  Timer,
  FileCode,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type EngineId = 'apix' | 'uix' | 'integrationx' | 'mobile';

interface Job {
  id: string;
  engine: EngineId | string;
  status: string;
  created_at: string;
  completed_at?: string;
  duration_ms?: number;
  result?: any;          // JSON object or string from backend
  requirement_id?: string;
  project_id?: string;
  error?: string;
}

interface Requirement {
  id: string;
  title: string;
  type?: string;
}

// ─── Engine definitions ───────────────────────────────────────────────────────

interface EngineInfo {
  id: EngineId;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradientFrom: string;
}

const ENGINES: EngineInfo[] = [
  {
    id: 'apix',
    name: 'APIx',
    description: 'Backend API & microservices generation',
    icon: <Code2 className="w-5 h-5" />,
    color: 'text-blue-400',
    gradientFrom: 'from-blue-500',
  },
  {
    id: 'uix',
    name: 'UIx',
    description: 'Frontend component & UI scaffolding',
    icon: <Layers className="w-5 h-5" />,
    color: 'text-violet-400',
    gradientFrom: 'from-violet-500',
  },
  {
    id: 'integrationx',
    name: 'IntegrationX',
    description: 'Integrate API & UI layers together',
    icon: <GitMerge className="w-5 h-5" />,
    color: 'text-emerald-400',
    gradientFrom: 'from-emerald-500',
  },
  {
    id: 'mobile',
    name: 'Mobile AI',
    description: 'iOS, Android & cross-platform mobile',
    icon: <Smartphone className="w-5 h-5" />,
    color: 'text-orange-400',
    gradientFrom: 'from-orange-500',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function durationLabel(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function formatTs(iso: string) {
  try {
    return format(new Date(iso), 'MMM d, HH:mm');
  } catch {
    return iso;
  }
}

/** Safely convert a job result (object or string) to a displayable string. */
function resultToString(result: any): string {
  if (!result) return '';
  if (typeof result === 'string') return result;
  // Prefer the code field if present (most AI jobs return {code: "..."})
  if (typeof result.code === 'string') return result.code;
  if (typeof result.generated_code === 'string') return result.generated_code;
  if (typeof result.content === 'string') return result.content;
  // Fall back to pretty-printed JSON
  return JSON.stringify(result, null, 2);
}

function resultPreview(result: any, maxLen = 80): string {
  const str = resultToString(result);
  if (!str) return '—';
  return str.slice(0, maxLen) + (str.length > maxLen ? '…' : '');
}

// ─── Engine Status Card ───────────────────────────────────────────────────────

function EngineCard({ engine, jobs }: { engine: EngineInfo; jobs: Job[] }) {
  const latestJob = jobs
    .filter((j) => j.engine === engine.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const isOnline = true; // engines are always available

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${engine.gradientFrom} to-slate-800 flex items-center justify-center ${engine.color} shadow-sm`}
        >
          {engine.icon}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}
          />
          <span className={`text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold text-white">{engine.name}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{engine.description}</p>
      {latestJob && (
        <div className="mt-3 pt-3 border-t border-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Last job</span>
            <Badge status={latestJob.status} />
          </div>
          <p className="text-[10px] text-slate-600 mt-1">{relativeTime(latestJob.created_at)}</p>
        </div>
      )}
    </div>
  );
}

// ─── Jobs Table ───────────────────────────────────────────────────────────────

function JobsTable({ jobs, onSelect }: { jobs: Job[]; onSelect: (job: Job) => void }) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500 text-sm">
        No jobs found. Trigger an AI engine below.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {['Engine', 'Status', 'Duration', 'Created', 'Preview'].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="hover:bg-slate-800/20 transition-colors cursor-pointer"
              onClick={() => onSelect(job)}
            >
              <td className="py-2.5 pr-4">
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 uppercase">
                  {job.engine}
                </span>
              </td>
              <td className="py-2.5 pr-4">
                <Badge status={job.status} />
              </td>
              <td className="py-2.5 pr-4 text-xs text-slate-400 font-mono">
                {durationLabel(job.duration_ms)}
              </td>
              <td className="py-2.5 pr-4 text-xs text-slate-500 whitespace-nowrap">
                {formatTs(job.created_at)}
              </td>
              <td className="py-2.5 max-w-[200px] truncate text-xs text-slate-500">
                {resultPreview(job.result)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Trigger Tabs ─────────────────────────────────────────────────────────────

type TriggerTabId = 'apix' | 'uix' | 'integrationx' | 'mobile';

const TRIGGER_TABS: { id: TriggerTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'apix', label: 'APIx', icon: <Code2 className="w-4 h-4" /> },
  { id: 'uix', label: 'UIx', icon: <Layers className="w-4 h-4" /> },
  { id: 'integrationx', label: 'IntegrationX', icon: <GitMerge className="w-4 h-4" /> },
  { id: 'mobile', label: 'Mobile AI', icon: <Smartphone className="w-4 h-4" /> },
];

function TriggerApix({
  projectId,
  requirements,
  onJobTriggered,
}: {
  projectId: string;
  requirements: Requirement[];
  onJobTriggered: (job: Job) => void;
}) {
  const [reqId, setReqId] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTrigger = async () => {
    if (!reqId) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await aiApi.triggerApix({
        project_id: projectId,
        requirement_id: reqId,
        payload: { context },
      });
      const job: Job = res.data?.job ?? res.data ?? { id: String(Date.now()), engine: 'apix', status: 'queued', created_at: new Date().toISOString() };
      onJobTriggered(job);
      setSuccess(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to trigger APIx.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Select Requirement</label>
        <div className="relative">
          <select
            value={reqId}
            onChange={(e) => setReqId(e.target.value)}
            className="w-full appearance-none px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors pr-8"
          >
            <option value="">— Select a requirement —</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Extra Context</label>
        <textarea
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Additional instructions, patterns to follow, constraints..."
          className="w-full px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none resize-none transition-colors"
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          APIx job triggered successfully!
        </div>
      )}
      <button
        onClick={handleTrigger}
        disabled={!reqId || loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-md shadow-blue-500/20"
      >
        {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Triggering...' : 'Trigger APIx'}
      </button>
    </div>
  );
}

function TriggerUix({
  projectId,
  requirements,
  onJobTriggered,
}: {
  projectId: string;
  requirements: Requirement[];
  onJobTriggered: (job: Job) => void;
}) {
  const [reqId, setReqId] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTrigger = async () => {
    if (!reqId) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await aiApi.triggerUix({
        project_id: projectId,
        requirement_id: reqId,
        payload: { context },
      });
      const job: Job = res.data?.job ?? res.data ?? { id: String(Date.now()), engine: 'uix', status: 'queued', created_at: new Date().toISOString() };
      onJobTriggered(job);
      setSuccess(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to trigger UIx.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Select Requirement</label>
        <div className="relative">
          <select
            value={reqId}
            onChange={(e) => setReqId(e.target.value)}
            className="w-full appearance-none px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors pr-8"
          >
            <option value="">— Select a requirement —</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Extra Context</label>
        <textarea
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Design system, component library, styling preferences..."
          className="w-full px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none resize-none transition-colors"
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          UIx job triggered successfully!
        </div>
      )}
      <button
        onClick={handleTrigger}
        disabled={!reqId || loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-md shadow-violet-500/20"
      >
        {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Triggering...' : 'Trigger UIx'}
      </button>
    </div>
  );
}

function TriggerIntegrationX({
  projectId,
  jobs,
  onJobTriggered,
}: {
  projectId: string;
  jobs: Job[];
  onJobTriggered: (job: Job) => void;
}) {
  const completedApix = jobs.filter((j) => j.engine === 'apix' && j.status === 'completed');
  const completedUix = jobs.filter((j) => j.engine === 'uix' && j.status === 'completed');
  const [apixJobId, setApixJobId] = useState('');
  const [uixJobId, setUixJobId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canTrigger = apixJobId && uixJobId;

  const handleTrigger = async () => {
    if (!canTrigger) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await aiApi.triggerIntegrationX({
        project_id: projectId,
        apix_job_id: apixJobId,
        uix_job_id: uixJobId,
      });
      const job: Job = res.data?.job ?? res.data ?? { id: String(Date.now()), engine: 'integrationx', status: 'queued', created_at: new Date().toISOString() };
      onJobTriggered(job);
      setSuccess(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to trigger IntegrationX.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
        IntegrationX requires a completed APIx job and a completed UIx job to combine both layers.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">APIx Job (completed)</label>
          <div className="relative">
            <select
              value={apixJobId}
              onChange={(e) => setApixJobId(e.target.value)}
              disabled={completedApix.length === 0}
              className="w-full appearance-none px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors pr-8 disabled:opacity-50"
            >
              <option value="">— Select APIx job —</option>
              {completedApix.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.id.slice(0, 8)} · {formatTs(j.created_at)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
          {completedApix.length === 0 && (
            <p className="text-[10px] text-amber-400 mt-1">No completed APIx jobs yet</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">UIx Job (completed)</label>
          <div className="relative">
            <select
              value={uixJobId}
              onChange={(e) => setUixJobId(e.target.value)}
              disabled={completedUix.length === 0}
              className="w-full appearance-none px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors pr-8 disabled:opacity-50"
            >
              <option value="">— Select UIx job —</option>
              {completedUix.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.id.slice(0, 8)} · {formatTs(j.created_at)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
          {completedUix.length === 0 && (
            <p className="text-[10px] text-amber-400 mt-1">No completed UIx jobs yet</p>
          )}
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          IntegrationX job triggered successfully!
        </div>
      )}
      <button
        onClick={handleTrigger}
        disabled={!canTrigger || loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-md shadow-emerald-500/20"
      >
        {loading ? <LoadingSpinner size="sm" /> : <GitMerge className="w-4 h-4" />}
        {loading ? 'Triggering...' : 'Trigger IntegrationX'}
      </button>
    </div>
  );
}

function TriggerMobile({
  projectId,
  requirements,
  onJobTriggered,
}: {
  projectId: string;
  requirements: Requirement[];
  onJobTriggered: (job: Job) => void;
}) {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'both'>('both');
  const [reqId, setReqId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTrigger = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await aiApi.triggerMobile({
        project_id: projectId,
        platform,
        requirement_id: reqId || undefined,
      });
      const job: Job = res.data?.job ?? res.data ?? { id: String(Date.now()), engine: 'mobile', status: 'queued', created_at: new Date().toISOString() };
      onJobTriggered(job);
      setSuccess(true);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to trigger Mobile AI.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Platform</label>
        <div className="grid grid-cols-3 gap-2">
          {(['ios', 'android', 'both'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all capitalize ${
                platform === p
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                  : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {p === 'ios' ? 'iOS' : p === 'android' ? 'Android' : 'Both'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Requirement (optional)</label>
        <div className="relative">
          <select
            value={reqId}
            onChange={(e) => setReqId(e.target.value)}
            className="w-full appearance-none px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors pr-8"
          >
            <option value="">— All requirements —</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Mobile AI job triggered successfully!
        </div>
      )}
      <button
        onClick={handleTrigger}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-md shadow-orange-500/20"
      >
        {loading ? <LoadingSpinner size="sm" /> : <Smartphone className="w-4 h-4" />}
        {loading ? 'Triggering...' : 'Trigger Mobile AI'}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevelopmentPage() {
  const { id } = useParams<{ id: string }>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [triggerTab, setTriggerTab] = useState<TriggerTabId>('apix');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await aiApi.listJobs(id);
      const data: Job[] = res.data?.items ?? res.data ?? [];
      setJobs(data);
      // Update selected job if it's still in list
      if (selectedJob) {
        const updated = data.find((j) => j.id === selectedJob.id);
        if (updated) setSelectedJob(updated);
      }
    } catch {
      // keep current data on error
    } finally {
      setLoadingJobs(false);
    }
  }, [id, selectedJob]);

  useEffect(() => {
    fetchJobs();
    requirementsApi
      .list(id)
      .then((res) => {
        const data: Requirement[] = res.data?.items ?? res.data ?? [];
        setRequirements(data);
      })
      .catch(() => setRequirements([]))
      .finally(() => setLoadingReqs(false));
  }, [id]);

  // Poll every 3s for running jobs
  useEffect(() => {
    pollRef.current = setInterval(() => {
      const hasRunning = jobs.some((j) =>
        ['queued', 'running', 'processing', 'in_progress'].includes(j.status)
      );
      if (hasRunning) fetchJobs();
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobs, fetchJobs]);

  const handleJobTriggered = useCallback(
    (job: Job) => {
      setJobs((prev) => [job, ...prev]);
      setSelectedJob(job);
      // kick off polling
      fetchJobs();
    },
    [fetchJobs]
  );

  const activeJobs = jobs.filter((j) =>
    ['queued', 'running', 'processing', 'in_progress'].includes(j.status)
  );
  const historyJobs = jobs.slice(0, 10);
  const latestJobWithResult = jobs.find((j) => j.result);

  const stats = {
    total: jobs.length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => ['failed', 'error'].includes(j.status)).length,
    running: activeJobs.length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-md">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            AI Code Generation
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            SDLC Phase 4 — Trigger AI engines to generate production-ready code
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchJobs}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Badge status="active" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Jobs', value: stats.total, icon: <Cpu className="w-4 h-4" />, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400' },
          { label: 'Failed', value: stats.failed, icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
          { label: 'Running', value: stats.running, icon: <Activity className="w-4 h-4 animate-pulse" />, color: 'text-amber-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[#0f172a] border border-slate-800 rounded-xl p-4"
          >
            <div className={`${s.color} mb-2`}>{s.icon}</div>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* AI Engine Status */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          AI Engine Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ENGINES.map((engine) => (
            <EngineCard key={engine.id} engine={engine} jobs={jobs} />
          ))}
        </div>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div className="bg-[#0f172a] border border-amber-500/25 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 animate-pulse" />
            Active Jobs ({activeJobs.length})
          </h3>
          <JobsTable jobs={activeJobs} onSelect={setSelectedJob} />
        </div>
      )}

      {/* Trigger Section */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Play className="w-4 h-4 text-blue-400" />
          Trigger AI Engine
        </h3>

        {/* Trigger tabs */}
        <div className="border-b border-slate-800 mb-5">
          <nav className="-mb-px flex gap-1">
            {TRIGGER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTriggerTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                  triggerTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {loadingReqs ? (
          <LoadingSpinner size="sm" label="Loading requirements..." />
        ) : (
          <>
            {triggerTab === 'apix' && (
              <TriggerApix projectId={id} requirements={requirements} onJobTriggered={handleJobTriggered} />
            )}
            {triggerTab === 'uix' && (
              <TriggerUix projectId={id} requirements={requirements} onJobTriggered={handleJobTriggered} />
            )}
            {triggerTab === 'integrationx' && (
              <TriggerIntegrationX projectId={id} jobs={jobs} onJobTriggered={handleJobTriggered} />
            )}
            {triggerTab === 'mobile' && (
              <TriggerMobile projectId={id} requirements={requirements} onJobTriggered={handleJobTriggered} />
            )}
          </>
        )}
      </div>

      {/* Job History */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Timer className="w-4 h-4 text-slate-400" />
            Job History
            <span className="text-xs text-slate-600">(last 10)</span>
          </h3>
        </div>
        {loadingJobs ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" label="Loading jobs..." />
          </div>
        ) : (
          <JobsTable jobs={historyJobs} onSelect={setSelectedJob} />
        )}
      </div>

      {/* Code Preview */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-slate-400" />
            Code Preview
            {selectedJob && (
              <span className="text-xs text-slate-500 font-mono">
                — Job {selectedJob.id.slice(0, 8)} ({selectedJob.engine})
              </span>
            )}
          </h3>
          {selectedJob && (
            <Badge status={selectedJob.status} />
          )}
        </div>

        {selectedJob?.status === 'running' || selectedJob?.status === 'queued' || selectedJob?.status === 'processing' ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" label="Waiting for code generation..." />
          </div>
        ) : (
          <div className="border border-slate-700 rounded-xl overflow-hidden" style={{ height: 400 }}>
            <MonacoEditor
              height={400}
              language="typescript"
              value={
                resultToString(selectedJob?.result) ||
                resultToString(latestJobWithResult?.result) ||
                '// Select a completed job to view generated code\n// or trigger an AI engine above'
              }
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
