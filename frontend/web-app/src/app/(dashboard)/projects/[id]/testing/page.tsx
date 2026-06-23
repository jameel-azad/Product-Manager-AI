'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { testApi, requirementsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  TestTube,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  SkipForward,
  BarChart3,
  Clock,
  Sparkles,
  AlertCircle,
  ChevronDown,
  FileText,
  X,
  Layers,
  GitBranch,
  TrendingUp,
  Shield,
  Activity,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  title: string;
  type: string;
  requirement_id?: string;
  requirement_title?: string;
  status: string;
  ai_generated: boolean;
  priority?: string;
}

interface TestRun {
  id: string;
  status: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  coverage_percent?: number;
  duration_ms?: number;
  created_at: string;
  completed_at?: string;
}

interface CoverageData {
  total_tests: number;
  pass_rate: number;
  coverage_percent: number;
  failed_tests: number;
}

interface Requirement {
  id: string;
  title: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(iso: string) {
  try {
    return format(new Date(iso), 'MMM d, HH:mm');
  } catch {
    return iso;
  }
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function durationLabel(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function passRateColor(rate: number) {
  if (rate >= 90) return '#10b981'; // emerald
  if (rate >= 70) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon, color, sub }: StatCardProps) {
  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
      <div className={`w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center ${color} mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Coverage Gauge ───────────────────────────────────────────────────────────

function CoverageGauge({ percent }: { percent: number }) {
  const color = passRateColor(percent);
  const data = [{ value: percent, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <RadialBar
              dataKey="value"
              cornerRadius={8}
              background={{ fill: '#1e293b' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{Math.round(percent)}%</span>
          <span className="text-xs text-slate-400">Coverage</span>
        </div>
      </div>
    </div>
  );
}

// ─── Run History Chart ────────────────────────────────────────────────────────

function RunHistoryChart({ runs }: { runs: TestRun[] }) {
  const data = runs
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      name: formatTs(r.created_at).replace(/ /g, '\n'),
      passed: r.passed,
      failed: r.failed,
      skipped: r.skipped,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
        No test runs yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="passed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
        <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
        <Bar dataKey="skipped" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  passed,
  failed,
  skipped,
  total,
}: {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}) {
  if (total === 0) return null;
  const pPct = (passed / total) * 100;
  const fPct = (failed / total) * 100;
  const sPct = (skipped / total) * 100;

  return (
    <div className="space-y-1.5">
      <div className="h-2.5 rounded-full overflow-hidden bg-slate-800 flex">
        <div
          className="bg-emerald-500 transition-all duration-700"
          style={{ width: `${pPct}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-700"
          style={{ width: `${fPct}%` }}
        />
        <div
          className="bg-slate-600 transition-all duration-700"
          style={{ width: `${sPct}%` }}
        />
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          {passed} passed
        </span>
        <span className="flex items-center gap-1 text-red-400">
          <XCircle className="w-3 h-3" />
          {failed} failed
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          <SkipForward className="w-3 h-3" />
          {skipped} skipped
        </span>
      </div>
    </div>
  );
}

// ─── Generate Modal ───────────────────────────────────────────────────────────

function GenerateModal({
  projectId,
  requirements,
  onClose,
  onGenerated,
}: {
  projectId: string;
  requirements: Requirement[];
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [reqId, setReqId] = useState('all');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<TestCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = { project_id: projectId };
      if (reqId !== 'all') payload.requirement_id = reqId;
      const res = await testApi.generateTests(payload);
      const tests: TestCase[] = res.data?.test_cases ?? res.data?.cases ?? res.data ?? [];
      setPreview(tests);
      onGenerated();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to generate tests.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            Generate AI Test Cases
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Source Requirement
            </label>
            <div className="relative">
              <select
                value={reqId}
                onChange={(e) => setReqId(e.target.value)}
                className="w-full appearance-none px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors pr-8"
              >
                <option value="all">All requirements</option>
                {requirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Preview */}
          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Generated {preview.length} test case{preview.length !== 1 ? 's' : ''}
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {preview.map((tc, idx) => (
                  <div
                    key={tc.id ?? idx}
                    className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800"
                  >
                    <p className="text-xs text-slate-200">{tc.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 capitalize font-mono">
                        {tc.type}
                      </span>
                      <Badge status={tc.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
            >
              Close
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-all"
            >
              {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loading ? 'Generating...' : 'Generate Tests'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestingPage() {
  const { id } = useParams<{ id: string }>();

  const [cases, setCases] = useState<TestCase[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingCoverage, setLoadingCoverage] = useState(true);

  const [executing, setExecuting] = useState(false);
  const [runProgress, setRunProgress] = useState<TestRun | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const [changedFiles, setChangedFiles] = useState('');
  const [regressionTests, setRegressionTests] = useState<TestCase[]>([]);
  const [loadingRegression, setLoadingRegression] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchCases = useCallback(async () => {
    try {
      const res = await testApi.listCases(id);
      const data: TestCase[] = res.data?.items ?? res.data ?? [];
      setCases(data);
    } catch {
      setCases([]);
    } finally {
      setLoadingCases(false);
    }
  }, [id]);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await testApi.listRuns(id);
      const data: TestRun[] = res.data?.items ?? res.data ?? [];
      setRuns(data);
      // Update run progress if executing
      if (executing) {
        const latest = data[0];
        if (latest) {
          setRunProgress(latest);
          if (['completed', 'failed', 'error'].includes(latest.status)) {
            setExecuting(false);
          }
        }
      }
    } catch {
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, [id, executing]);

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await testApi.getCoverage(id);
      const d = res.data ?? {};
      setCoverage({
        total_tests: d.total_tests ?? d.total ?? 0,
        pass_rate: d.pass_rate ?? d.pass_percentage ?? 0,
        coverage_percent: d.coverage_percent ?? d.coverage ?? 0,
        failed_tests: d.failed_tests ?? d.failed ?? 0,
      });
    } catch {
      setCoverage(null);
    } finally {
      setLoadingCoverage(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCases();
    fetchRuns();
    fetchCoverage();
    requirementsApi
      .list(id)
      .then((res) => {
        const data: Requirement[] = res.data?.items ?? res.data ?? [];
        setRequirements(data);
      })
      .catch(() => setRequirements([]));
  }, [id, fetchCases, fetchRuns, fetchCoverage]);

  // Poll when executing
  useEffect(() => {
    if (!executing) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(fetchRuns, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [executing, fetchRuns]);

  // ── Execute ────────────────────────────────────────────────────────────────

  const handleExecuteTests = async () => {
    setExecuting(true);
    setRunProgress(null);
    try {
      await testApi.executeTests({ project_id: id });
    } catch {
      setExecuting(false);
    }
  };

  // ── Regression ────────────────────────────────────────────────────────────

  const handleGetRegressionTests = async () => {
    if (!changedFiles.trim()) return;
    setLoadingRegression(true);
    try {
      const files = changedFiles.split(',').map((f) => f.trim()).filter(Boolean);
      // Fallback: filter cases by file name matches in title
      const matched = cases.filter((tc) =>
        files.some((f) => tc.title.toLowerCase().includes(f.toLowerCase()))
      );
      setRegressionTests(matched.length > 0 ? matched : cases.slice(0, 5));
    } catch {
      setRegressionTests([]);
    } finally {
      setLoadingRegression(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const cov = coverage ?? {
    total_tests: cases.length,
    pass_rate: runs[0] ? Math.round((runs[0].passed / Math.max(runs[0].total, 1)) * 100) : 0,
    coverage_percent: 0,
    failed_tests: runs[0]?.failed ?? 0,
  };

  const latestRun = runs[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
              <TestTube className="w-4 h-4 text-white" />
            </div>
            Testing & QA
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            SDLC Phase 5 — AI-generated tests, execution and coverage reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchCases(); fetchRuns(); fetchCoverage(); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Tests
          </button>
          <button
            onClick={handleExecuteTests}
            disabled={executing || cases.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
          >
            {executing ? <LoadingSpinner size="sm" /> : <Play className="w-3.5 h-3.5" />}
            {executing ? 'Running...' : 'Run Tests'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {loadingCoverage ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size="md" label="Loading stats..." />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Tests"
            value={cov.total_tests}
            icon={<FileText className="w-4 h-4" />}
            color="text-blue-400"
          />
          <StatCard
            label="Pass Rate"
            value={`${Math.round(cov.pass_rate)}%`}
            icon={<TrendingUp className="w-4 h-4" />}
            color="text-emerald-400"
          />
          <StatCard
            label="Coverage"
            value={`${Math.round(cov.coverage_percent)}%`}
            icon={<Shield className="w-4 h-4" />}
            color="text-violet-400"
          />
          <StatCard
            label="Failed Tests"
            value={cov.failed_tests}
            icon={<XCircle className="w-4 h-4" />}
            color="text-red-400"
          />
        </div>
      )}

      {/* Execute Progress */}
      {executing && (
        <div className="bg-[#0f172a] border border-amber-500/25 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-amber-400">Test Execution in Progress</h3>
          </div>
          {runProgress ? (
            <>
              <ProgressBar
                passed={runProgress.passed}
                failed={runProgress.failed}
                skipped={runProgress.skipped}
                total={runProgress.total}
              />
              <p className="text-xs text-slate-500 mt-2">
                {runProgress.passed + runProgress.failed + runProgress.skipped} / {runProgress.total} tests completed
              </p>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <LoadingSpinner size="sm" />
              <span className="text-xs text-slate-400">Initializing test runner...</span>
            </div>
          )}
        </div>
      )}

      {/* Latest run result */}
      {!executing && latestRun && latestRun.total > 0 && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Latest Run Results
            </h3>
            <div className="flex items-center gap-2">
              <Badge status={latestRun.status} />
              <span className="text-xs text-slate-500">{relativeTime(latestRun.created_at)}</span>
            </div>
          </div>
          <ProgressBar
            passed={latestRun.passed}
            failed={latestRun.failed}
            skipped={latestRun.skipped}
            total={latestRun.total}
          />
          {latestRun.coverage_percent !== undefined && (
            <p className="text-xs text-slate-500 mt-2">
              Coverage: {Math.round(latestRun.coverage_percent)}% · Duration: {durationLabel(latestRun.duration_ms)}
            </p>
          )}
        </div>
      )}

      {/* Test Cases Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            Test Cases
            <span className="text-xs text-slate-600">({cases.length})</span>
          </h3>
        </div>
        {loadingCases ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="md" label="Loading test cases..." />
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No test cases yet. Click &ldquo;Generate Tests&rdquo; to create them with AI.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Title', 'Type', 'Requirement', 'Status', 'AI Generated'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {cases.map((tc) => (
                  <tr key={tc.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 pr-4 text-slate-200 max-w-[240px]">
                      <p className="truncate text-sm">{tc.title}</p>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 capitalize">
                        {tc.type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500 max-w-[180px] truncate">
                      {tc.requirement_title ? (
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3 shrink-0" />
                          {tc.requirement_title}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge status={tc.status} />
                    </td>
                    <td className="py-2.5">
                      {tc.ai_generated ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">Manual</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Coverage + Run History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coverage Gauge */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            Test Coverage
          </h3>
          <div className="flex flex-col items-center gap-4">
            <CoverageGauge percent={cov.coverage_percent} />
            <div className="grid grid-cols-3 gap-4 text-center w-full">
              <div>
                <p className="text-lg font-bold text-emerald-400">{cov.total_tests}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-400">{Math.round(cov.pass_rate)}%</p>
                <p className="text-xs text-slate-500">Pass Rate</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-400">{cov.failed_tests}</p>
                <p className="text-xs text-slate-500">Failed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Run History Chart */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            Run History
          </h3>
          {loadingRuns ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <RunHistoryChart runs={runs} />
          )}
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Passed
            </span>
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <span className="w-2 h-2 rounded-sm bg-red-500" /> Failed
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-sm bg-slate-600" /> Skipped
            </span>
          </div>
        </div>
      </div>

      {/* Test Runs History Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Test Run History
        </h3>
        {loadingRuns ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="sm" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No test runs yet. Click &ldquo;Run Tests&rdquo; to execute.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Status', 'Passed', 'Failed', 'Skipped', 'Coverage', 'Duration', 'Run At'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 pr-4">
                      <Badge status={run.status} />
                    </td>
                    <td className="py-2.5 pr-4 text-emerald-400 font-mono text-xs">{run.passed}</td>
                    <td className="py-2.5 pr-4 text-red-400 font-mono text-xs">{run.failed}</td>
                    <td className="py-2.5 pr-4 text-slate-400 font-mono text-xs">{run.skipped}</td>
                    <td className="py-2.5 pr-4 text-xs text-violet-400">
                      {run.coverage_percent != null ? `${Math.round(run.coverage_percent)}%` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-400 font-mono">
                      {durationLabel(run.duration_ms)}
                    </td>
                    <td className="py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatTs(run.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Regression Test Selection */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-amber-400" />
          Regression Test Selector
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Changed Files (comma separated)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={changedFiles}
                onChange={(e) => setChangedFiles(e.target.value)}
                placeholder="e.g. auth.service.ts, user.controller.ts, payment.module.ts"
                className="flex-1 px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
              <button
                onClick={handleGetRegressionTests}
                disabled={!changedFiles.trim() || loadingRegression}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all whitespace-nowrap"
              >
                {loadingRegression ? <LoadingSpinner size="sm" /> : <Shield className="w-4 h-4" />}
                Get Tests
              </button>
            </div>
          </div>

          {regressionTests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                {regressionTests.length} recommended regression test{regressionTests.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {regressionTests.map((tc) => (
                  <div
                    key={tc.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800"
                  >
                    <p className="text-xs text-slate-200 truncate mr-3">{tc.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-500 capitalize">{tc.type}</span>
                      <Badge status={tc.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateModal
          projectId={id}
          requirements={requirements}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={fetchCases}
        />
      )}
    </div>
  );
}
