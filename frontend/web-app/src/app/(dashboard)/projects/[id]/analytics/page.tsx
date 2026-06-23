'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { analyticsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  ArrowLeft,
  FileText,
  LayoutDashboard,
  Cpu,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Zap,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  requirements_completed: number;
  backlog_done: number;
  ai_jobs: number;
  test_coverage: number;
}

interface VelocityEntry {
  sprint: string;
  story_points: number;
  completed: number;
}

interface SdlcPhaseProgress {
  name: string;
  completion: number;
  color: string;
}

interface DeploymentEntry {
  date: string;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  blue: '#3b82f6',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  pink: '#ec4899',
  cyan: '#06b6d4',
};

const SDLC_PHASE_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.violet,
  '#a855f7',
  '#f43f5e',
  '#f97316',
  CHART_COLORS.emerald,
  '#14b8a6',
  CHART_COLORS.cyan,
];

const tooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '11px',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}) {
  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 card-glow hover:border-slate-700 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <TrendingUp className="w-3.5 h-3.5 text-emerald-500/60" />
      </div>
      <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {trend && <p className="text-xs text-emerald-400/80">{trend}</p>}
    </div>
  );
}

// ─── Progress Bar Row ─────────────────────────────────────────────────────────

function PhaseProgressRow({
  phase,
  index,
}: {
  phase: SdlcPhaseProgress;
  index: number;
}) {
  const pct = Math.max(0, Math.min(100, phase.completion));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300">
          <span className="text-[10px] text-slate-500 mr-1.5">
            {String(index + 1).padStart(2, '0')}
          </span>
          {phase.name}
        </span>
        <span className="text-xs font-semibold text-slate-200">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: phase.color,
          }}
        />
      </div>
    </div>
  );
}

// ─── Default / fallback data ──────────────────────────────────────────────────

const DEFAULT_VELOCITY: VelocityEntry[] = [
  { sprint: 'Sprint 1', story_points: 20, completed: 18 },
  { sprint: 'Sprint 2', story_points: 25, completed: 22 },
  { sprint: 'Sprint 3', story_points: 30, completed: 28 },
  { sprint: 'Sprint 4', story_points: 28, completed: 30 },
  { sprint: 'Sprint 5', story_points: 35, completed: 33 },
  { sprint: 'Sprint 6', story_points: 32, completed: 35 },
];

const DEFAULT_DEPLOYMENTS: DeploymentEntry[] = [
  { date: 'Jun 1', count: 2 },
  { date: 'Jun 5', count: 4 },
  { date: 'Jun 10', count: 3 },
  { date: 'Jun 15', count: 6 },
  { date: 'Jun 20', count: 5 },
  { date: 'Jun 22', count: 7 },
];

