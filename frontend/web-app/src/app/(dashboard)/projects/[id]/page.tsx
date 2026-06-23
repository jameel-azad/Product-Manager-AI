'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  projectsApi,
  analyticsApi,
  meeApi,
  aiApi,
  requirementsApi,
  testApi,
} from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { Project, ActivityFeedEntry, AIJob } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  ArrowLeft,
  LayoutDashboard,
  FileText,
  Compass,
  Code2,
  TestTube,
  Rocket,
  Activity,
  Wrench,
  ExternalLink,
  Clock,
  Zap,
  Users,
  Settings,
  ChevronRight,
  RefreshCw,
  Cpu,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SdlcPhaseData {
  number: number;
  name: string;
  slug: string;
  icon: React.ReactNode;
  color: string;
  completion: number;
  status: string;
}

type TabId = 'overview' | 'team' | 'settings';

// ─── SDLC Phase definitions ───────────────────────────────────────────────────

const SDLC_PHASE_META: Omit<SdlcPhaseData, 'completion' | 'status'>[] = [
  {
    number: 1,
    name: 'Planning',
    slug: 'planning',
    icon: <LayoutDashboard className="w-4 h-4" />,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: 2,
    name: 'Requirements',
    slug: 'requirements',
    icon: <FileText className="w-4 h-4" />,
    color: 'from-violet-500 to-purple-500',
  },
  {
    number: 3,
    name: 'Design',
    slug: 'design',
    icon: <Compass className="w-4 h-4" />,
    color: 'from-purple-500 to-pink-500',
  },
  {
    number: 4,
    name: 'Development',
    slug: 'development',
    icon: <Code2 className="w-4 h-4" />,
    color: 'from-pink-500 to-rose-500',
  },
  {
    number: 5,
    name: 'Testing / QA',
    slug: 'testing',
    icon: <TestTube className="w-4 h-4" />,
    color: 'from-orange-500 to-amber-500',
  },
  {
    number: 6,
    name: 'Deployment',
    slug: 'deployment',
    icon: <Rocket className="w-4 h-4" />,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    number: 7,
    name: 'Monitoring',
    slug: 'monitoring',
    icon: <Activity className="w-4 h-4" />,
    color: 'from-teal-500 to-cyan-500',
  },
  {
    number: 8,
    name: 'Maintenance',
    slug: 'maintenance',
    icon: <Wrench className="w-4 h-4" />,
    color: 'from-cyan-500 to-blue-500',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(iso: string) {
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  projectId,
  onNavigate,
}: {
  phase: SdlcPhaseData;
  projectId: string;
  onNavigate: (slug: string) => void;
}) {
  const pct = Math.max(0, Math.min(100, phase.completion ?? 0));
  return (
    <button
      onClick={() => onNavigate(phase.slug)}
      className="w-full text-left bg-[#0f172a] border border-slate-800 hover:border-slate-700 rounded-xl p-4 group transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${phase.color} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}
        >
          {phase.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {phase.name}
          </p>
          <p className="text-[10px] text-slate-500">Phase {phase.number}</p>
        </div>
        <Badge status={phase.status || 'active'} className="shrink-0" />
      </div>
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Completion</span>
          <span className="text-[10px] font-semibold text-slate-300">
            {pct}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${phase.color} rounded-full transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
      </div>
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  project,
  phases,
  activity,
  aiJobs,
  stats,
  router,
}: {
  project: Project;
  phases: SdlcPhaseData[];
  activity: ActivityFeedEntry[];
  aiJobs: AIJob[];
  stats: {
    requirements: number;
    backlogItems: number;
    aiJobs: number;
    testCoverage: string;
  };
  router: ReturnType<typeof useRouter>;
}) {
  const id = project.id;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Requirements"
          value={stats.requirements}
          icon={<FileText className="w-4 h-4" />}
          color="text-violet-400"
        />
        <StatCard
          label="Backlog Items"
          value={stats.backlogItems}
          icon={<LayoutDashboard className="w-4 h-4" />}
          color="text-blue-400"
        />
        <StatCard
          label="AI Jobs"
          value={stats.aiJobs}
          icon={<Cpu className="w-4 h-4" />}
          color="text-emerald-400"
        />
        <StatCard
          label="Test Coverage"
          value={stats.testCoverage}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="text-amber-400"
        />
      </div>

      {/* SDLC Phase Progress */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">
            SDLC Phase Progress
          </h3>
          <span className="text-[10px] text-slate-500">8 phases</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {phases.map((phase) => (
            <PhaseCard
              key={phase.slug}
              phase={phase}
              projectId={id}
              onNavigate={(slug) => router.push(`/projects/${id}/${slug}`)}
            />
          ))}
        </div>
      </div>

      {/* Bottom row: Activity + AI Engines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Recent Activity
            </h3>
          </div>
          {activity.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              No recent activity for this project.
            </p>
          ) : (
            <div className="space-y-2.5">
              {activity.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800/60"
                >
                  <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap className="w-3 h-3 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200">
                      {event.action_type}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-slate-600" />
                      <span className="text-[10px] text-slate-500">
                        {relativeTime(event.timestamp)}
                      </span>
                    </div>
                  </div>
                  <Badge status={event.status} className="shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Engines */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-purple-400" />
            Active AI Jobs
          </h3>
          {aiJobs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              No active AI jobs.
            </p>
          ) : (
            <div className="space-y-2.5">
              {aiJobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/60"
                >
                  <div className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Cpu className="w-3 h-3 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wide">
                      {job.engine}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {job.trigger_source}
                    </p>
                  </div>
                  <Badge status={job.status} className="shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Tab (placeholder) ───────────────────────────────────────────────

function SettingsTab({ project }: { project: Project }) {
  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-semibold text-white">Project Settings</h3>
      <div className="space-y-3">
        {[
          { label: 'Project ID', value: project.id },
          { label: 'Owner ID', value: project.owner_id },
          { label: 'Tenant ID', value: project.tenant_id },
          { label: 'Created', value: formatDate(project.created_at) },
          { label: 'Updated', value: formatDate(project.updated_at) },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-xs text-slate-400">{label}</span>
            <span className="text-xs font-mono text-slate-300">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<SdlcPhaseData[]>([]);
  const [activity, setActivity] = useState<ActivityFeedEntry[]>([]);
  const [aiJobs, setAiJobs] = useState<AIJob[]>([]);
  const [stats, setStats] = useState({
    requirements: 0,
    backlogItems: 0,
    aiJobs: 0,
    testCoverage: '—',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      // Project details
      const projectRes = await projectsApi.get(id);
      const proj: Project = projectRes.data;
      setProject(proj);

      // SDLC progress
      let phaseMap: Record<string, number> = {};
      try {
        const sdlcRes = await analyticsApi.getSdlcProgress(id);
        const raw = sdlcRes.data?.phases ?? sdlcRes.data ?? {};
        // Expect { planning: 60, requirements: 80, ... } or array
        if (Array.isArray(raw)) {
          raw.forEach((p: any) => {
            phaseMap[p.slug ?? p.name?.toLowerCase()] = p.completion ?? p.percentage ?? 0;
          });
        } else {
          phaseMap = raw;
        }
      } catch {
        // Use 0 completion for all phases
      }

      const builtPhases: SdlcPhaseData[] = SDLC_PHASE_META.map((m) => ({
        ...m,
        completion: phaseMap[m.slug] ?? phaseMap[m.name.toLowerCase()] ?? 0,
        status: 'active',
      }));
      setPhases(builtPhases);

      // Activity feed
      try {
        const actRes = await meeApi.getActivityFeed({
          project_id: id,
          limit: 5,
        });
        const events: ActivityFeedEntry[] =
          actRes.data?.events ?? actRes.data ?? [];
        setActivity(events);
      } catch {
        setActivity([]);
      }

      // AI Jobs
      try {
        const jobsRes = await aiApi.listJobs(id);
        const jobs: AIJob[] = jobsRes.data?.items ?? jobsRes.data ?? [];
        setAiJobs(jobs.filter((j) => ['running', 'queued'].includes(j.status)));
      } catch {
        setAiJobs([]);
      }

      // Quick stats
      try {
        const [reqRes, backlogRes, aiStatsRes, coverageRes] =
          await Promise.allSettled([
            requirementsApi.list(id),
            projectsApi.getBacklog(id),
            aiApi.getStats(id),
            testApi.getCoverage(id),
          ]);

        setStats({
          requirements:
            reqRes.status === 'fulfilled'
              ? (reqRes.value.data?.total ?? reqRes.value.data?.length ?? 0)
              : 0,
          backlogItems:
            backlogRes.status === 'fulfilled'
              ? (backlogRes.value.data?.total ??
                backlogRes.value.data?.length ??
                0)
              : 0,
          aiJobs:
            aiStatsRes.status === 'fulfilled'
              ? (aiStatsRes.value.data?.total_jobs ?? 0)
              : 0,
          testCoverage:
            coverageRes.status === 'fulfilled'
              ? `${coverageRes.value.data?.line_coverage ?? coverageRes.value.data?.coverage ?? 0}%`
              : '—',
        });
      } catch {
        // Keep defaults
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load project.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" label="Loading project…" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-sm text-red-400 mb-3">
          {error ?? 'Project not found.'}
        </p>
        <button
          onClick={() => router.push('/projects')}
          className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'team', label: 'Team', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Back ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/projects')}
          className="w-8 h-8 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/40 flex items-center justify-center text-slate-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-500">Projects /</span>
        <span className="text-xs text-slate-300 truncate max-w-[200px]">
          {project.name}
        </span>
      </div>

      {/* ── Project Header ───────────────────────────────────────────────── */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Code2 className="w-6 h-6 text-white" />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-white">{project.name}</h2>
              <Badge status={project.status} />
            </div>
            {project.description && (
              <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                {project.description}
              </p>
            )}

            {/* Tech Stack */}
            {project.tech_stack && project.tech_stack.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {project.tech_stack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300"
                  >
                    <Code2 className="w-2.5 h-2.5 text-blue-400" />
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
              {project.repository_url && (
                <a
                  href={project.repository_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Repository
                </a>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Created {formatDate(project.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Updated {relativeTime(project.updated_at)}
              </span>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            className="self-start inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-800 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 -mb-px transition-all ${
              activeTab === tab.id
                ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewTab
          project={project}
          phases={phases}
          activity={activity}
          aiJobs={aiJobs}
          stats={stats}
          router={router}
        />
      )}
      {activeTab === 'team' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-300 mb-1">
            Team management coming soon
          </p>
          <p className="text-xs text-slate-500">
            Invite team members and manage roles for this project.
          </p>
        </div>
      )}
      {activeTab === 'settings' && <SettingsTab project={project} />}
    </div>
  );
}
