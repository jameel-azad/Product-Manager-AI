'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { meeApi } from '@/lib/api';

interface ActivityEvent {
  id: string;
  engine?: string;
  agent_id?: string;
  event_type?: string;
  action_type?: string;
  description?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | string;
  timestamp: string;
  status?: string;
}

interface ActivityFeedProps {
  projectId?: string;
  limit?: number;
  autoRefresh?: boolean;
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-emerald-500',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ActivityFeed({
  projectId,
  limit = 20,
  autoRefresh = false,
}: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());

  const fetchFeed = useCallback(async () => {
    try {
      const res = await meeApi.getActivityFeed({
        project_id: projectId,
        limit,
      });
      const incoming: ActivityEvent[] = Array.isArray(res.data)
        ? res.data
        : res.data?.items ?? [];

      setEvents((prev) => {
        const newItems = incoming.filter((e) => !seenIds.current.has(e.id));
        newItems.forEach((e) => seenIds.current.add(e.id));
        if (newItems.length === 0) return prev;
        const merged = [...newItems, ...prev].slice(0, limit);
        return merged;
      });
      setError(null);
    } catch {
      setError('Failed to load activity feed');
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchFeed, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchFeed]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-slate-700 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-700 rounded w-1/3" />
              <div className="h-3 bg-slate-800 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No activity yet.</p>;
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-800" />

      <ul className="space-y-4 pl-6">
        {events.map((event, idx) => {
          const severity = event.severity ?? 'low';
          const dotColor = SEVERITY_DOT[severity] ?? 'bg-slate-500';
          const engineLabel =
            event.engine ?? event.agent_id ?? 'System';
          const eventType = event.event_type ?? event.action_type ?? 'event';
          const description = event.description ?? event.status ?? '';

          return (
            <li
              key={event.id}
              className="relative animate-fade-in"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              {/* Dot */}
              <span
                className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ${dotColor} ring-2 ring-[#0f172a]`}
              />

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-300 leading-snug">
                    <span className="font-medium text-slate-200">
                      {engineLabel}
                    </span>{' '}
                    &mdash;{' '}
                    <span className="text-blue-400">{eventType}</span>
                  </p>
                  {description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {description}
                    </p>
                  )}
                </div>
                <time className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">
                  {formatRelativeTime(event.timestamp)}
                </time>
              </div>
            </li>
          );
        })}
      </ul>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease both;
        }
      `}</style>
    </div>
  );
}
