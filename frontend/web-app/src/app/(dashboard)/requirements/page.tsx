'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { projectsApi, requirementsApi } from '@/lib/api';
import { FileText, Plus, Wand2, ChevronRight, CheckCircle, Clock, AlertCircle, Circle } from 'lucide-react';

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  low: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  approved: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,
  in_review: <Clock className="w-3.5 h-3.5 text-yellow-400" />,
  draft: <Circle className="w-3.5 h-3.5 text-slate-500" />,
  deprecated: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
};

export default function RequirementsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showNLP, setShowNLP] = useState(false);
  const [nlpText, setNlpText] = useState('');

  useEffect(() => {
    projectsApi.list().then(r => {
      const projs = r.data;
      setProjects(projs);
      if (projs.length > 0) setSelectedProject(projs[0]);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    requirementsApi.list(selectedProject.id).then(r => {
      setRequirements(r.data);
    }).finally(() => setLoading(false));
  }, [selectedProject]);

  const handleGenerateFromText = async () => {
    if (!nlpText.trim() || !selectedProject) return;
    setGenerating(true);
    try {
      const res = await requirementsApi.fromText(nlpText, selectedProject.id);
      setRequirements(prev => [...res.data, ...prev]);
      setShowNLP(false);
      setNlpText('');
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Requirements</h1>
          <p className="text-slate-400 text-sm mt-1">AI-powered requirement management across all projects</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowNLP(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors"
          >
            <Wand2 className="w-4 h-4" /> Generate from Text
          </button>
          <button
            onClick={() => selectedProject && router.push(`/projects/${selectedProject.id}/requirements`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Requirement
          </button>
        </div>
      </div>

      {/* Project selector */}
      <div className="flex gap-2 flex-wrap">
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProject(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              selectedProject?.id === p.id
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: requirements.length, color: 'text-white' },
          { label: 'Approved', value: requirements.filter(r => r.status === 'approved').length, color: 'text-green-400' },
          { label: 'In Review', value: requirements.filter(r => r.status === 'in_review').length, color: 'text-yellow-400' },
          { label: 'Draft', value: requirements.filter(r => r.status === 'draft').length, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#0f172a] border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Requirements list */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-200">
            {selectedProject?.name ?? 'Select a project'}
          </span>
          {selectedProject && (
            <button
              onClick={() => router.push(`/projects/${selectedProject.id}/requirements`)}
              className="ml-auto text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Open full view <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading requirements...</div>
        ) : requirements.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm mb-3">No requirements yet.</p>
            <button onClick={() => setShowNLP(true)} className="text-blue-400 text-sm hover:underline">
              Generate from business goals →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                <th className="px-5 py-3 text-left font-medium">Requirement</th>
                <th className="px-4 py-3 text-left font-medium">Priority</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req, i) => (
                <tr key={req.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                  <td className="px-5 py-3">
                    <p className="text-slate-200 font-medium">{req.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{req.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${PRIORITY_COLOR[req.priority] ?? PRIORITY_COLOR.medium}`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICON[req.status] ?? <Circle className="w-3.5 h-3.5 text-slate-500" />}
                      <span className="text-slate-300 text-xs capitalize">{req.status?.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {req.ai_generated
                      ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">AI Generated</span>
                      : <span className="text-slate-500 text-xs">Manual</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* NLP Modal */}
      {showNLP && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="w-5 h-5 text-purple-400" />
              <h2 className="text-white font-semibold">Generate Requirements from Text</h2>
            </div>
            <p className="text-slate-400 text-sm mb-3">Paste your business goals or feature description. AI will generate structured requirements.</p>
            <textarea
              value={nlpText}
              onChange={e => setNlpText(e.target.value)}
              rows={6}
              placeholder="e.g. We need a customer portal where users can view invoices, make payments, and raise support tickets..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowNLP(false)} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
              <button onClick={handleGenerateFromText} disabled={generating || !nlpText.trim()} className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {generating ? 'Generating...' : 'Generate Requirements'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
