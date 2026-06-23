'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Network,
  LayoutGrid,
  List,
  Download,
  CheckCircle2,
  Minus,
  Loader2,
  RefreshCw,
  FileText,
  Code2,
  TestTube,
  Rocket,
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import { clsx } from 'clsx';

// ─── Column definitions ───────────────────────────────────────────────────────

interface TraceColumn {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const COLUMNS: TraceColumn[] = [
  {
    key: 'design',
    label: 'Design',
    icon: <FileText className="w-3.5 h-3.5" />,
    color: 'text-violet-400',
  },
  {
    key: 'code',
    label: 'Code (AI Jobs)',
    icon: <Code2 className="w-3.5 h-3.5" />,
    color: 'text-blue-400',
  },
  {
    key: 'tests',
    label: 'Tests',
    icon: <TestTube className="w-3.5 h-3.5" />,
    color: 'text-amber-400',
  },
  {
    key: 'deployments',
    label: 'Deployments',
    icon: <Rocket className="w-3.5 h-3.5" />,
    color: 'text-emerald-400',
  },
];

// ─── Link indicator ───────────────────────────────────────────────────────────

function LinkCell({ linked, count }: { linked: boolean; count?: number }) {
  if (linked) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        {count != null && count > 0 && (
          <span className="text-[9px] text-emerald-500 font-medium">{count}</span>
        )}
      </div>
    );
  }
  return <Minus className="w-4 h-4 text-slate-700 mx-auto" />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TraceRow {
  requirement_id: string;
  requirement_title: string;
  requirement_status: string;
  design: boolean;
  design_count?: number;
  code: boolean;
  code_count?: number;
  tests: boolean;
  tests_count?: number;
  deployments: boolean;
  deployments_count?: number;
  artifacts?: Record<string, any[]>;
}

// ─── Normalise API response ───────────────────────────────────────────────────

function normaliseTraceData(raw: any): TraceRow[] {
  if (!raw) return [];

  // Handle array form directly
  if (Array.isArray(raw)) {
    return raw.map((r: any) => normaliseRow(r));
  }

  // Handle { matrix: [...] } or { requirements: [...] }
  const rows = raw?.matrix ?? raw?.requirements ?? raw?.data ?? [];
  if (Array.isArray(rows)) {
    return rows.map((r: any) => normaliseRow(r));
  }

  return [];
}

function normaliseRow(r: any): TraceRow {
  const artifacts: Record<string, any[]> = r?.artifacts ?? {};

  const hasLink = (key: string): boolean => {
    if (typeof r?.[key] === 'boolean') return r[key];
    if (Array.isArray(r?.[key])) return r[key].length > 0;
    if (Array.isArray(artifacts[key])) return artifacts[key].length > 0;
    if (r?.[`has_${key}`] != null) return Boolean(r[`has_${key}`]);
    return false;
  };

  const getCount = (key: string): number | undefined => {
    if (Array.isArray(r?.[key])) return r[key].length;
    if (Array.isArray(artifacts[key])) return artifacts[key].length;
    if (typeof r?.[`${key}_count`] === 'number') return r[`${key}_count`];
    return undefined;
  };

  return {
    requirement_id: r?.requirement_id ?? r?.id ?? '',
    requirement_title: r?.requirement_title ?? r?.title ?? 'Untitled',
    requirement_status: r?.requirement_status ?? r?.status ?? 'unknown',
    design: hasLink('design'),
    design_count: getCount('design'),
    code: hasLink('code'),
    code_count: getCount('code'),
    tests: hasLink('tests'),
    tests_count: getCount('tests'),
    deployments: hasLink('deployments'),
    deployments_count: getCount('deployments'),
    artifacts: r?.artifacts ?? {},
  };
}

// ─── Matrix view ─────────────────────────────────────────────────────────────

