import { clsx } from 'clsx';

type Size = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  size?: Size;
  className?: string;
  label?: string;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
};

export default function LoadingSpinner({
  size = 'md',
  className,
  label,
}: LoadingSpinnerProps) {
  return (
    <div
      className={clsx('flex flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-label={label ?? 'Loading'}
    >
      <div
        className={clsx(
          'rounded-full border-slate-700 border-t-blue-500 animate-spin',
          SIZE_CLASSES[size]
        )}
      />
      {label && (
        <p className="text-sm text-slate-400 animate-pulse">{label}</p>
      )}
    </div>
  );
}

// Full-page loading overlay
export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 bg-[#0a0f1e]/80 backdrop-blur-sm flex items-center justify-center z-50">
      <LoadingSpinner size="lg" label={label ?? 'Loading...'} />
    </div>
  );
}

// Inline centered spinner for page sections
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <LoadingSpinner size="lg" label={label ?? 'Loading...'} />
    </div>
  );
}
