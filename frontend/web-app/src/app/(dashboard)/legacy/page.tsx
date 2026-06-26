'use client';

import { useState, useEffect, useCallback } from 'react';
import { legacyApi, projectsApi } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  RefreshCw,
  Play,
  FileCode,
  ArrowRight,
  X,
  ChevronRight,
  Layers,
  AlertCircle,
  CheckCircle2,
  Eye,
  Code2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
}

interface LangPair {
  source: string;
  target: string;
}

interface ConversionJob {
  id: string;
  project_id: string;
  source_language: string;
  target_language: string;
  status: string;
  progress: number;
  files_converted: number;
  files_total: number;
  created_at: string;
}

interface ConversionReport {
  files_converted: number;
  business_rules: string[];
  ambiguities: string[];
  converted_code?: string;
}

// ── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_JOBS: ConversionJob[] = [
  { id: 'j1', project_id: 'p1', source_language: 'COBOL', target_language: 'Java', status: 'completed', progress: 100, files_converted: 24, files_total: 24, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'j2', project_id: 'p2', source_language: 'FORTRAN', target_language: 'Python', status: 'running', progress: 67, files_converted: 8, files_total: 12, created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 'j3', project_id: 'p1', source_language: 'VB6', target_language: 'C#', status: 'queued', progress: 0, files_converted: 0, files_total: 7, created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { id: 'j4', project_id: 'p3', source_language: 'RPG', target_language: 'Node.js', status: 'failed', progress: 34, files_converted: 3, files_total: 9, created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
];

const DEMO_REPORT: ConversionReport = {
  files_converted: 24,
  business_rules: [
    'VAT calculation: 20% on all non-essential goods',
    'Credit limit check before order processing',
    'Customer tier-based discount (5%, 10%, 15%)',
    'Inventory reorder trigger at 20% stock level',
    'Late payment penalty: 2% per month after 30 days',
  ],
  ambiguities: [
    'COMPUTE-INTEREST section — variable rate logic unclear (lines 445–502)',
    'PROCESS-REFUND — conditional branch requires business clarification',
  ],
  converted_code: `// Converted from COBOL: CALCULATE-ORDER-TOTAL
public BigDecimal calculateOrderTotal(Order order) {
    BigDecimal subtotal = order.getItems().stream()
        .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQty())))
        .reduce(BigDecimal.ZERO, BigDecimal::add);

    // Apply tier discount
    BigDecimal discount = getCustomerDiscount(order.getCustomerId());
    subtotal = subtotal.multiply(BigDecimal.ONE.subtract(discount));

    // VAT: 20% on non-essential goods
    BigDecimal vat = subtotal.multiply(new BigDecimal("0.20"));

    return subtotal.add(vat).setScale(2, RoundingMode.HALF_UP);
}`,
};

const SOURCE_LANGS = ['COBOL', 'FORTRAN', 'VB6', 'RPG'];
const TARGET_LANGS = ['Java', 'Python', 'C#', 'Node.js'];

const DEMO_LANG_PAIRS: LangPair[] = [
  { source: 'COBOL', target: 'Java' },
  { source: 'COBOL', target: 'Python' },
  { source: 'FORTRAN', target: 'Python' },
  { source: 'FORTRAN', target: 'C#' },
  { source: 'VB6', target: 'C#' },
  { source: 'VB6', target: 'Node.js' },
  { source: 'RPG', target: 'Java' },
  { source: 'RPG', target: 'Node.js' },
];

const LANG_COLORS: Record<string, string> = {
  COBOL: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  FORTRAN: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  VB6: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  RPG: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  Java: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Python: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'C#': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'Node.js': 'text-green-400 bg-green-500/10 border-green-500/20',
};

// ── Main Component ─────────────────────────────────────────────────────────

export default function LegacyPage() {
  const [jobs, setJobs] = useState<ConversionJob[]>(DEMO_JOBS);
  const [langPairs, setLangPairs] = useState<LangPair[]>(DEMO_LANG_PAIRS);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    project_id: '',
    source_language: 'COBOL',
    target_language: 'Java',
    source_code: '',
  });
  const [converting, setConverting] = useState(false);

  // Job detail modal
  const [selectedJob, setSelectedJob] = useState<ConversionJob | null>(null);
  const [report, setReport] = useState<ConversionReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, langsRes, projRes] = await Promise.all([
        legacyApi.listJobs(),
        legacyApi.getSupportedLanguages(),
        projectsApi.list(),
      ]);
      if (jobsRes.data?.length) setJobs(jobsRes.data);
      if (langsRes.data?.length) setLangPairs(langsRes.data);
      if (projRes.data?.length) setProjects(projRes.data);
    } catch { /* use demo */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConvert = async () => {
    setConverting(true);
    try {
      const ingestRes = await legacyApi.ingest({ ...form });
      const jobId = ingestRes.data?.job_id ?? ingestRes.data?.id;
      if (jobId) {
        await legacyApi.convert({ job_id: jobId, ...form });
      }
      fetchData();
    } catch { /* ignore */ }
    finally { setConverting(false); }
  };

  const handleViewDetail = async (job: ConversionJob) => {
    setSelectedJob(job);
    setReport(null);
    setShowCode(false);
    setReportLoading(true);
    try {
      const res = await legacyApi.getReport(job.id);
      setReport(res.data ?? DEMO_REPORT);
    } catch {
      setReport(DEMO_REPORT);
    } finally { setReportLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-400" />
            Legacy Code Conversion
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">AI-powered conversion from legacy to modern languages (LCC-001 to LCC-007)</p>
        </div>
      </div>

      {/* 1. Supported Languages Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          Supported Language Pairs
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {langPairs.map((pair, i) => (
            <div key={i} className="bg-[#0f172a] border border-slate-800 rounded-xl p-3 flex items-center gap-2 hover:border-slate-700 transition-all">
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${LANG_COLORS[pair.source] ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                {pair.source}
              </span>
              <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${LANG_COLORS[pair.target] ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                {pair.target}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. New Conversion Form */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Play className="w-4 h-4 text-emerald-400" />
          Start New Conversion
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Project</label>
            <select
              value={form.project_id}
              onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="demo">Demo Project</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Source Language</label>
            <select
              value={form.source_language}
              onChange={e => setForm(f => ({ ...f, source_language: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              {SOURCE_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Language</label>
            <select
              value={form.target_language}
              onChange={e => setForm(f => ({ ...f, target_language: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              {TARGET_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Legacy Code</label>
          <textarea
            rows={8}
            value={form.source_code}
            onChange={e => setForm(f => ({ ...f, source_code: e.target.value }))}
            placeholder={`Paste your ${form.source_language} code here...`}
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono resize-y"
          />
        </div>
        <button
          onClick={handleConvert}
          disabled={!form.source_code.trim() || converting}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {converting ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Converting...</>
          ) : (
            <><Play className="w-4 h-4" /> Start Conversion</>
          )}
        </button>
      </div>

      {/* 3. Jobs Table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <FileCode className="w-4 h-4 text-slate-400" />
          Conversion Jobs
        </h3>
        {loading ? (
          <LoadingSpinner size="md" label="Loading jobs..." />
        ) : (
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Target</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 min-w-[140px]">Progress</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Files</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${LANG_COLORS[job.source_language] ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                          {job.source_language}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${LANG_COLORS[job.target_language] ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                          {job.target_language}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Badge status={job.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                job.status === 'completed' ? 'bg-emerald-500' :
                                job.status === 'failed' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-8 shrink-0">{job.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{job.files_converted}/{job.files_total}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewDetail(job)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-400 border border-blue-500/20 hover:border-blue-500/50 rounded-lg bg-blue-500/5 hover:bg-blue-500/15 transition-all"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-400" />
                Job {selectedJob.id}: {selectedJob.source_language} → {selectedJob.target_language}
              </h3>
              <button onClick={() => { setSelectedJob(null); setReport(null); setShowCode(false); }} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {reportLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="md" label="Loading conversion report..." />
                </div>
              ) : report && !showCode ? (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 text-center">
                      <p className="text-xl font-bold text-emerald-400">{report.files_converted}</p>
                      <p className="text-xs text-slate-400">Files Converted</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 text-center">
                      <p className="text-xl font-bold text-amber-400">{report.ambiguities.length}</p>
                      <p className="text-xs text-slate-400">Human Review Needed</p>
                    </div>
                  </div>

                  {/* Business rules */}
                  <div>
                    <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Business Rules Extracted ({report.business_rules.length})
                    </p>
                    <div className="space-y-1.5">
                      {report.business_rules.map((rule, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-xs text-slate-300">
                          <ChevronRight className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                          {rule}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ambiguities */}
                  {report.ambiguities.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        Requires Human Review ({report.ambiguities.length})
                      </p>
                      <div className="space-y-1.5">
                        {report.ambiguities.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-300">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            {a}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setShowCode(true)}
                    className="w-full py-2 text-xs font-medium text-blue-400 border border-blue-500/20 hover:border-blue-500/50 rounded-lg bg-blue-500/5 hover:bg-blue-500/15 transition-all flex items-center justify-center gap-2"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    View Converted Code
                  </button>
                </div>
              ) : report && showCode ? (
                <div>
                  <button
                    onClick={() => setShowCode(false)}
                    className="mb-3 text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    ← Back to Report
                  </button>
                  <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-slate-900 rounded-xl p-4 border border-slate-800 overflow-x-auto">
                    {report.converted_code ?? '// No converted code available'}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