function MatrixView({ rows }: { rows: TraceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Network className="w-8 h-8 text-slate-700 mb-3" />
        <p className="text-sm text-slate-500">No traceability data available yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/60 border-b border-slate-700">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 w-1/2">
              Requirement
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-center"
              >
                <div className={clsx('flex flex-col items-center gap-1', col.color)}>
                  {col.icon}
                  <span className="text-[10px] font-semibold whitespace-nowrap">
                    {col.label}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row) => (
            <tr
              key={row.requirement_id}
              className="hover:bg-slate-800/20 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600 shrink-0">
                    {String(row.requirement_id).slice(0, 8)}
                  </span>
                  <span className="text-sm text-slate-300 truncate max-w-[200px]">
                    {row.requirement_title}
                  </span>
                  <Badge status={row.requirement_status} className="shrink-0" />
                </div>
              </td>
              {COLUMNS.map((col) => (
                <td key={col.key} className="px-4 py-3 text-center">
                  <LinkCell
                    linked={(row as any)[col.key] as boolean}
                    count={(row as any)[`${col.key}_count`] as number | undefined}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({ rows }: { rows: TraceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Network className="w-8 h-8 text-slate-700 mb-3" />
        <p className="text-sm text-slate-500">No traceability data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const linkedColumns = COLUMNS.filter((col) => (row as any)[col.key]);
        const totalLinks = COLUMNS.reduce(
          (sum, col) => sum + ((row as any)[`${col.key}_count`] ?? ((row as any)[col.key] ? 1 : 0)),
          0
        );

        return (
          <div
            key={row.requirement_id}
            className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all"
          >
            <div className="flex flex-wrap items-start gap-2 mb-3">
              <span className="text-xs font-mono text-slate-600 mt-0.5">
                {String(row.requirement_id).slice(0, 8)}
              </span>
              <span className="text-sm font-medium text-slate-200 flex-1">
                {row.requirement_title}
              </span>
              <Badge status={row.requirement_status} />
              <span className="text-xs text-slate-500">
                {totalLinks} link{totalLinks !== 1 ? 's' : ''}
              </span>
            </div>

            {linkedColumns.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No linked artifacts.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {linkedColumns.map((col) => {
                  const count = (row as any)[`${col.key}_count`] as number | undefined;
                  return (
                    <div
                      key={col.key}
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
                        'bg-slate-800/60 border border-slate-700',
                        col.color
                      )}
                    >
                      {col.icon}
                      {col.label}
                      {count != null && count > 0 && (
                        <span className="ml-0.5 px-1 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Artifact details if available */}
            {row.artifacts && Object.keys(row.artifacts).length > 0 && (
              <div className="mt-3 border-t border-slate-800 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(row.artifacts).map(([key, items]) => {
                  if (!Array.isArray(items) || items.length === 0) return null;
                  return (
                    <div key={key}>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {key}
                      </p>
                      <ul className="space-y-0.5">
                        {(items as any[]).slice(0, 3).map((artifact: any, i: number) => (
                          <li
                            key={i}
                            className="text-xs text-slate-400 truncate"
                          >
                            • {artifact?.title ?? artifact?.name ?? String(artifact).slice(0, 50)}
                          </li>
                        ))}
                        {items.length > 3 && (
                          <li className="text-xs text-slate-600">
                            +{items.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Coverage summary ─────────────────────────────────────────────────────────

function CoverageSummary({ rows }: { rows: TraceRow[] }) {
  if (rows.length === 0) return null;

  const total = rows.length;
  const summary = COLUMNS.map((col) => ({
    ...col,
    covered: rows.filter((r) => (r as any)[col.key]).length,
  }));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {summary.map((col) => {
        const pct = total > 0 ? Math.round((col.covered / total) * 100) : 0;
        return (
          <div
            key={col.key}
            className="bg-[#0f172a] border border-slate-800 rounded-xl p-3"
          >
            <div className={clsx('flex items-center gap-2 mb-2', col.color)}>
              {col.icon}
              <span className="text-xs font-medium">{col.label}</span>
            </div>
            <p className="text-xl font-bold text-white">{pct}%</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {col.covered}/{total} requirements
            </p>
            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TraceabilityPage() {
  const params = useParams();
  const projectId = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? '');

  const [rawData, setRawData] = useState<any>(null);
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await projectsApi.getTraceability(projectId);
      setRawData(res.data);
      setRows(normaliseTraceData(res.data));
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load traceability data'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const exportData = {
      project_id: projectId,
      exported_at: new Date().toISOString(),
      summary: {
        total_requirements: rows.length,
        coverage: Object.fromEntries(
          COLUMNS.map((col) => [
            col.key,
            rows.filter((r) => (r as any)[col.key]).length,
          ])
        ),
      },
      matrix: rows,
      raw: rawData,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traceability-${projectId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Network className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">
              Requirement Traceability Matrix
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Track which requirements are covered by design, code, tests, and deployments.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && <PageLoader label="Loading traceability data…" />}

      {!loading && (
        <>
          {/* Coverage summary */}
          <CoverageSummary rows={rows} />

          {/* View toggle + item count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {rows.length} requirement{rows.length !== 1 ? 's' : ''} tracked
            </p>
            <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('matrix')}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  viewMode === 'matrix'
                    ? 'bg-slate-700 text-slate-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Matrix
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  viewMode === 'list'
                    ? 'bg-slate-700 text-slate-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
          </div>

          {/* Content */}
          {viewMode === 'matrix' ? (
            <MatrixView rows={rows} />
          ) : (
            <ListView rows={rows} />
          )}
        </>
      )}
    </div>
  );
}
