'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { requirementsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { Requirement, Priority, RequirementStatus } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  ArrowLeft,
  Plus,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  X,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low'];
const STATUS_OPTIONS: RequirementStatus[] = [
  'draft',
  'reviewed',
  'approved',
  'linked',
  'deprecated',
];

// ─── Generate from Text Modal ─────────────────────────────────────────────────

function GenerateFromTextModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: (reqs: Requirement[]) => void;
}) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Requirement[]>([]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await requirementsApi.fromText(text.trim(), projectId);
      const reqs: Requirement[] =
        res.data?.requirements ?? res.data?.items ?? res.data ?? [];
      setResults(reqs);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to generate requirements.'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    onSuccess(results);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#0a0f1e]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl bg-[#0f172a] border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">
              Generate Requirements from Text
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste business goals, user stories, or feature descriptions here…"
          rows={6}
          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
        />

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" />
            {error}
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-emerald-400 font-medium">
              Generated {results.length} requirement
              {results.length !== 1 ? 's' : ''}:
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-slate-300">{r.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {results.length > 0 ? (
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Apply {results.length} Requirements
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !text.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Conflicts Modal ──────────────────────────────────────────────────────────

function ConflictsModal({
  conflicts,
  onClose,
}: {
  conflicts: any[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-[#0a0f1e]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Conflict Analysis
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {conflicts.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="text-sm text-emerald-400 font-medium">
              No conflicts detected
            </p>
            <p className="text-xs text-slate-500 mt-1">
              All requirements are consistent with each other.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {conflicts.map((c: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
                  c.severity === 'high'   ? 'bg-red-500/10 border-red-500/25' :
                  c.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/25' :
                                           'bg-slate-800/60 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-200">
                    {c.type ?? c.conflict_type ?? `Conflict ${i + 1}`}
                  </p>
                  {c.severity && (
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      c.severity === 'high'   ? 'bg-red-500/20 text-red-400' :
                      c.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                               'bg-slate-700 text-slate-400'
                    }`}>{c.severity}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {c.conflict_description ?? c.description ?? c.message ?? JSON.stringify(c)}
                </p>
                {(c.req1_id || c.req2_id) && (
                  <p className="text-[10px] text-slate-600 mt-1 font-mono">
                    {c.req1_id?.slice(0, 8)} ↔ {c.req2_id?.slice(0, 8)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Requirement Form ─────────────────────────────────────────────────────

function AddRequirementForm({
  projectId,
  onCancel,
  onCreated,
}: {
  projectId: string;
  onCancel: () => void;
  onCreated: (req: Requirement) => void;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    acceptance_criteria: '',
    priority: 'medium' as Priority,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await requirementsApi.create({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description.trim(),
        acceptance_criteria: form.acceptance_criteria
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        priority: form.priority,
      });
      onCreated(res.data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create requirement.'));
      setLoading(false);
    }
  };

  return (
    <tr>
      <td colSpan={5} className="p-0">
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-blue-500/5 border-b border-slate-800 space-y-3"
        >
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Requirement title *"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
              className="px-3 py-2 bg-[#0f172a] border border-slate-700 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition-colors"
            />
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((p) => ({ ...p, priority: e.target.value as Priority }))
              }
              className="px-3 py-2 bg-[#0f172a] border border-slate-700 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors"
            >
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p} className="bg-[#0f172a]">
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            rows={2}
            className="w-full px-3 py-2 bg-[#0f172a] border border-slate-700 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
          />
          <textarea
            placeholder="Acceptance criteria (one per line)"
            value={form.acceptance_criteria}
            onChange={(e) =>
              setForm((p) => ({ ...p, acceptance_criteria: e.target.value }))
            }
            rows={2}
            className="w-full px-3 py-2 bg-[#0f172a] border border-slate-700 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

// ─── Requirement Row ──────────────────────────────────────────────────────────

function RequirementRow({
  req,
  onApprove,
}: {
  req: Requirement;
  onApprove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove(req.id);
    } finally {
      setApproving(false);
    }
  };

  return (
    <>
      <tr className="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors group">
        {/* Title */}
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 leading-relaxed">
                {req.title}
              </p>
              {req.ai_generated && (
                <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-blue-400">
                  <Sparkles className="w-2.5 h-2.5" />
                  AI Generated
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Priority */}
        <td className="px-3 py-3 whitespace-nowrap">
          <Badge status={req.priority} />
        </td>

        {/* Status */}
        <td className="px-3 py-3 whitespace-nowrap">
          <Badge status={req.status} />
        </td>

        {/* Created */}
        <td className="px-3 py-3 whitespace-nowrap text-[10px] text-slate-500">
          {formatDate(req.created_at)}
        </td>

        {/* Actions */}
        <td className="px-3 py-3 whitespace-nowrap">
          {req.status !== 'approved' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {approving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Approve
            </button>
          )}
        </td>
      </tr>

      {/* Expanded details */}
      {expanded && (
        <tr className="border-b border-slate-800/40">
          <td colSpan={5} className="px-4 pb-4 pt-0">
            <div className="ml-5 space-y-3 pt-2">
              {req.description && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {req.description}
                  </p>
                </div>
              )}
              {req.acceptance_criteria && req.acceptance_criteria.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                    Acceptance Criteria
                  </p>
                  <ul className="space-y-1">
                    {req.acceptance_criteria.map((criterion, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-1.5 text-xs text-slate-300"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                        {criterion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RequirementsPage() {
  const router = useRouter();
  const { id: projectId } = useParams<{ id: string }>();

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<RequirementStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');

  const [showAddForm, setShowAddForm] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showConflictsModal, setShowConflictsModal] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [analyzingConflicts, setAnalyzingConflicts] = useState(false);

  const fetchRequirements = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await requirementsApi.list(projectId);
      const data: Requirement[] = res.data?.items ?? res.data ?? [];
      setRequirements(data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load requirements.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  const handleApprove = async (reqId: string) => {
    try {
      await requirementsApi.approve(reqId);
      setRequirements((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: 'approved' as RequirementStatus } : r))
      );
    } catch {
      // Silently ignore — badge will not update
    }
  };

  const handleAnalyzeConflicts = async () => {
    if (!projectId) return;
    setAnalyzingConflicts(true);
    try {
      const res = await requirementsApi.analyzeConflicts(projectId);
      const raw = res.data;
      const list = Array.isArray(raw)          ? raw
                 : Array.isArray(raw?.data)     ? raw.data
                 : Array.isArray(raw?.conflicts) ? raw.conflicts
                 : [];
      setConflicts(list);
      setShowConflictsModal(true);
    } catch {
      setConflicts([]);
      setShowConflictsModal(true);
    } finally {
      setAnalyzingConflicts(false);
    }
  };

  const handleGenerated = (newReqs: Requirement[]) => {
    setRequirements((prev) => [...newReqs, ...prev]);
  };

  const handleCreated = (req: Requirement) => {
    setRequirements((prev) => [req, ...prev]);
    setShowAddForm(false);
  };

  // Filtered requirements
  const filtered = requirements.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modals */}
      {showGenerateModal && (
        <GenerateFromTextModal
          projectId={projectId}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={handleGenerated}
        />
      )}
      {showConflictsModal && (
        <ConflictsModal
          conflicts={conflicts}
          onClose={() => setShowConflictsModal(false)}
        />
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="w-8 h-8 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/40 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Requirements</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {requirements.length} total
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAnalyzeConflicts}
            disabled={analyzingConflicts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10 rounded-lg transition-all disabled:opacity-50"
          >
            {analyzingConflicts ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            Analyze Conflicts
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-500/30 hover:border-blue-500/60 bg-blue-500/5 hover:bg-blue-500/10 rounded-lg transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate from Text
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Requirement
          </button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </div>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as RequirementStatus | 'all')
          }
          className="px-2.5 py-1.5 bg-[#0f172a] border border-slate-700 rounded-lg text-xs text-slate-300 outline-none"
        >
          <option value="all" className="bg-[#0f172a]">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="bg-[#0f172a]">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) =>
            setFilterPriority(e.target.value as Priority | 'all')
          }
          className="px-2.5 py-1.5 bg-[#0f172a] border border-slate-700 rounded-lg text-xs text-slate-300 outline-none"
        >
          <option value="all" className="bg-[#0f172a]">All Priorities</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p} className="bg-[#0f172a]">
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        <button
          onClick={fetchRequirements}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading requirements…" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <button
            onClick={fetchRequirements}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  Requirement
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  Priority
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  Created
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {showAddForm && (
                <AddRequirementForm
                  projectId={projectId}
                  onCancel={() => setShowAddForm(false)}
                  onCreated={handleCreated}
                />
              )}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 mb-1">
                      No requirements found
                    </p>
                    <p className="text-xs text-slate-500">
                      {requirements.length === 0
                        ? 'Add your first requirement or generate from text.'
                        : 'Try adjusting the filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <RequirementRow
                    key={req.id}
                    req={req}
                    onApprove={handleApprove}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
