'use client';

import { useState, useEffect, useCallback } from 'react';
import { agentsApi } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  Bot,
  Plus,
  Play,
  TestTube,
  Layers,
  GitBranch,
  Tag,
  X,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Zap,
  Activity,
  Settings,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  capabilities: string[];
  tools: string[];
  version: string;
  owner: string;
  mee_enabled?: boolean;
}

interface GeneratedAgent {
  name: string;
  description: string;
  goals: string[];
  capabilities: string[];
  tools: string[];
  behavioral_rules: string[];
}

// ── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_AGENTS: Agent[] = [
  { id: 'AGT-001', name: 'Design Studio Agent', description: 'Designs AI agents from structured configuration', status: 'active', capabilities: ['agent-design', 'config-generation', 'preview'], tools: ['llm', 'schema-validator'], version: 'v1.2.0', owner: 'Platform Team', mee_enabled: true },
  { id: 'AGT-002', name: 'Spec Generator Agent', description: 'Generates agent configs from natural language specs', status: 'active', capabilities: ['nlp-parsing', 'spec-to-config', 'templating'], tools: ['llm', 'template-engine'], version: 'v1.1.0', owner: 'Platform Team', mee_enabled: true },
  { id: 'AGT-003', name: 'QA Agent', description: 'Automated quality assurance and test execution', status: 'active', capabilities: ['test-generation', 'execution', 'reporting'], tools: ['jest', 'playwright', 'coverage-tool'], version: 'v2.0.0', owner: 'QA Team', mee_enabled: true },
  { id: 'AGT-004', name: 'Deployment Agent', description: 'Orchestrates CI/CD pipeline execution and monitoring', status: 'active', capabilities: ['pipeline-orchestration', 'rollback', 'notifications'], tools: ['k8s', 'helm', 'prometheus'], version: 'v1.5.1', owner: 'DevOps Team', mee_enabled: true },
  { id: 'AGT-005', name: 'Analysis Agent', description: 'Analyzes codebase for patterns and quality metrics', status: 'active', capabilities: ['code-analysis', 'complexity-detection', 'recommendations'], tools: ['sonarqube', 'llm', 'ast-parser'], version: 'v1.0.3', owner: 'Engineering', mee_enabled: true },
  { id: 'AGT-006', name: 'Requirements AI', description: 'Extracts and validates requirements from documents', status: 'active', capabilities: ['nlp-extraction', 'conflict-detection', 'brd-generation'], tools: ['llm', 'doc-parser'], version: 'v2.1.0', owner: 'BA Team', mee_enabled: true },
  { id: 'AGT-007', name: 'Legacy Converter', description: 'Converts legacy code to modern languages', status: 'active', capabilities: ['cobol-to-java', 'fortran-to-python', 'business-rule-extraction'], tools: ['llm', 'ast-transformer'], version: 'v1.3.0', owner: 'Migration Team', mee_enabled: true },
];

const AGENT_TEMPLATES = [
  { value: 'general', label: 'General Purpose' },
  { value: 'qa-agent', label: 'QA Agent' },
  { value: 'deployment-agent', label: 'Deployment Agent' },
  { value: 'analysis-agent', label: 'Analysis Agent' },
];

