'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  X,
  Link,
  AlertCircle,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { clsx } from 'clsx';

// ─── Priority helpers ───────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border border-red-500/25',
  high: 'text-orange-400 bg-orange-500/10 border border-orange-500/25',
  medium: 'text-amber-400 bg-amber-500/10 border border-amber-500/25',
  low: 'text-slate-400 bg-slate-700/40 border border-slate-700/60',
};

function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority ?? 'low').toLowerCase();
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        PRIORITY_COLORS[p] ?? PRIORITY_COLORS.low
      )}
    >
      <AlertCircle className="w-3 h-3" />
      {p.charAt(0).toUpperCase() + p.slice(1)}
    </span>
  );
}

function SPBadge({ points }: { points: number | null | undefined }) {
  if (points == null) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/25">
      {points} SP
    </span>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface BacklogItemProps {
  item: any;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}

interface EditFormState {
  title: string;
  description: string;
  priority: string;
  story_points: string;
  status: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BacklogItem({ item, onUpdate, onDelete }: BacklogItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<EditFormState>({
    title: item?.title ?? '',
    description: item?.description ?? '',
    priority: item?.priority ?? 'medium',
    story_points: String(item?.story_points ?? ''),
    status: item?.status ?? 'open',
  });

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(item.id, {
        title: form.title,
        description: form.description,
        priority: form.priority,
        story_points: form.story_points ? Number(form.story_points) : null,
        status: form.status,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await onDelete(item.id);
    setConfirmDelete(false);
  };

  const truncated =
    (item.description ?? '').length > 120
      ? (item.description as string).slice(0, 120) + '…'
      : item.description;

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all group">
      {/* ── Main row ── */}
      {!editing ? (
        <div className="flex items-start gap-3 p-4">
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-200 truncate">
                {item.title ?? 'Untitled'}
              </span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <PriorityBadge priority={item.priority ?? 'low'} />
              <SPBadge points={item.story_points} />
              <Badge status={item.status ?? 'open'} />
              {item.requirement_id && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                  <Link className="w-3 h-3" />
                  REQ-{String(item.requirement_id).slice(0, 8)}
                </span>
              )}
            </div>

            {/* Description preview */}
            {!expanded && truncated && (
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-1">
                {truncated}
              </p>
            )}
          </div>

          {/* Actions (hover) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => {
                setForm({
                  title: item.title ?? '',
                  description: item.description ?? '',
                  priority: item.priority ?? 'medium',
                  story_points: String(item.story_points ?? ''),
                  status: item.status ?? 'open',
                });
                setEditing(true);
                setExpanded(false);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Edit form ── */
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-400 mb-2">Editing item</p>
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            placeholder="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <select
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            >
              {['critical', 'high', 'medium', 'low'].map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="SP"
              min={0}
              value={form.story_points}
              onChange={(e) => setForm((f) => ({ ...f, story_points: e.target.value }))}
            />
            <select
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {['open', 'in_progress', 'done', 'blocked'].map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg hover:border-slate-600 transition-all"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Expanded detail ── */}
      {expanded && !editing && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
          {item.description && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Description
              </p>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>
            </div>
          )}
          {item.acceptance_criteria && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Acceptance Criteria
              </p>
              {Array.isArray(item.acceptance_criteria) ? (
                <ul className="space-y-1">
                  {(item.acceptance_criteria as string[]).map((ac, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      {ac}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {item.acceptance_criteria}
                </p>
              )}
            </div>
          )}
          {item.sprint_id && (
            <p className="text-xs text-slate-500">
              Sprint: <span className="text-slate-400">{item.sprint_id}</span>
            </p>
          )}
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <div className="border-t border-red-900/40 bg-red-900/10 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-red-300">Delete this backlog item?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1 text-xs text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
