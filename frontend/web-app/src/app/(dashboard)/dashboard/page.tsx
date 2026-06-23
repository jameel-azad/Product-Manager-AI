'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { analyticsApi, meeApi } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Compass,
  Code2,
  TestTube,
  Rocket,
  Activity,
  BarChart3,
  Wrench,
  Plus,
  ArrowRight,
  Cpu,
  CheckCircle2,
  TrendingUp,
  Zap,
  RefreshCw,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}

interface SdlcPhase {
  number: number;
  name: string;
  icon: React.ReactNode;
  description: string;
  coverage: string[];
  status: string;
  href: string;
  color: string;
}

interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  status: string;
  project?: string;
}

// ─── Static SDLC phase definitions ─────────────────────────────────────────

const SDLC_PHASES: SdlcPhase[] = [
  {
    number: 1,
    name: 'Planning',
    icon: <LayoutDashboard className="w-5 h-5" />,
    description: 'Project scoping & backlog generation',
    coverage: ['Sprint planning', 'Backlog AI', 'Story points'],
    status: 'active',
    href: '/projects',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: 2,
    name: 'Requirements',
    icon: <FileText className="w-5 h-5" />,
    description: 'AI-driven requirement extraction',
    coverage: ['NLP extraction', 'Conflict analysis', 'BRD generation'],
    status: 'active',
    href: '/requirements',
    color: 'from-violet-500 to-purple-500',
  },
  {
    number: 3,
    name: 'Design',
    icon: <Compass className="w-5 h-5" />,
    description: 'Architecture & tech stack recommendations',
    coverage: ['Tech stack AI', 'API contracts', 'DB schema'],
    status: 'active',
    href: '/projects',
    color: 'from-purple-500 to-pink-500',
  },
  {
    number: 4,
    name: 'Development',
    icon: <Code2 className="w-5 h-5" />,
    description: 'Code generation via APIX, UIX, IntegrationX',
    coverage: ['API generation', 'UI scaffolding', 'Mobile code'],
    status: 'active',
    href: '/projects',
    color: 'from-pink-500 to-rose-500',
  },
  {
    number: 5,
    name: 'Testing / QA',
    icon: <TestTube className="w-5 h-5" />,
    description: 'Automated test case generation & execution',
    coverage: ['Test gen AI', 'Coverage reports', 'Regression'],
    status: 'active',
    href: '/tests',
    color: 'from-orange-500 to-amber-500',
  },
  {
    number: 6,
    name: 'Deployment',
    icon: <Rocket className="w-5 h-5" />,
    description: 'CI/CD pipeline orchestration',
    coverage: ['Pipeline AI', 'K8s deploy', 'Release notes'],
    status: 'active',
    href: '/deployments',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    number: 7,
    name: 'Monitoring',
    icon: <Activity className="w-5 h-5" />,
    description: 'MEE — Multi-dimensional Evidence Engine',
    coverage: ['Anomaly detection', 'KPI tracking', 'Alerts'],
    status: 'active',
    href: '/mee',
    color: 'from-teal-500 to-cyan-500',
  },
  {
    number: 8,
    name: 'Maintenance',
    icon: <Wrench className="w-5 h-5" />,
    description: 'Legacy conversion & continuous improvement',
    coverage: ['Legacy AI', 'Tech debt', 'Analytics'],
    status: 'active',
    href: '/analytics',
    color: 'from-cyan-500 to-blue-500',
  },
];

// ─── Demo fallback data ─────────────────────────────────────────────────────

const DEMO_STATS: StatCard[] = [
  {
    label: 'Total Projects',
    value: 12,
    icon: <FolderOpen className="w-5 h-5" />,
    color: 'text-blue-400',
    trend: '+3 this month',
  },
  {
    label: 'Requirements',
    value: 147,
    icon: <FileText className="w-5 h-5" />,
    color: 'text-violet-400',
    trend: '+24 this week',
  },
  {
    label: 'AI Jobs Completed',
    value: 89,
    icon: <Cpu className="w-5 h-5" />,
    color: 'text-emerald-400',
    trend: '96% success rate',
  },
  {
    label: 'Test Coverage',
    value: '87%',
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: 'text-amber-400',
    trend: '+5% vs last sprint',
  },
];

const DEMO_ACTIVITY: ActivityEvent[] = [
  {
    id: '1',
    type: 'ai_job',
    message: 'Requirements extracted from product_spec.pdf',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'completed',
    project: 'E-Commerce Platform',
  },
  {
    id: '2',
    type: 'deployment',
    message: 'Pipeline xccelera-api:v2.4.1 deployed to staging',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    status: 'success',
    project: 'API Gateway',
  },
  {
    id: '3',
    type: 'test',
    message: '47 test cases generated for UserAuth module',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    status: 'completed',
    project: 'Auth Service',
  },
  {
    id: '4',
    type: 'sprint',
    message: 'Sprint 12 planned — 23 stories assigned',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    project: 'Mobile App',
  },
  {
    id: '5',
    type: 'legacy',
    message: 'Legacy COBOL module converted to TypeScript',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    project: 'Legacy Migration',
  },
];

