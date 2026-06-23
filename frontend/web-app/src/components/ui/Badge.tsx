import { clsx } from 'clsx';

type Variant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface BadgeProps {
  status?: string | null;
  variant?: Variant;
  className?: string;
}

function detectVariant(status: string | undefined | null): Variant {
  if (!status) return 'default';
  const s = status.toLowerCase().replace(/[\s-]/g, '_');

  const successStatuses = [
    'completed', 'approved', 'deployed', 'success', 'active',
    'passed', 'done', 'resolved', 'healthy', 'online',
  ];
  const infoStatuses = [
    'running', 'in_progress', 'staging', 'processing', 'building',
    'executing', 'in_review', 'open',
  ];
  const errorStatuses = [
    'failed', 'error', 'critical', 'rejected', 'cancelled',
    'blocked', 'offline', 'down',
  ];
  const warningStatuses = [
    'queued', 'pending', 'draft', 'waiting', 'paused',
    'scheduled', 'review', 'warning',
  ];

  if (successStatuses.some((v) => s.includes(v))) return 'success';
  if (infoStatuses.some((v) => s.includes(v))) return 'info';
  if (errorStatuses.some((v) => s.includes(v))) return 'error';
  if (warningStatuses.some((v) => s.includes(v))) return 'warning';
  return 'default';
}

const VARIANT_CLASSES: Record<Variant, string> = {
  success:
    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 ring-0',
  info: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  error: 'bg-red-500/15 text-red-400 border border-red-500/25',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  default: 'bg-slate-700/40 text-slate-400 border border-slate-700/60',
};

export default function Badge({ status, variant, className }: BadgeProps) {
  const resolvedVariant = variant ?? detectVariant(status);

  const label = (status ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        VARIANT_CLASSES[resolvedVariant],
        className
      )}
    >
      <span
        className={clsx('w-1.5 h-1.5 rounded-full', {
          'bg-emerald-400': resolvedVariant === 'success',
          'bg-blue-400': resolvedVariant === 'info',
          'bg-red-400': resolvedVariant === 'error',
          'bg-amber-400': resolvedVariant === 'warning',
          'bg-slate-400': resolvedVariant === 'default',
        })}
      />
      {label}
    </span>
  );
}
