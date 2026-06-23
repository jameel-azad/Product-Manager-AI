'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Trash2 } from 'lucide-react';
import { requirementsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequirementModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  requirement?: any;
  onSaved: (req: any) => void;
}

interface FormState {
  title: string;
  description: string;
  acceptance_criteria: string[];
  priority: string;
  source_text: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  acceptance_criteria: [''],
  priority: 'medium',
  source_text: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inputClass(hasError?: boolean) {
  return [
    'w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-200',
    'placeholder-slate-500 focus:outline-none transition-colors',
    hasError
      ? 'border-red-500/60 focus:border-red-500'
      : 'border-slate-700 focus:border-blue-500',
  ].join(' ');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RequirementModal({
  open,
  onClose,
  projectId,
  requirement,
  onSaved,
}: RequirementModalProps) {
  const isEdit = !!requirement?.id;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (requirement) {
        setForm({
          title: requirement.title ?? '',
          description: requirement.description ?? '',
          acceptance_criteria: Array.isArray(requirement.acceptance_criteria)
            ? requirement.acceptance_criteria.length > 0
              ? requirement.acceptance_criteria
              : ['']
            : [''],
          priority: requirement.priority ?? 'medium',
          source_text: requirement.source_text ?? '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setError(null);
      setFieldErrors({});
    }
  }, [open, requirement]);

  // ── Acceptance criteria helpers ─────────────────────────────────────────

  const addCriteria = () =>
    setForm((f) => ({ ...f, acceptance_criteria: [...f.acceptance_criteria, ''] }));

  const removeCriteria = (idx: number) =>
    setForm((f) => ({
      ...f,
      acceptance_criteria: f.acceptance_criteria.filter((_, i) => i !== idx),
    }));

  const updateCriteria = (idx: number, value: string) =>
    setForm((f) => ({
      ...f,
      acceptance_criteria: f.acceptance_criteria.map((c, i) => (i === idx ? value : c)),
    }));

  // ── Validation ───────────────────────────────────────────────────────────

  function validate(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.description.trim()) errors.description = 'Description is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      acceptance_criteria: form.acceptance_criteria.filter((c) => c.trim()),
      priority: form.priority,
      source_text: form.source_text.trim() || undefined,
      project_id: projectId,
    };

    try {
      let res;
      if (isEdit) {
        res = await requirementsApi.update(requirement.id, payload);
      } else {
        res = await requirementsApi.create(payload);
      }
      onSaved(res.data);
      onClose();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save requirement'));
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl outline-none"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <Dialog.Title className="text-sm font-semibold text-slate-200">
              {isEdit ? 'Edit Requirement' : 'New Requirement'}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                className={inputClass(!!fieldErrors.title)}
                placeholder="e.g. User Authentication Flow"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              {fieldErrors.title && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                className={inputClass(!!fieldErrors.description)}
                placeholder="Describe the requirement in detail…"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              {fieldErrors.description && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.description}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Priority
              </label>
              <select
                className={inputClass()}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {['critical', 'high', 'medium', 'low'].map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Acceptance Criteria */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Acceptance Criteria
                </label>
                <button
                  type="button"
                  onClick={addCriteria}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {form.acceptance_criteria.map((ac, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      className={inputClass()}
                      placeholder={`Criterion ${idx + 1}…`}
                      value={ac}
                      onChange={(e) => updateCriteria(idx, e.target.value)}
                    />
                    {form.acceptance_criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCriteria(idx)}
                        className="shrink-0 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Source Text */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Source Text
                <span className="text-slate-600 font-normal ml-1">(optional)</span>
              </label>
              <textarea
                className={inputClass()}
                placeholder="Paste original text this requirement was extracted from…"
                rows={3}
                value={form.source_text}
                onChange={(e) => setForm((f) => ({ ...f, source_text: e.target.value }))}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all"
              >
                {saving ? 'Saving…' : isEdit ? 'Update Requirement' : 'Create Requirement'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