const DEFAULT_SDLC_PHASES: SdlcPhaseProgress[] = [
  { name: 'Planning', completion: 85, color: SDLC_PHASE_COLORS[0] },
  { name: 'Requirements', completion: 72, color: SDLC_PHASE_COLORS[1] },
  { name: 'Design', completion: 60, color: SDLC_PHASE_COLORS[2] },
  { name: 'Development', completion: 45, color: SDLC_PHASE_COLORS[3] },
  { name: 'Testing / QA', completion: 38, color: SDLC_PHASE_COLORS[4] },
  { name: 'Deployment', completion: 25, color: SDLC_PHASE_COLORS[5] },
  { name: 'Monitoring', completion: 15, color: SDLC_PHASE_COLORS[6] },
  { name: 'Maintenance', completion: 5, color: SDLC_PHASE_COLORS[7] },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectAnalyticsPage() {
  const router = useRouter();
  const { id: projectId } = useParams<{ id: string }>();

  const [kpis, setKpis] = useState<KpiData>({
    requirements_completed: 0,
    backlog_done: 0,
    ai_jobs: 0,
    test_coverage: 0,
  });
  const [velocity, setVelocity] = useState<VelocityEntry[]>(DEFAULT_VELOCITY);
  const [sdlcPhases, setSdlcPhases] = useState<SdlcPhaseProgress[]>(DEFAULT_SDLC_PHASES);
  const [deployments, setDeployments] = useState<DeploymentEntry[]>(DEFAULT_DEPLOYMENTS);
  const [aiProductivity, setAiProductivity] = useState({
    aiGenerated: 0,
    manual: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, velocityRes, sdlcRes] = await Promise.allSettled([
        analyticsApi.getKpis(projectId),
        analyticsApi.getVelocity(projectId),
        analyticsApi.getSdlcProgress(projectId),
      ]);

      // KPIs
      if (kpisRes.status === 'fulfilled') {
        const d = kpisRes.value.data;
        setKpis({
          requirements_completed: d?.requirements_completed ?? d?.requirements ?? 0,
          backlog_done: d?.backlog_done ?? d?.backlog_items_done ?? 0,
          ai_jobs: d?.ai_jobs ?? d?.ai_jobs_completed ?? 0,
          test_coverage: d?.test_coverage ?? d?.coverage ?? 0,
        });
        // AI vs Human productivity
        const aiPct = d?.ai_generated_percentage ?? d?.ai_pct ?? 68;
        setAiProductivity({
          aiGenerated: aiPct,
          manual: 100 - aiPct,
        });
      }

      // Velocity
      if (velocityRes.status === 'fulfilled') {
        const rawVelocity = velocityRes.value.data?.sprints ??
          velocityRes.value.data?.velocity ??
          velocityRes.value.data ?? [];
        if (Array.isArray(rawVelocity) && rawVelocity.length > 0) {
          setVelocity(
            rawVelocity.map((s: any) => ({
              sprint: s.name ?? s.sprint ?? `Sprint ${s.number ?? ''}`,
              story_points: s.planned_points ?? s.story_points ?? s.planned ?? 0,
              completed: s.completed_points ?? s.completed ?? 0,
            }))
          );
        }
      }

      // SDLC Progress
      if (sdlcRes.status === 'fulfilled') {
        const rawPhases = sdlcRes.value.data?.phases ?? sdlcRes.value.data ?? {};
        if (Array.isArray(rawPhases) && rawPhases.length > 0) {
          setSdlcPhases(
            rawPhases.map((p: any, i: number) => ({
              name: p.name ?? p.slug ?? `Phase ${i + 1}`,
              completion: p.completion ?? p.percentage ?? 0,
              color: SDLC_PHASE_COLORS[i % SDLC_PHASE_COLORS.length],
            }))
          );
        } else if (typeof rawPhases === 'object') {
          const entries = Object.entries(rawPhases);
          if (entries.length > 0) {
            setSdlcPhases(
              entries.map(([name, val], i) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                completion: typeof val === 'number' ? val : 0,
                color: SDLC_PHASE_COLORS[i % SDLC_PHASE_COLORS.length],
              }))
            );
          }
        }
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load analytics data.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const aiPieData = [
    { name: 'AI Generated', value: aiProductivity.aiGenerated },
    { name: 'Manual', value: aiProductivity.manual },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
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
            <h2 className="text-xl font-bold text-white">Project Analytics</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              AI-driven SDLC metrics &amp; performance
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" label="Loading analytics…" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Requirements Completed"
              value={kpis.requirements_completed}
              icon={<FileText className="w-5 h-5" />}
              color="text-violet-400"
              trend="AI-extracted &amp; approved"
            />
            <KpiCard
              label="Backlog Done"
              value={kpis.backlog_done}
              icon={<LayoutDashboard className="w-5 h-5" />}
              color="text-blue-400"
              trend="Stories closed"
            />
            <KpiCard
              label="AI Jobs"
              value={kpis.ai_jobs}
              icon={<Cpu className="w-5 h-5" />}
              color="text-emerald-400"
              trend="Across all engines"
            />
            <KpiCard
              label="Test Coverage"
              value={`${kpis.test_coverage}%`}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="text-amber-400"
              trend="Automated test suite"
            />
          </div>

          {/* ── Sprint Velocity + SDLC Progress ────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Sprint Velocity Bar Chart */}
            <div className="lg:col-span-3 bg-[#0f172a] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Sprint Velocity
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={velocity}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="sprint"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="story_points"
                    name="Planned"
                    fill={CHART_COLORS.blue}
                    radius={[4, 4, 0, 0]}
                    opacity={0.7}
                  />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill={CHART_COLORS.emerald}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* SDLC Phase Progress */}
            <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Zap className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  SDLC Progress
                </h3>
              </div>
              <div className="space-y-3.5">
                {sdlcPhases.map((phase, i) => (
                  <PhaseProgressRow key={phase.name} phase={phase} index={i} />
                ))}
              </div>
            </div>
          </div>

          {/* ── AI vs Human + Deployment Frequency ─────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* AI vs Human Productivity */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Cpu className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  AI vs Human Productivity
                </h3>
              </div>
              <div className="flex gap-6 items-center">
                {/* Pie chart */}
                <div className="shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={aiPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell fill={CHART_COLORS.blue} />
                        <Cell fill="#334155" />
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number) => [`${v}%`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Two columns */}
                <div className="flex-1 space-y-4">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-blue-300">
                        AI Generated
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {aiProductivity.aiGenerated}%
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Requirements, code, tests
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-300">
                        Manual
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {aiProductivity.manual}%
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Human-authored work
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Deployment Frequency */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Deployment Frequency
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={deployments}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Deployments"
                    stroke={CHART_COLORS.emerald}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.emerald, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
