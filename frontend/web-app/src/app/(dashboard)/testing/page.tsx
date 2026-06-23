'use client';

import { useEffect, useState } from 'react';
import { projectsApi, testApi } from '@/lib/api';
import { TestTube, Wand2, Play, CheckCircle, XCircle, SkipForward, TrendingUp } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

export default function TestingPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    projectsApi.list().then(r => {
      setProjects(r.data);
      if (r.data.length > 0) setSelectedProject(r.data[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    Promise.all([
      testApi.listCases(selectedProject.id),
      testApi.listRuns(selectedProject.id),
      testApi.getCoverage(selectedProject.id),
    ]).then(([c, r, cov]) => {
      setCases(c.data ?? []);
      setRuns(r.data ?? []);
      setCoverage(cov.data);
    }).finally(() => setLoading(false));
  }, [selectedProject]);

  const handleGenerate = async () => {
    if (!selectedProject) return;
    setGenerating(true);
    try {
      const res = await testApi.generateTests({ project_id: selectedProject.id });
      setCases(prev => [...(res.data ?? []), ...prev]);
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const handleRunTests = async () => {
    if (!selectedProject) return;
    setRunning(true);
    try {
      const res = await testApi.executeTests({ project_id: selectedProject.id });
      setRuns(prev => [res.data, ...prev]);
    } catch (e) { console.error(e); }
    setRunning(false);
  };

  const latestRun = runs[0];
  const coveragePct = coverage?.coverage_pct ?? (latestRun?.coverage_pct ?? 0);
  const coverageData = [{ name: 'Coverage', value: coveragePct, fill: coveragePct >= 80 ? '#22c55e' : coveragePct >= 60 ? '#eab308' : '#ef4444' }];

  const typeColors: Record<string, string> = {
    unit: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    integration: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    e2e: 'text-green-400 bg-green-400/10 border-green-400/20',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Testing & QA</h1>
          <p className="text-slate-400 text-sm mt-1">AI-generated test cases, automated execution, and coverage analysis</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleGenerate} disabled={generating || !selectedProject}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Wand2 className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate Tests (AI)'}
          </button>
          <button onClick={handleRunTests} disabled={running || !selectedProject || cases.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run All Tests'}
          </button>
        </div>
      </div>

      {/* Project selector */}
      <div className="flex gap-2">
        {projects.map(p => (
          <button key={p.id} onClick={() => setSelectedProject(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedProject?.id === p.id ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Coverage gauge */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col items-center">
          <p className="text-xs text-slate-400 mb-2">Test Coverage</p>
          <div className="relative w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={coverageData} startAngle={90} endAngle={-270} barSize={8}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#1e293b' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{coveragePct.toFixed(0)}%</span>
            </div>
          </div>
        </div>
        {/* Stats */}
        {[
          { label: 'Test Cases', value: cases.length, icon: <TestTube className="w-4 h-4 text-blue-400" /> },
          { label: 'Passed', value: latestRun?.passed ?? 0, icon: <CheckCircle className="w-4 h-4 text-green-400" /> },
          { label: 'Failed', value: latestRun?.failed ?? 0, icon: <XCircle className="w-4 h-4 text-red-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">{s.icon}<span className="text-xs text-slate-400">{s.label}</span></div>
            <p className="text-3xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Latest run result */}
      {latestRun && (
        <div className={`border rounded-xl p-4 flex items-center gap-6 ${latestRun.status === 'completed' && latestRun.failed === 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
          <div className="flex items-center gap-2">
            {latestRun.failed === 0 ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-yellow-400" />}
            <span className="text-sm font-medium text-white">Latest Run</span>
          </div>
          {[
            { label: 'Total', value: latestRun.total_cases },
            { label: 'Passed', value: latestRun.passed, color: 'text-green-400' },
            { label: 'Failed', value: latestRun.failed, color: 'text-red-400' },
            { label: 'Skipped', value: latestRun.skipped, color: 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-xl font-bold ${s.color ?? 'text-white'}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
          <div className="flex-1 bg-slate-800 rounded-full h-2 ml-4">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${latestRun.total_cases > 0 ? (latestRun.passed / latestRun.total_cases) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Test cases table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <TestTube className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Test Cases</span>
          <span className="ml-auto text-xs text-slate-500">{cases.length} cases</span>
        </div>
        {loading ? (
          <p className="p-6 text-center text-slate-500 text-sm">Loading...</p>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm mb-3">No test cases yet.</p>
            <button onClick={handleGenerate} className="text-purple-400 text-sm hover:underline">Generate with AI →</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-slate-500 text-xs uppercase border-b border-slate-800">
              <th className="px-5 py-3 text-left font-medium">Test Case</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Expected Result</th>
              <th className="px-4 py-3 text-left font-medium">Source</th>
            </tr></thead>
            <tbody>
              {cases.map(tc => (
                <tr key={tc.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                  <td className="px-5 py-3"><p className="text-slate-200 text-sm font-medium">{tc.title}</p><p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{tc.description}</p></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs border ${typeColors[tc.type] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/20'}`}>{tc.type}</span></td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{tc.expected_result}</td>
                  <td className="px-4 py-3">{tc.ai_generated ? <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">AI</span> : <span className="text-slate-500 text-xs">Manual</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
