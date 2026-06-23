import {
  Code2,
  Layout,
  Link,
  Smartphone,
  Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import Badge from './Badge';
import type { AIJob, AIEngine } from '@/types';

interface AIJobCardProps {
  job: Pick<AIJob, 'id' | 'engine' | 'status' | 'created_at'> & {
    result?: unknown;
  };
}

const ENGINE_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  apix: {
    label: 'APIx',
    icon: <Code2 className="w-4 h-4" />,
    color: 'bg-blue-500/15 text-blue-400',
  },
  uix: {
    label: 'UIx',
    icon: <Layout className="w-4 h-4" />,
    color: 'bg-purple-500/15 text-purple-400',
  },
  integrationx: {
    label: 'IntegrationX',
    icon: <Link className="w-4 h-4" />,
    color: 'bg-emerald-500/15 text-emerald-400',
  },
  mobile_ai: {
    label: 'MobileAI',
    icon: <Smartphone className="w-4 h-4" />,
    color: 'bg-orange-500/15 text-orange-400',
  },
  mee: {
    label: 'MEE',
    icon: <Shield className="w-4 h-4" />,
    color: 'bg-slate-500/15 text-slate-400',
  },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AIJobCard({ job }: AIJobCardProps) {
  const meta = ENGINE_META[job.engine] ?? {
    label: job.engine,
    icon: <Code2 className="w-4 h-4" />,
    color: 'bg-slate-500/15 text-slate-400',
  };

  const isRunning = job.status === 'running';
  const resultPreview =
    job.result != null
      ? typeof job.result === 'string'
        ? job.result.slice(0, 120)
        : JSON.stringify(job.result).slice(0, 120)
      : null;

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              meta.color
            )}
          >
            {meta.icon}
          </span>
          <span className="text-sm font-medium text-slate-200">
            {meta.label}
          </span>
        </div>

        {/* Status badge — animated when running */}
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
            isRunning
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
              : undefined
          )}
        >
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          )}
          {!isRunning && <Badge status={job.status} />}
          {isRunning && 'Running'}
        </span>
      </div>

      {/* Created time */}
      <p className="text-xs text-slate-500">
        Started {formatRelativeTime(job.created_at)}
      </p>

      {/* Result preview */}
      {resultPreview && (
        <div className="bg-slate-800/50 rounded-lg p-2.5">
          <p className="text-xs text-slate-400 font-mono line-clamp-2">
            {resultPreview}
            {resultPreview.length >= 120 && '…'}
          </p>
        </div>
      )}
    </div>
  );
}