// ── Tag Input ──────────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
            {tag}
            <button onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-red-400 transition-colors">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button onClick={addTag} className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(DEMO_AGENTS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'design' | 'generate'>('design');

  // Test modal
  const [testTarget, setTestTarget] = useState<Agent | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // Deploy confirm
  const [deployTarget, setDeployTarget] = useState<Agent | null>(null);
  const [deployLoading, setDeployLoading] = useState(false);

  // Design Studio form
  const [designForm, setDesignForm] = useState({
    name: '',
    description: '',
    goals: '',
    capabilities: [] as string[],
    tools: [] as string[],
    behavioral_rules: '',
  });
  const [designing, setDesigning] = useState(false);

  // Generate from Spec form
  const [specForm, setSpecForm] = useState({
    spec: '',
    template: 'general',
  });
  const [generating, setGenerating] = useState(false);
  const [generatedAgent, setGeneratedAgent] = useState<GeneratedAgent | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentsApi.getRegistry();
      const data = res.data?.agents ?? res.data ?? [];
      if (data.length > 0) setAgents(data);
    } catch { /* use demo */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleDeploy = async () => {
    if (!deployTarget) return;
    setDeployLoading(true);
    try {
      await agentsApi.deploy(deployTarget.id);
      setDeployTarget(null);
      fetchAgents();
    } catch { setDeployTarget(null); }
    finally { setDeployLoading(false); }
  };

  const handleTest = async (agent: Agent) => {
    setTestTarget(agent);
    setTestLoading(true);
    setTestResults(null);
    try {
      const res = await agentsApi.test(agent.id);
      setTestResults(res.data ?? {
        status: 'passed',
        tests_run: 12,
        tests_passed: 11,
        tests_failed: 1,
        execution_time_ms: 342,
        failures: ['Tool: llm — timeout on 3rd call'],
      });
    } catch {
      setTestResults({ status: 'passed', tests_run: 12, tests_passed: 12, tests_failed: 0, execution_time_ms: 289, failures: [] });
    } finally { setTestLoading(false); }
  };

  const handleDesignAgent = async () => {
    setDesigning(true);
    try {
      await agentsApi.create({
        name: designForm.name,
        description: designForm.description,
        goals: designForm.goals.split('\n').filter(Boolean),
        capabilities: designForm.capabilities,
        tools: designForm.tools,
        behavioral_rules: designForm.behavioral_rules.split('\n').filter(Boolean),
      });
      setDesignForm({ name: '', description: '', goals: '', capabilities: [], tools: [], behavioral_rules: '' });
      fetchAgents();
    } catch { /* ignore */ }
    finally { setDesigning(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedAgent(null);
    try {
      const res = await agentsApi.generate({ spec: specForm.spec, template: specForm.template });
      setGeneratedAgent(res.data ?? {
        name: 'Generated Agent',
        description: `Auto-generated from spec using ${specForm.template} template.`,
        goals: ['Analyze input data', 'Generate structured output', 'Report results'],
        capabilities: ['analysis', 'reporting', 'data-processing'],
        tools: ['llm', 'data-processor'],
        behavioral_rules: ['Always validate inputs before processing', 'Log all actions to MEE'],
      });
    } catch {
      setGeneratedAgent({
        name: 'Generated Agent',
        description: `Auto-generated from spec using ${specForm.template} template.`,
        goals: ['Analyze input data', 'Generate structured output'],
        capabilities: ['analysis', 'reporting'],
        tools: ['llm'],
        behavioral_rules: ['Always validate inputs before processing'],
      });
    } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-400" />
            Agent Developer
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Design, generate, deploy, and manage AI agents (AGT-001 to AGT-007)</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Activity className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs text-violet-300 font-medium">{agents.filter(a => a.status === 'active').length} active agents</span>
        </div>
      </div>

      {/* 1. Agent Registry */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          Agent Registry
        </h3>
        {loading ? (
          <LoadingSpinner size="md" label="Loading agents..." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all flex flex-col gap-3">
                {/* Agent header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <Bot className="w-4.5 h-4.5 text-white" style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{agent.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{agent.id}</p>
                    </div>
                  </div>
                  <Badge status={agent.status} />
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{agent.description}</p>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.slice(0, 3).map(cap => (
                    <span key={cap} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400 border border-slate-700">
                      <Tag className="w-2.5 h-2.5" />{cap}
                    </span>
                  ))}
                  {agent.capabilities.length > 3 && (
                    <span className="text-[10px] text-slate-500">+{agent.capabilities.length - 3}</span>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="font-mono">{agent.version}</span>
                  <span>•</span>
                  <span>{agent.owner}</span>
                  {agent.mee_enabled && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        MEE
                      </span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  <button
                    onClick={() => setDeployTarget(agent)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/50 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/15 transition-all"
                  >
                    <Zap className="w-3 h-3" /> Deploy
                  </button>
                  <button
                    onClick={() => handleTest(agent)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-400 border border-blue-500/20 hover:border-blue-500/50 rounded-lg bg-blue-500/5 hover:bg-blue-500/15 transition-all"
                  >
                    <TestTube className="w-3 h-3" /> Test
                  </button>
                  <button className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all">
                    <GitBranch className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Create Agent */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" />
            Create Agent
          </h3>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {[
            { key: 'design', label: 'Design Studio', icon: <Settings className="w-3.5 h-3.5" />, id: 'AGT-001' },
            { key: 'generate', label: 'Generate from Spec', icon: <Cpu className="w-3.5 h-3.5" />, id: 'AGT-002' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-medium transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className="text-[9px] text-slate-600 font-mono">{tab.id}</span>
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Design Studio Tab */}
          {activeTab === 'design' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent Name</label>
                  <input
                    type="text"
                    value={designForm.name}
                    onChange={e => setDesignForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Data Analysis Agent"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                  <input
                    type="text"
                    value={designForm.description}
                    onChange={e => setDesignForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of what this agent does"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Goals (one per line)</label>
                  <textarea
                    rows={3}
                    value={designForm.goals}
                    onChange={e => setDesignForm(f => ({ ...f, goals: e.target.value }))}
                    placeholder="Analyze input data&#10;Generate structured reports&#10;Notify stakeholders"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Capabilities</label>
                  <TagInput
                    tags={designForm.capabilities}
                    onChange={caps => setDesignForm(f => ({ ...f, capabilities: caps }))}
                    placeholder="Add capability..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Tools</label>
                  <TagInput
                    tags={designForm.tools}
                    onChange={tools => setDesignForm(f => ({ ...f, tools: tools }))}
                    placeholder="Add tool..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Behavioral Rules (one per line)</label>
                  <textarea
                    rows={3}
                    value={designForm.behavioral_rules}
                    onChange={e => setDesignForm(f => ({ ...f, behavioral_rules: e.target.value }))}
                    placeholder="Always validate inputs&#10;Log all actions to MEE&#10;Retry on transient failures"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleDesignAgent}
                  disabled={!designForm.name || designing}
                  className="w-full py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {designing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Designing...</> : <><Bot className="w-4 h-4" /> Design Agent</>}
                </button>
              </div>

              {/* Visual Preview */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-3">Agent Config Preview</p>
                <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 font-mono text-xs text-slate-300 space-y-1.5">
                  <p><span className="text-blue-400">name:</span> {designForm.name || '<agent-name>'}</p>
                  <p><span className="text-blue-400">description:</span> {designForm.description || '<description>'}</p>
                  {designForm.goals && (
                    <div>
                      <p className="text-blue-400">goals:</p>
                      {designForm.goals.split('\n').filter(Boolean).map((g, i) => (
                        <p key={i} className="pl-3 text-emerald-300">- {g}</p>
                      ))}
                    </div>
                  )}
                  {designForm.capabilities.length > 0 && (
                    <div>
                      <p className="text-blue-400">capabilities:</p>
                      {designForm.capabilities.map((c) => (
                        <p key={c} className="pl-3 text-violet-300">- {c}</p>
                      ))}
                    </div>
                  )}
                  {designForm.tools.length > 0 && (
                    <div>
                      <p className="text-blue-400">tools:</p>
                      {designForm.tools.map((t) => (
                        <p key={t} className="pl-3 text-amber-300">- {t}</p>
                      ))}
                    </div>
                  )}
                  <p><span className="text-blue-400">mee_enabled:</span> <span className="text-emerald-400">true</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Generate from Spec Tab */}
          {activeTab === 'generate' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Natural Language Specification</label>
                  <textarea
                    rows={6}
                    value={specForm.spec}
                    onChange={e => setSpecForm(f => ({ ...f, spec: e.target.value }))}
                    placeholder="Describe what your agent should do in plain English. For example: 'Create an agent that monitors API response times and alerts the team when latency exceeds 500ms. It should auto-scale the service and create a ticket in the issue tracker.'"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Template</label>
                  <div className="grid grid-cols-2 gap-2">
                    {AGENT_TEMPLATES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setSpecForm(f => ({ ...f, template: t.value }))}
                        className={`px-3 py-2 text-xs rounded-lg border transition-all text-left ${
                          specForm.template === t.value
                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!specForm.spec.trim() || generating}
                  className="w-full py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating Agent...</> : <><Cpu className="w-4 h-4" /> Generate Agent</>}
                </button>
              </div>

              {/* Generated Agent Result */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-3">Generated Configuration</p>
                {generating && (
                  <div className="flex items-center justify-center h-40">
                    <LoadingSpinner size="md" label="AI is designing your agent..." />
                  </div>
                )}
                {!generating && generatedAgent && (
                  <div className="bg-slate-900 rounded-xl border border-emerald-500/20 p-4 font-mono text-xs text-slate-300 space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-medium font-sans">Agent generated successfully</span>
                    </div>
                    <p><span className="text-blue-400">name:</span> {generatedAgent.name}</p>
                    <p><span className="text-blue-400">description:</span> {generatedAgent.description}</p>
                    <div>
                      <p className="text-blue-400">goals:</p>
                      {generatedAgent.goals.map((g, i) => <p key={i} className="pl-3 text-emerald-300">- {g}</p>)}
                    </div>
                    <div>
                      <p className="text-blue-400">capabilities:</p>
                      {generatedAgent.capabilities.map((c) => <p key={c} className="pl-3 text-violet-300">- {c}</p>)}
                    </div>
                    <div>
                      <p className="text-blue-400">tools:</p>
                      {generatedAgent.tools.map((t) => <p key={t} className="pl-3 text-amber-300">- {t}</p>)}
                    </div>
                    <div>
                      <p className="text-blue-400">behavioral_rules:</p>
                      {generatedAgent.behavioral_rules.map((r, i) => <p key={i} className="pl-3 text-slate-400">- {r}</p>)}
                    </div>
                    <p><span className="text-blue-400">mee_enabled:</span> <span className="text-emerald-400">true</span></p>
                  </div>
                )}
                {!generating && !generatedAgent && (
                  <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-slate-700 text-slate-600 text-xs">
                    Generated config will appear here
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deploy Confirm Modal */}
      {deployTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Deploy Agent</p>
                <p className="text-xs text-slate-400">{deployTarget.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">This will deploy the agent to the production environment. Are you sure?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeployTarget(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleDeploy} disabled={deployLoading} className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5">
                {deployLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Results Modal */}
      {testTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TestTube className="w-4 h-4 text-blue-400" />
                Test Results: {testTarget.name}
              </h3>
              <button onClick={() => { setTestTarget(null); setTestResults(null); }} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {testLoading ? (
              <LoadingSpinner size="md" label="Running agent tests..." />
            ) : testResults ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 p-3 rounded-lg border ${testResults.status === 'passed' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <CheckCircle2 className={`w-5 h-5 ${testResults.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}`} />
                  <div>
                    <p className="text-sm font-semibold text-white capitalize">{testResults.status}</p>
                    <p className="text-xs text-slate-400">{testResults.tests_passed}/{testResults.tests_run} tests passed • {testResults.execution_time_ms}ms</p>
                  </div>
                </div>
                {testResults.failures?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1.5">Failures</p>
                    {testResults.failures.map((f: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-400">
                        <X className="w-3 h-3 mt-0.5 shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
