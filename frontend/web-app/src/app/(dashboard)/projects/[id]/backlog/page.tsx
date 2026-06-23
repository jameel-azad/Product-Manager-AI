'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  List,
  Sparkles,
  Plus,
  X,
  CalendarDays,
  Loader2,
  Target,
  ChevronDown,
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import BacklogItem from '@/components/backlog/BacklogItem';
import SprintCard from '@/components/sprints/SprintCard';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import * as Dialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { format } from 'date-fns';

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type = 'success',
  onDismiss,
}: {
  message: string;
  type?: 'success' | 'error';
  onDismiss: () => void;
}) {
  return (
    <div
      className={clsx(
        'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border max-w-sm text-sm font-medium animate-fade-in',
        type === 'success'
          ? 'bg-emerald-900/80 border-emerald-500/30 text-emerald-200'
          : 'bg-red-900/80 border-red-500/30 text-red-200'
      )}
    >
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Add Item Form ────────────────────────────────────────────────────────────

interface AddItemFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

function AddItemForm({ onSubmit, onCancel }: AddItemFormProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    story_points: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        story_points: form.story_points ? Number(form.story_points) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-blue-400">New Backlog Item</p>
      <input
        autoFocus
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        placeholder="Title *"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />
      <textarea
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
        placeholder="Description (optional)"
        rows={2}
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
          min={0}
          className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="SP"
          value={form.story_points}
          onChange={(e) => setForm((f) => ({ ...f, story_points: e.target.value }))}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.title.trim()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
        >
          {saving ? 'Adding…' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}

// ─── Plan Sprint Modal ────────────────────────────────────────────────────────

interface PlanSprintModalProps {
  projectId: string;
  onClose: () => void;
  onCreated: (sprint: any) => void;
}

function PlanSprintModal({ projectId, onClose, onCreated }: PlanSprintModalProps) {
  const [velocity, setVelocity] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await projectsApi.planSprint(projectId, {
        velocity: velocity ? Number(velocity) : undefined,
      });
      setRecommendation(res.data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to plan sprint'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (recommendation) {
      onCreated(recommendation);
      onClose();
    }
  };

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl outline-none overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <Dialog.Title className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              AI Sprint Planning
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Velocity input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Team Velocity (story points per sprint)
              </label>
              <input
                type="number"
                min={1}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. 40"
                value={velocity}
                onChange={(e) => setVelocity(e.target.value)}
              />
            </div>

            <button
              onClick={handlePlan}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Planning…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Sprint Plan
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {recommendation && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-violet-400">AI Recommendation</p>
                {recommendation.name && (
                  <p className="text-sm font-medium text-slate-200">{recommendation.name}</p>
                )}
                {recommendation.goal && (
                  <p className="text-xs text-slate-400 leading-relaxed">{recommendation.goal}</p>
                )}
                {recommendation.items_count && (
                  <p className="text-xs text-slate-500">
                    {recommendation.items_count} items •{' '}
                    {recommendation.total_story_points ?? '—'} story points
                  </p>
                )}
                <pre className="text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {typeof recommendation === 'object'
                    ? JSON.stringify(recommendation, null, 2)
                    : String(recommendation)}
                </pre>
                <button
                  onClick={handleAccept}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all"
                >
                  Accept & Create Sprint
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Create Sprint Form ───────────────────────────────────────────────────────

interface CreateSprintFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

function CreateSprintForm({ onSubmit, onCancel }: CreateSprintFormProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const twoWeeks = format(new Date(Date.now() + 14 * 86400 * 1000), 'yyyy-MM-dd');

  const [form, setForm] = useState({
    name: '',
    goal: '',
    start_date: today,
    end_date: twoWeeks,
    capacity: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        goal: form.goal.trim() || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        status: 'planned',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-emerald-400">New Sprint</p>
      <input
        autoFocus
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        placeholder="Sprint name *"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <textarea
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
        placeholder="Sprint goal"
        rows={2}
        value={form.goal}
        onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">Start Date</label>
          <input
            type="date"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-1 block">End Date</label>
          <input
            type="date"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
          />
        </div>
      </div>
      <input
        type="number"
        min={0}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        placeholder="Capacity (story points)"
        value={form.capacity}
        onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
        >
          {saving ? 'Creating…' : 'Create Sprint'}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const params = useParams();
  const projectId = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? '');

  // Data state
  const [backlogItems, setBacklogItems] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loadingBacklog, setLoadingBacklog] = useState(true);
  const [loadingSprints, setLoadingSprints] = useState(true);

  // UI state
  const [generatingBacklog, setGeneratingBacklog] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchBacklog = useCallback(async () => {
    if (!projectId) return;
    setLoadingBacklog(true);
    try {
      const res = await projectsApi.getBacklog(projectId);
      const items = res.data?.items ?? res.data ?? [];
      setBacklogItems(Array.isArray(items) ? items : []);
    } catch {
      setBacklogItems([]);
    } finally {
      setLoadingBacklog(false);
    }
  }, [projectId]);

  const fetchSprints = useCallback(async () => {
    if (!projectId) return;
    setLoadingSprints(true);
    try {
      const res = await projectsApi.getSprints(projectId);
      const data = res.data?.sprints ?? res.data ?? [];
      setSprints(Array.isArray(data) ? data : []);
    } catch {
      setSprints([]);
    } finally {
      setLoadingSprints(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBacklog();
    fetchSprints();
  }, [fetchBacklog, fetchSprints]);

  // ── Backlog actions ───────────────────────────────────────────────────────

  const handleGenerateBacklog = async () => {
    setGeneratingBacklog(true);
    try {
      const res = await projectsApi.generateBacklog(projectId);
      const items = res.data?.items ?? res.data ?? [];
      if (Array.isArray(items) && items.length > 0) {
        setBacklogItems((prev) => [...items, ...prev]);
      }
      showToast('Backlog generated successfully by AI');
    } catch (err: any) {
      showToast(getErrorMessage(err, 'Failed to generate backlog'), 'error');
    } finally {
      setGeneratingBacklog(false);
    }
  };

  const handleAddItem = async (data: any) => {
    const res = await projectsApi.createBacklogItem(projectId, data);
    setBacklogItems((prev) => [res.data, ...prev]);
    setShowAddItem(false);
    showToast('Backlog item added');
  };

  const handleUpdateItem = async (id: string, data: any) => {
    const res = await projectsApi.updateBacklogItem(projectId, id, data);
    setBacklogItems((prev) => prev.map((it) => (it.id === id ? res.data : it)));
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await projectsApi.updateBacklogItem(projectId, id, { deleted: true });
    } catch {
      // Best effort
    }
    setBacklogItems((prev) => prev.filter((it) => it.id !== id));
    showToast('Item removed from backlog');
  };

  // ── Sprint actions ────────────────────────────────────────────────────────

  const handleCreateSprint = async (data: any) => {
    const res = await projectsApi.createSprint(projectId, data);
    setSprints((prev) => [...prev, res.data]);
    setShowCreateSprint(false);
    showToast('Sprint created');
  };

  const handleSprintCreatedFromAI = (sprint: any) => {
    setSprints((prev) => [...prev, sprint]);
    showToast('Sprint created from AI plan');
  };

  // ── Filtered items ────────────────────────────────────────────────────────

  const filteredItems = backlogItems.filter((it) => {
    const statusOk =
      filterStatus === 'all' || (it?.status ?? '').toLowerCase() === filterStatus;
    const priorityOk =
      filterPriority === 'all' || (it?.priority ?? '').toLowerCase() === filterPriority;
    return statusOk && priorityOk;
  });

  // ── Sprint items mapping ──────────────────────────────────────────────────

  function getSprintItems(sprintId: string) {
    return backlogItems.filter((it) => it?.sprint_id === sprintId);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-white">Backlog & Sprint Planning</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Manage your product backlog and plan sprints with AI assistance.
        </p>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── LEFT: Product Backlog ── */}
        <div className="space-y-4">
          {/* Section header */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-200">Product Backlog</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/25">
                {filteredItems.length}
              </span>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleGenerateBacklog}
                disabled={generatingBacklog}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
              >
                {generatingBacklog ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generatingBacklog ? 'Generating…' : 'Generate Backlog (AI)'}
              </button>
              <button
                onClick={() => setShowAddItem((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500">Status:</label>
              <select
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                {['all', 'open', 'in_progress', 'done', 'blocked'].map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500">Priority:</label>
              <select
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                {['all', 'critical', 'high', 'medium', 'low'].map((p) => (
                  <option key={p} value={p}>
                    {p === 'all' ? 'All Priorities' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Add item form */}
          {showAddItem && (
            <AddItemForm
              onSubmit={handleAddItem}
              onCancel={() => setShowAddItem(false)}
            />
          )}

          {/* Items list */}
          {loadingBacklog ? (
            <PageLoader label="Loading backlog…" />
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <List className="w-8 h-8 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">No backlog items found.</p>
              <p className="text-xs text-slate-600 mt-1">
                Use "Generate Backlog (AI)" or "Add Item" to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item: any) => (
                <BacklogItem
                  key={item?.id ?? Math.random()}
                  item={item}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Sprints ── */}
        <div className="space-y-4">
          {/* Section header */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">Sprints</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                {sprints.length}
              </span>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setShowPlanModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-lg transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Plan Sprint (AI)
              </button>
              <button
                onClick={() => setShowCreateSprint((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Sprint
              </button>
            </div>
          </div>

          {/* Create sprint form */}
          {showCreateSprint && (
            <CreateSprintForm
              onSubmit={handleCreateSprint}
              onCancel={() => setShowCreateSprint(false)}
            />
          )}

          {/* Sprint list */}
          {loadingSprints ? (
            <PageLoader label="Loading sprints…" />
          ) : sprints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="w-8 h-8 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">No sprints yet.</p>
              <p className="text-xs text-slate-600 mt-1">
                Use "Plan Sprint (AI)" or "Create Sprint" to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sprints.map((sprint: any) => (
                <SprintCard
                  key={sprint?.id ?? Math.random()}
                  sprint={sprint}
                  items={getSprintItems(sprint?.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Plan Sprint Modal */}
      {showPlanModal && (
        <PlanSprintModal
          projectId={projectId}
          onClose={() => setShowPlanModal(false)}
          onCreated={handleSprintCreatedFromAI}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
