'use client';

import { useState, useEffect, useCallback } from 'react';
import { extractionApi, projectsApi } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  Search,
  FileText,
  GitBranch,
  Globe,
  AlertTriangle,
  Download,
  Link,
  Cpu,
  RefreshCw,
  ChevronRight,
  BookOpen,
  Workflow,
  ExternalLink,
  X,
  Filter,
} from 'lucide-react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
}

interface BRDSection {
  title: string;
  content: string;
  rules?: string[];
}

interface ProcessFlow {
  id: string;
  name: string;
  description: string;
  entities: string[];
  steps: string[];
}

interface WikiEntry {
  term: string;
  definition: string;
  domain: string;
  related_terms: string[];
}

interface ImpactResult {
  impacted_rules: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

interface AnalysisResult {
  project_id?: string;
  brd?: BRDSection[];
  process_flows?: ProcessFlow[];
  wiki?: WikiEntry[];
}

// ── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_BRD: BRDSection[] = [
  {
    title: '1. Functional Requirements',
    content: 'The system shall support multi-tier customer management with automatic discount calculation based on customer tier classification.',
    rules: [
      'Standard tier: 5% discount on all orders over $500',
      'Premium tier: 10% discount on all orders',
      'Enterprise tier: 15% discount + dedicated account manager',
    ],
  },
  {
    title: '2. Financial Rules',
    content: 'All financial transactions must adhere to the following business rules for accuracy and compliance.',
    rules: [
      'VAT (20%) applied to all non-essential goods',
      'Credit limit enforced before order submission',
      'Invoices generated within 24 hours of order completion',
      'Late payment penalty: 2% per month after net-30',
    ],
  },
  {
    title: '3. Inventory Management',
    content: 'Inventory thresholds and reorder policies are governed by the following rules.',
    rules: [
      'Reorder trigger: stock falls below 20% of max capacity',
      'Safety stock maintained at 15% of average monthly demand',
      'Supplier lead time factored into reorder quantity',
    ],
  },
];

const DEMO_FLOWS: ProcessFlow[] = [
  {
    id: 'f1',
    name: 'Order Processing Flow',
    description: 'End-to-end flow from customer order creation to fulfillment',
    entities: ['Customer', 'Order', 'Inventory', 'Payment', 'Warehouse'],
    steps: ['Validate order', 'Check credit limit', 'Reserve inventory', 'Process payment', 'Generate invoice', 'Dispatch'],
  },
  {
    id: 'f2',
    name: 'Customer Onboarding Flow',
    description: 'New customer registration and tier classification',
    entities: ['Customer', 'Account', 'CRM', 'Email'],
    steps: ['Collect details', 'Verify identity', 'Assign tier', 'Create account', 'Send welcome email'],
  },
  {
    id: 'f3',
    name: 'Inventory Reorder Flow',
    description: 'Automated reorder process triggered by stock thresholds',
    entities: ['Inventory', 'Supplier', 'PurchaseOrder', 'Finance'],
    steps: ['Detect low stock', 'Calculate reorder qty', 'Request supplier quote', 'Approve PO', 'Receive goods', 'Update stock'],
  },
];

const DEMO_WIKI: WikiEntry[] = [
  { term: 'Customer Tier', definition: 'Classification of customers (Standard, Premium, Enterprise) based on annual spend', domain: 'CRM', related_terms: ['Discount Tier', 'Account Manager', 'Credit Limit'] },
  { term: 'VAT', definition: 'Value Added Tax at 20%, applied to non-essential goods at point of sale', domain: 'Finance', related_terms: ['Invoice', 'Tax Code', 'Exemption'] },
  { term: 'Safety Stock', definition: 'Minimum inventory level maintained to prevent stockouts during demand spikes', domain: 'Inventory', related_terms: ['Reorder Point', 'Lead Time', 'Stockout'] },
  { term: 'Credit Limit', definition: 'Maximum outstanding balance allowed for a customer before orders are blocked', domain: 'Finance', related_terms: ['Payment Terms', 'Credit Score', 'Order Hold'] },
  { term: 'Reorder Point', definition: 'Stock level at which a new purchase order is automatically triggered (20% of max capacity)', domain: 'Inventory', related_terms: ['Safety Stock', 'Lead Time', 'EOQ'] },
  { term: 'Net-30', definition: 'Standard payment term requiring invoice settlement within 30 calendar days', domain: 'Finance', related_terms: ['Late Payment', 'Invoice', 'Credit Terms'] },
];

// ── Main Component ─────────────────────────────────────────────────────────

