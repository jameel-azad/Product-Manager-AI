'use client';

import { useState, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { projectsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  ArrowLeft,
  Plus,
  X,
  Loader2,
  FolderOpen,
  Link,
  Code2,
  FileText,
} from 'lucide-react';

// â”€â”€â”€ Tag Input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = (value: string) => {
    const trimmed = value.trim().replace(/,+$/, '');
    if (!trimmed) return;
    // Support comma-separated input
    const parts = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
    const unique = parts.filter((p) => !tags.includes(p));
    if (unique.length > 0) onChange([...tags, ...unique]);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div className="min-h-[42px] flex flex-wrap gap-1.5 px-3 py-2 bg-[#0f172a] border border-slate-700 hover:border-slate-600 focus-within:border-blue-500 rounded-xl transition-colors cursor-text">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-xs font-mono text-blue-300"
        >
          <Code2 className="w-2.5 h-2.5" />
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 text-blue-400 hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? placeholder : 'Add moreâ€¦'}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-slate-500 outline-none"
      />
    </div>
  );
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function NewProjectPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    description: '',
    repository_url: '',
  });
  const [techStack, setTechStack] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        description: form.description.trim(),
        tech_stack: techStack,
      };
      if (form.repository_url.trim()) {
        payload.repository_url = form.repository_url.trim();
      }
      const res = await projectsApi.create(payload);
      const projectId: string = res.data?.id ?? res.data?.project?.id;
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      setError(
        getErrorMessage(err, 'Failed to create project. Please try again.')
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* â”€â”€ Back + Title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/projects')}
          className="w-8 h-8 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/40 flex items-center justify-center text-slate-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">New Project</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Set up your AI-driven project workspace
          </p>
        </div>
      </div>

      {/* â”€â”€ Form Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
        {/* Card header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Project Details</p>
            <p className="text-xs text-slate-400">
              Configure the basics â€” you can update everything later
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-sm text-red-400">
              <X className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Project Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              Project Name
              <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. E-Commerce Platform"
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-[#0f172a] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <FileText className="w-3.5 h-3.5 text-violet-400" />
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe what this project is aboutâ€¦"
              rows={3}
              className="w-full px-3 py-2.5 bg-[#0f172a] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
            />
          </div>

          {/* Tech Stack */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              Tech Stack
            </label>
            <TagInput
              tags={techStack}
              onChange={setTechStack}
              placeholder="Type a technology and press Enter or commaâ€¦"
            />
            <p className="text-[10px] text-slate-500">
              Press Enter or comma to add each technology. Examples: React,
              Node.js, PostgreSQL, Kubernetes
            </p>
          </div>

          {/* Repository URL */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Link className="w-3.5 h-3.5 text-amber-400" />
              Repository URL
            </label>
            <input
              type="url"
              name="repository_url"
              value={form.repository_url}
              onChange={handleChange}
              placeholder="https://github.com/your-org/your-repo"
              className="w-full px-3 py-2.5 bg-[#0f172a] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/projects')}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-md shadow-blue-500/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creatingâ€¦
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

