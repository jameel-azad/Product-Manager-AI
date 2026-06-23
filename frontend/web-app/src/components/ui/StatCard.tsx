import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  trendUp,
  color = 'blue',
}: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/15 text-blue-400',
    purple: 'bg-purple-500/15 text-purple-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    orange: 'bg-orange-500/15 text-orange-400',
    red: 'bg-red-500/15 text-red-400',
    amber: 'bg-amber-500/15 text-amber-400',
    slate: 'bg-slate-700/40 text-slate-400',
  };

  const iconClasses = colorMap[color] ?? colorMap['blue'];

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            iconClasses
          )}
        >
          {icon}
        </div>

        {trend !== undefined && (
          <span
            className={clsx(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              trendUp
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            {trendUp ? '▲' : '▼'} {trend}
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-white leading-none mb-1">
          {value}
        </p>
        <p className="text-sm text-slate-400">{title}</p>
      </div>
    </div>
  );
}