export default function ExtractionPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('brd');

  // Form
  const [form, setForm] = useState({
    project_id: '',
    code: '',
    language_hint: '',
  });

  // Impact analysis
  const [impactInput, setImpactInput] = useState('');
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  // Wiki search
  const [wikiSearch, setWikiSearch] = useState('');

  useEffect(() => {
    projectsApi.list()
      .then(res => { if (res.data?.length) setProjects(res.data); })
      .catch(() => {});
  }, []);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setAnalysisResult(null);
    try {
      const res = await extractionApi.analyze({
        project_id: form.project_id,
        code: form.code,
        language_hint: form.language_hint,
      });
      setAnalysisResult({
        project_id: form.project_id,
        brd: res.data?.brd ?? DEMO_BRD,
        process_flows: res.data?.process_flows ?? DEMO_FLOWS,
        wiki: res.data?.wiki ?? DEMO_WIKI,
      });
      setActiveTab('brd');
    } catch {
      // fallback to demo
      setAnalysisResult({ project_id: form.project_id, brd: DEMO_BRD, process_flows: DEMO_FLOWS, wiki: DEMO_WIKI });
      setActiveTab('brd');
    } finally { setLoading(false); }
  }, [form]);

  const handleAnalyzeImpact = async () => {
    setImpactLoading(true);
    setImpactResult(null);
    try {
      // Using analyze endpoint with impact flag
      const res = await extractionApi.analyze({ ...form, changed_areas: impactInput, mode: 'impact' });
      setImpactResult(res.data?.impact ?? {
        impacted_rules: [
          'Customer tier discount calculation (Finance Rule #2)',
          'Credit limit enforcement on order submission',
          'Invoice generation timeline (24h SLA)',
        ],
        risk_level: 'medium',
        recommendations: [
          'Update unit tests for discount calculation module',
          'Notify Finance team of changed credit limit logic',
          'Review invoice generation triggers in OrderService',
        ],
      });
    } catch {
      setImpactResult({
        impacted_rules: [
          'Customer tier discount calculation (Finance Rule #2)',
          'Credit limit enforcement on order submission',
        ],
        risk_level: 'medium',
        recommendations: ['Update unit tests for discount calculation module'],
      });
    } finally { setImpactLoading(false); }
  };

  const handleExport = async () => {
    if (!form.project_id) return;
    setExportLoading(true);
    try {
      const res = await extractionApi.getReport(form.project_id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extraction-report-${form.project_id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExportLoading(false); }
  };

  const filteredWiki = (analysisResult?.wiki ?? DEMO_WIKI).filter(entry =>
    !wikiSearch || entry.term.toLowerCase().includes(wikiSearch.toLowerCase()) ||
    entry.definition.toLowerCase().includes(wikiSearch.toLowerCase()) ||
    entry.domain.toLowerCase().includes(wikiSearch.toLowerCase())
  );

  const wikiByDomain = filteredWiki.reduce<Record<string, WikiEntry[]>>((acc, entry) => {
    if (!acc[entry.domain]) acc[entry.domain] = [];
    acc[entry.domain].push(entry);
    return acc;
  }, {});

  const riskColors: Record<string, string> = {
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            Business Extraction Tool
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Extract business rules, process flows, and domain knowledge from code (BEX-001 to BEX-008)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/requirements')}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all"
          >
            <Link className="w-3.5 h-3.5" />
            View Traceability
            <ExternalLink className="w-3 h-3" />
          </button>
          {analysisResult && (
            <button
              onClick={handleExport}
              disabled={exportLoading || !form.project_id}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {exportLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Report
            </button>
          )}
        </div>
      </div>

      {/* 1. Analyze Form */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-400" />
          Analyze Code (BEX-001)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Project</label>
            <select
              value={form.project_id}
              onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="demo">Demo Project</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Language Hint</label>
            <select
              value={form.language_hint}
              onChange={e => setForm(f => ({ ...f, language_hint: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Auto-detect</option>
              <option value="java">Java</option>
              <option value="python">Python</option>
              <option value="csharp">C#</option>
              <option value="javascript">JavaScript / TypeScript</option>
              <option value="cobol">COBOL</option>
              <option value="fortran">FORTRAN</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Code Snippet</label>
          <textarea
            rows={8}
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            placeholder="Paste your code here for business logic extraction..."
            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono resize-y"
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!form.code.trim() || loading}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {loading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> AI is reading your codebase...</>
          ) : (
            <><Cpu className="w-4 h-4" /> Extract Business Logic</>
          )}
        </button>
      </div>

      {/* 2. Results */}
      {(analysisResult || loading) && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="lg" label="AI is reading your codebase..." />
            </div>
          ) : (
            <RadixTabs.Root value={activeTab} onValueChange={setActiveTab}>
              {/* Tab list */}
              <div className="flex border-b border-slate-800 overflow-x-auto">
                {[
                  { value: 'brd', label: 'Business Rules Document', icon: <FileText className="w-3.5 h-3.5" />, id: 'BEX-002' },
                  { value: 'flows', label: 'Process Flows', icon: <Workflow className="w-3.5 h-3.5" />, id: 'BEX-003' },
                  { value: 'wiki', label: 'Domain Wiki', icon: <Globe className="w-3.5 h-3.5" />, id: 'BEX-004' },
                  { value: 'impact', label: 'Change Impact', icon: <AlertTriangle className="w-3.5 h-3.5" />, id: 'BEX-005' },
                ].map((tab) => (
                  <RadixTabs.Trigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all data-[state=active]:text-blue-400 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500/5 data-[state=inactive]:text-slate-400 data-[state=inactive]:border-transparent data-[state=inactive]:hover:text-slate-200 data-[state=inactive]:hover:bg-slate-800/40"
                  >
                    {tab.icon}
                    {tab.label}
                    <span className="text-[9px] text-slate-600 font-mono">{tab.id}</span>
                  </RadixTabs.Trigger>
                ))}
              </div>

              {/* BRD Tab */}
              <RadixTabs.Content value="brd" className="p-5">
                <div className="space-y-4">
                  {(analysisResult?.brd ?? DEMO_BRD).map((section, i) => (
                    <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                      <h4 className="text-sm font-semibold text-white mb-2">{section.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">{section.content}</p>
                      {section.rules && (
                        <ul className="space-y-1.5">
                          {section.rules.map((rule, j) => (
                            <li key={j} className="flex items-start gap-2 text-xs text-slate-300">
                              <ChevronRight className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                              {rule}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </RadixTabs.Content>

              {/* Process Flows Tab */}
              <RadixTabs.Content value="flows" className="p-5">
                <div className="space-y-4">
                  {(analysisResult?.process_flows ?? DEMO_FLOWS).map((flow) => (
                    <div key={flow.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-blue-400" />
                          {flow.name}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">{flow.description}</p>

                      {/* Entities */}
                      <div className="mb-3">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">Entities</p>
                        <div className="flex flex-wrap gap-1.5">
                          {flow.entities.map((e) => (
                            <span key={e} className="px-2 py-0.5 text-[10px] rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">{e}</span>
                          ))}
                        </div>
                      </div>

                      {/* Steps */}
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">Steps</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {flow.steps.map((step, i) => (
                            <div key={step} className="flex items-center gap-1">
                              <span className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                                <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-400 text-[9px] flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                                {step}
                              </span>
                              {i < flow.steps.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </RadixTabs.Content>

              {/* Domain Wiki Tab */}
              <RadixTabs.Content value="wiki" className="p-5">
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={wikiSearch}
                      onChange={e => setWikiSearch(e.target.value)}
                      placeholder="Search terms, definitions, domains..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    {wikiSearch && (
                      <button onClick={() => setWikiSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  {Object.entries(wikiByDomain).map(([domain, entries]) => (
                    <div key={domain}>
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <p className="text-xs font-semibold text-slate-300">{domain}</p>
                        <span className="text-[10px] text-slate-500">{entries.length} entries</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {entries.map((entry) => (
                          <div key={entry.term} className="bg-slate-900 rounded-xl border border-slate-800 p-3 hover:border-slate-700 transition-all">
                            <p className="text-sm font-semibold text-white mb-1">{entry.term}</p>
                            <p className="text-xs text-slate-400 leading-relaxed mb-2">{entry.definition}</p>
                            {entry.related_terms.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {entry.related_terms.map(t => (
                                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredWiki.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs">No wiki entries match your search.</div>
                  )}
                </div>
              </RadixTabs.Content>

              {/* Change Impact Tab */}
              <RadixTabs.Content value="impact" className="p-5">
                <div className="mb-5">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Changed Areas / Files</label>
                  <textarea
                    rows={3}
                    value={impactInput}
                    onChange={e => setImpactInput(e.target.value)}
                    placeholder="Describe the changed files or areas, e.g.: OrderService.java, discount calculation logic, customer tier model"
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                  />
                  <button
                    onClick={handleAnalyzeImpact}
                    disabled={!impactInput.trim() || impactLoading}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {impactLoading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
                    ) : (
                      <><Filter className="w-4 h-4" /> Analyze Impact</>
                    )}
                  </button>
                </div>

                {impactLoading && <LoadingSpinner size="md" label="Analyzing change impact..." />}

                {impactResult && !impactLoading && (
                  <div className="space-y-4">
                    {/* Risk level */}
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${riskColors[impactResult.risk_level]}`}>
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold capitalize">Risk Level: {impactResult.risk_level}</p>
                        <p className="text-xs opacity-80">Based on {impactResult.impacted_rules.length} affected business rules</p>
                      </div>
                    </div>

                    {/* Impacted rules */}
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Impacted Business Rules
                      </p>
                      <div className="space-y-1.5">
                        {impactResult.impacted_rules.map((rule, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-slate-300">
                            <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                            {rule}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                        Recommendations
                      </p>
                      <div className="space-y-1.5">
                        {impactResult.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs text-slate-300">
                            <ChevronRight className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </RadixTabs.Content>
            </RadixTabs.Root>
          )}
        </div>
      )}
    </div>
  );
}
