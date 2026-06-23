'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Cpu,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { aiApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import AIResultViewer from './AIResultViewer';
import { clsx } from 'clsx';

// ─── Engine metadata ──────────────────────────────────────────────────────────

const ENGINE_META: Record<
  string,
  { label: string; color: string; gradient: string; description: string }
> = {
  apix: {
    label: 'APIX',
    color: 'text-blue-400',
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Backend API & service code generation',
  },
  uix: {
    label: 'UIX',
    color: 'text-violet-400',
    gradient: 'from-violet-500 to-purple-500',
    description: 'Frontend UI component scaffolding',
  },
  integrationx: {
    label: 'IntegrationX',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500 to-teal-500',
    description: 'Integration & connector generation',
  },
  mobile_ai: {
    label: 'Mobile AI',
    color: 'text-amber-400',
    gradient: 'from-amber-500 to-orange-500',
    description: 'Mobile app code generation',
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

type Engine = 'apix' | 'uix' | 'integrationx' | 'mobile_ai';
type JobStatus = 'idle' | 'loading' | 'polling' | 'done' | 'error';

interface AIJobTriggerProps {
  projectId: string;
  engine: Engine;
  label: string;
  description: string;
}

// ─── Trigger mapping ─────────────────────────────────────────────────────────

function getTriggerFn(engine: Engine) {
  switch (engine) {
    case 'apix':
      return aiApi.triggerApix;
    case 'uix':
      return aiApi.triggerUix;
    case 'integrationx':
      return aiApi.triggerIntegrationX;
    case 'mobile_ai':
      return aiApi.triggerMobile;
    default:
      return aiApi.triggerApix;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIJobTrigger({
  projectId,
  engine,
  label,
  description,
}: AIJobTriggerProps) {
  const [status, setStatus] = useState<JobStatus>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const meta = ENGINE_META[engine] ?? ENGINE_META.apix;

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollJob = useCallback(
    async (id: string) => {
      let attempts = 0;
      const MAX_ATTEMPTS = 60; // 5 minutes at 5s intervals

      setStatus('polling');

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await aiApi.getJob(id);
          const job = res.data;
          const jobStatus: string = (job?.status ?? '').toLowerCase();

          if (jobStatus === 'completed' || jobStatus === 'success' || jobStatus === 'done') {
            stopPolling();
            setResult(job);
            setStatus('done');
            setShowResult(true);
          } else if (
            jobStatus === 'failed' ||
            jobStatus === 'error' ||
            jobStatus === 'cancelled'
          ) {
            stopPolling();
            setErrorMsg(job?.error ?? job?.message ?? 'Job failed');
            setStatus('error');
          } else if (attempts >= MAX_ATTEMPTS) {
            stopPolling();
            setErrorMsg('Job timed out. Check AI jobs panel for status.');
            setStatus('error');
          }
        } catch {
          // Network error — keep polling
        }
      }, 5000);
    },
    []
  );

  const handleTrigger = async () => {
    stopPolling();
    setStatus('loading');
    setResult(null);
    setErrorMsg(null);

    try {
      const triggerFn = getTriggerFn(engine);
      const res = await triggerFn({ project_id: projectId });
      const jobData = res.data;
      const id: string = jobData?.job_id ?? jobData?.id ?? '';

      if (!id) {
        // Synchronous result (no job polling needed)
        setResult(jobData);
        setStatus('done');
        setShowResult(true);
        return;
      }

      setJobId(id);
      await pollJob(id);
    } catch (err: any) {
      setErrorMsg(getErrorMessage(err, 'Failed to trigger job'));
      setStatus('error');
    }
  };

  const isRunning = status === 'loading' || status === 'polling';

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all">
      {/* ── Engine header ── */}
      <div className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div
          className={clsx(
            'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0',
            meta.gradient
          )}
        >
          <Cpu className="w-5 h-5 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={clsx('text-sm font-semibold', meta.color)}>
              {meta.label}
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">{label}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {description || meta.description}
          </p>
          {jobId && (
            <p className="text-[10px] text-slate-600 mt-1">
              Job: <span className="font-mono text-slate-500">{jobId}</span>
            </p>
          )}
        </div>

        {/* Trigger button */}
        <button
          onClick={handleTrigger}
          disabled={isRunning}
          className={clsx(
            'shrink-0 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all',
            isRunning
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r text-white shadow-md hover:shadow-lg hover:opacity-90 border-0',
            !isRunning && `bg-gradient-to-r ${meta.gradient}`
          )}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {status === 'loading' ? 'Triggering…' : 'Running…'}
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Run
            </>
          )}
        </button>
      </div>

      {/* ── Status indicators ── */}
      {status === 'polling' && (
        <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
          <p className="text-xs text-blue-300">
            Job running… polling for results every 5 seconds.
          </p>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2 bg-red-900/20 border border-red-500/25 rounded-lg">
          <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{errorMsg}</p>
        </div>
      )}

      {status === 'done' && result && (
        <div className="border-t border-slate-800">
          {/* Result header */}
          <button
            onClick={() => setShowResult((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 transition-all"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Job completed — view result</span>
            </div>
            {showResult ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showResult && (
            <div className="px-4 pb-4">
              <AIResultViewer result={result} engine={engine} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