// ─── Helper: relative time ──────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<StatCard[]>(DEMO_STATS);
  const [activity, setActivity] = useState<ActivityEvent[]>(DEMO_ACTIVITY);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  const fetchData = useCallback(async () => {
    // Fetch platform summary
    try {
      const res = await analyticsApi.getPlatformSummary();
      const d = res.data;
      setStats([
        {
          label: 'Total Projects',
          value: d.total_projects ?? 12,
          icon: <FolderOpen className="w-5 h-5" />,
          color: 'text-blue-400',
          trend: `+${d.new_projects_this_month ?? 3} this month`,
        },
        {
          label: 'Requirements',
          value: d.total_requirements ?? 147,
          icon: <FileText className="w-5 h-5" />,
          color: 'text-violet-400',
          trend: `+${d.new_requirements_this_week ?? 24} this week`,
        },
        {
          label: 'AI Jobs Completed',
          value: d.ai_jobs_completed ?? 89,
          icon: <Cpu className="w-5 h-5" />,
          color: 'text-emerald-400',
          trend: `${d.ai_success_rate ?? 96}% success rate`,
        },
        {
          label: 'Test Coverage',
          value: `${d.avg_test_coverage ?? 87}%`,
          icon: <CheckCircle2 className="w-5 h-5" />,
          color: 'text-amber-400',
          trend: `+${d.coverage_delta ?? 5}% vs last sprint`,
        },
      ]);
    } catch {
      // Use demo data on failure
    } finally {
      setIsLoadingStats(false);
    }

    // Fetch activity feed
    try {
      const res = await meeApi.getActivityFeed({ limit: 5 });
      const events: ActivityEvent[] = (res.data?.events ?? res.data ?? []).map(
        (e: any) => ({
          id: e.id ?? String(Math.random()),
          type: e.event_type ?? e.type ?? 'event',
          message: e.message ?? e.description ?? '',
          timestamp: e.timestamp ?? e.created_at ?? new Date().toISOString(),
          status: e.status ?? 'completed',
          project: e.project_name ?? e.project ?? undefined,
        })
      );
      if (events.length > 0) setActivity(events);
    } catch {
      // Use demo data on failure
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Welcome header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            Welcome back,{' '}
            <span className="gradient-text">
              {user?.full_name?.split(' ')[0] ?? 'there'}
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => fetchData()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ── AI Status banner ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-900/30 via-purple-900/20 to-blue-900/30 p-5">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-500 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-glow-blue">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                AI Platform Status
              </p>
              <p className="text-xs text-slate-400">All systems operational</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 sm:ml-auto">
            {[
              { value: '8', label: 'SDLC Phases Covered' },
              { value: '13', label: 'AI Services Active' },
              { value: '132', label: 'API Endpoints' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-xl font-bold gradient-text">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="status-dot status-dot-green animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      {isLoadingStats ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" label="Loading metrics..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 card-glow hover:border-slate-700 transition-all cursor-default"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center ${stat.color}`}
                >
                  {stat.icon}
                </div>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500/60" />
              </div>
              <p className="text-2xl font-bold text-white mb-0.5">
                {stat.value}
              </p>
              <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
              {stat.trend && (
                <p className="text-xs text-emerald-400/80">{stat.trend}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── SDLC Phase Coverage ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            SDLC Phase Coverage
          </h3>
          <span className="text-xs text-slate-500">8 phases • AI-powered</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SDLC_PHASES.map((phase) => (
            <button
              key={phase.number}
              onClick={() => router.push(phase.href)}
              className="text-left bg-[#0f172a] border border-slate-800 hover:border-slate-700 rounded-xl p-4 card-glow group transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3 mb-3">
                {/* Phase number badge */}
                <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold flex items-center justify-center border border-slate-700">
                  {phase.number}
                </span>
                {/* Phase icon */}
                <div
                  className={`w-9 h-9 rounded-lg bg-gradient-to-br ${phase.color} flex items-center justify-center text-white shadow-md shrink-0 group-hover:scale-110 transition-transform`}
                >
                  {phase.icon}
                </div>
              </div>
              <p className="text-sm font-semibold text-white mb-1 group-hover:gradient-text transition-all">
                {phase.name}
              </p>
              <p className="text-xs text-slate-500 mb-2 leading-relaxed line-clamp-2">
                {phase.description}
              </p>
              <div className="space-y-0.5">
                {phase.coverage.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-1.5 text-[10px] text-slate-500"
                  >
                    <div className="w-1 h-1 rounded-full bg-blue-500/60 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge status={phase.status} />
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom row: Activity + Quick Actions ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent AI Activity */}
        <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Recent AI Activity
            </h3>
            <button
              onClick={() => router.push('/mee')}
              className="text-xs text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {isLoadingActivity ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 hover:border-slate-700 transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {event.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {event.project && (
                        <span className="text-[10px] text-slate-500">
                          {event.project}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
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

        {/* Quick Actions */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            Quick Actions
          </h3>
          <div className="space-y-2.5">
            {[
              {
                label: 'New Project',
                description: 'Start an AI-driven project',
                icon: <Plus className="w-4 h-4" />,
                href: '/projects/new',
                color:
                  'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40',
                iconColor: 'text-blue-400',
              },
              {
                label: 'Generate Requirements',
                description: 'Extract from document or text',
                icon: <FileText className="w-4 h-4" />,
                href: '/requirements',
                color:
                  'bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/40',
                iconColor: 'text-violet-400',
              },
              {
                label: 'View Analytics',
                description: 'Platform-wide KPIs & metrics',
                icon: <BarChart3 className="w-4 h-4" />,
                href: '/analytics',
                color:
                  'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40',
                iconColor: 'text-emerald-400',
              },
              {
                label: 'AI Engines',
                description: 'Manage & trigger AI jobs',
                icon: <Cpu className="w-4 h-4" />,
                href: '/ai-engines',
                color:
                  'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/40',
                iconColor: 'text-orange-400',
              },
              {
                label: 'Legacy Conversion',
                description: 'Convert legacy codebase',
                icon: <RefreshCw className="w-4 h-4" />,
                href: '/ai-engines',
                color:
                  'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40',
                iconColor: 'text-amber-400',
              },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${action.color}`}
              >
                <div className={`shrink-0 ${action.iconColor}`}>
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200">
                    {action.label}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {action.description}
                  </p>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
