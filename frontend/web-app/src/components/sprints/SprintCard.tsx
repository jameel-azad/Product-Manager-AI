'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  Target,
  Package,
  AlertCircle,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';

// ─── Priority dot ────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-500',
};

// ─── Capacity bar ────────────────────────────────────────────────────────────

function CapacityBar({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const overCapacity = used > total && total > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">
          {used} / {total} SP
        </span>
        <span
          className={clsx(
            'font-medium',
            overCapacity ? 'text-red-400' : pct >= 80 ? 'text-amber-400' : 'text-emerald-400'
          )}
        >
          {pct}%
          {overCapacity && ' (over capacity)'}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            overCapacity
              ? 'bg-gradient-to-r from-red-500 to-red-600'
              : pct >= 80
              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
              : 'bg-gradient-to-r from-blue-500 to-cyan-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Safe date formatter ──────────────────────────────────────────────────────

function safeFormat(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SprintCardProps {
  sprint: any;
  items: any[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SprintCard({ sprint, items }: SprintCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!sprint) return null;

  const sprintItems: any[] = Array.isArray(items) ? items : [];

  const usedSP = sprintItems.reduce(
    (sum, it) => sum + (Number(it?.story_points) || 0),
    0
  );
  const totalCapacity = Number(sprint.capacity) || 0;

  const startDate = safeFormat(sprint.start_date, 'MMM d');
  const endDate = safeFormat(sprint.end_date, 'MMM d, yyyy');

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all">
      {/* ── Header ── */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-800/30 transition-colors"
      >
        <span className="mt-0.5 text-slate-500 shrink-0">
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-200">
              {sprint.name ?? 'Unnamed Sprint'}
            </span>
            <Badge status={sprint.status ?? 'planned'} />
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Package className="w-3 h-3" />
              {sprintItems.length} items
            </span>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
            <Calendar className="w-3 h-3" />
            <span>
              {startDate} — {endDate}
            </span>
          </div>

          {/* Goal */}
          {sprint.goal && (
            <div className="flex items-start gap-1.5 text-xs text-slate-400 mb-3">
              <Target className="w-3 h-3 mt-0.5 text-blue-400 shrink-0" />
              <span className="line-clamp-2 leading-relaxed">{sprint.goal}</span>
            </div>
          )}

          {/* Capacity bar */}
          {totalCapacity > 0 && (
            <CapacityBar used={usedSP} total={totalCapacity} />
          )}
          {totalCapacity === 0 && sprintItems.length > 0 && (
            <p className="text-xs text-slate-500">{usedSP} SP assigned</p>
          )}
        </div>
      </button>

      {/* ── Items list ── */}
      {!collapsed && sprintItems.length > 0 && (
        <div className="border-t border-slate-800 divide-y divide-slate-800/60">
          {sprintItems.map((it: any) => (
            <div
              key={it?.id ?? Math.random()}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/20 transition-colors"
            >
              {/* Priority dot */}
              <span
                className={clsx(
                  'w-2 h-2 rounded-full shrink-0',
                  PRIORITY_DOT[(it?.priority ?? 'low').toLowerCase()] ??
                    PRIORITY_DOT.low
                )}
              />

              {/* Title */}
              <span className="flex-1 text-xs text-slate-300 truncate">
                {it?.title ?? 'Untitled'}
              </span>

              {/* SP */}
              {it?.story_points != null && (
                <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                  {it.story_points} SP
                </span>
              )}

              {/* Status */}
              <Badge status={it?.status ?? 'open'} className="shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!collapsed && sprintItems.length === 0 && (
        <div className="border-t border-slate-800 px-4 py-6 text-center">
          <AlertCircle className="w-5 h-5 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No items assigned to this sprint yet.</p>
        </div>
      )}
    </div>
  );
}
