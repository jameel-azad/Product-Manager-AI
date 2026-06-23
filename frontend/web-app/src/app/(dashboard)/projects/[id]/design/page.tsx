'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { designApi, requirementsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import {
  Compass,
  Cpu,
  FileCode2,
  Database,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Download,
  Layers,
  GitBranch,
  Server,
  Globe,
  HardDrive,
  Cloud,
  ChevronDown,
  Sparkles,
  Clock,
  AlertCircle,
} from 'lucide-react';

// Monaco Editor (lazy-loaded to avoid SSR issues)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'tech-stack' | 'architecture' | 'api-contract' | 'db-schema' | 'review';

interface TechItem {
  name: string;
  version?: string;
  rationale?: string;
  category?: string;
}

interface TechStackResult {
  frontend?: TechItem[];
  backend?: TechItem[];
  database?: TechItem[];
  infrastructure?: TechItem[];
  [key: string]: TechItem[] | undefined;
}

interface DesignArtifact {
  id: string;
  type: string;
  name: string;
  created_at: string;
  status: string;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'tech-stack', label: 'Tech Stack', icon: <Layers className="w-4 h-4" /> },
  { id: 'architecture', label: 'Architecture', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'api-contract', label: 'API Contract', icon: <FileCode2 className="w-4 h-4" /> },
  { id: 'db-schema', label: 'DB Schema', icon: <Database className="w-4 h-4" /> },
  { id: 'review', label: 'Design Review', icon: <ShieldCheck className="w-4 h-4" /> },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  frontend: <Globe className="w-4 h-4 text-blue-400" />,
  backend: <Server className="w-4 h-4 text-violet-400" />,
  database: <HardDrive className="w-4 h-4 text-emerald-400" />,
  infrastructure: <Cloud className="w-4 h-4 text-orange-400" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  frontend: 'border-blue-500/30 bg-blue-500/5',
  backend: 'border-violet-500/30 bg-violet-500/5',
  database: 'border-emerald-500/30 bg-emerald-500/5',
  infrastructure: 'border-orange-500/30 bg-orange-500/5',
};

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  frontend: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  backend: 'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  database: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  infrastructure: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copied, copy };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-400 mb-1.5">
      {children}
    </label>
  );
}

function InputTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none resize-none transition-colors"
    />
  );
}

function TriggerButton({
  onClick,
  loading,
  children,
  disabled,
}: {
  onClick: () => void;
  loading: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-md shadow-blue-500/20"
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          AI is analyzing your requirements...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          {children}
        </>
      )}
    </button>
  );
}

// ─── Tech Stack Tab ───────────────────────────────────────────────────────────

function TechStackTab({ projectId }: { projectId: string }) {
  const [description, setDescription] = useState('');
  const [teamSize, setTeamSize] = useState('5');
  const [scale, setScale] = useState<'small' | 'medium' | 'large' | 'enterprise'>('medium');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TechStackResult | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await designApi.recommendTechStack({
        project_id: projectId,
        project_description: description,
        team_size: Number(teamSize),
        scale,
      });
      const raw = res.data?.content ?? res.data?.recommendation ?? res.data ?? {};
      // Normalise: API may return string[] per category instead of TechItem[]
      const normalize = (arr: any[]): TechItem[] =>
        arr.map((item) => (typeof item === 'string' ? { name: item } : item));
      const data: TechStackResult = {
        frontend:       raw.frontend       ? normalize(raw.frontend)       : undefined,
        backend:        raw.backend        ? normalize(raw.backend)        : undefined,
        database:       raw.database       ? normalize(raw.database)       : undefined,
        infrastructure: raw.infrastructure ? normalize(raw.infrastructure) : undefined,
      };
      setResult(data);
      if (raw.rationale) setRationale(raw.rationale);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to get recommendation.'));
    } finally {
      setLoading(false);
    }
  };

  const categories: (keyof TechStackResult)[] = ['frontend', 'backend', 'database', 'infrastructure'];

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          AI Tech Stack Recommender
        </h3>

        <div>
          <SectionLabel>Project Description</SectionLabel>
          <InputTextarea
            value={description}
            onChange={setDescription}
            placeholder="Describe your project requirements, goals, and constraints..."
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <SectionLabel>Team Size</SectionLabel>
            <input
              type="number"
              min={1}
              max={500}
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors"
            />
          </div>
          <div>
            <SectionLabel>Expected Scale</SectionLabel>
            <div className="relative">
              <select
                value={scale}
                onChange={(e) => setScale(e.target.value as typeof scale)}
                className="w-full appearance-none px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white outline-none transition-colors pr-8"
              >
                <option value="small">Small (&lt;1K users)</option>
                <option value="medium">Medium (1K–100K users)</option>
                <option value="large">Large (100K–1M users)</option>
                <option value="enterprise">Enterprise (1M+ users)</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <TriggerButton onClick={handleSubmit} loading={loading}>
          Get AI Recommendation
        </TriggerButton>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Recommended Tech Stack</h3>
          {rationale && (
            <div className="px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-blue-400">AI Rationale: </span>{rationale}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => {
              const items = result[cat];
              if (!items || items.length === 0) return null;
              const catStr = String(cat);
              return (
                <div
                  key={catStr}
                  className={`rounded-xl border p-4 space-y-3 ${CATEGORY_COLORS[catStr] ?? 'border-slate-800 bg-slate-900/30'}`}
                >
                  <div className="flex items-center gap-2">
                    {CATEGORY_ICONS[catStr] ?? <Layers className="w-4 h-4 text-slate-400" />}
                    <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                      {catStr}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="w-full">
                        <div className="flex items-start gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              CATEGORY_BADGE_COLORS[catStr] ?? 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {item.name}
                            {item.version && (
                              <span className="ml-1 opacity-60">v{item.version}</span>
                            )}
                          </span>
                        </div>
                        {item.rationale && (
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed pl-0.5">
                            {item.rationale}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Architecture Tab ─────────────────────────────────────────────────────────

const TECH_OPTIONS = [
  'React', 'Next.js', 'Vue.js', 'Angular',
  'Node.js', 'FastAPI', 'Django', 'Spring Boot',
  'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
  'Kafka', 'RabbitMQ', 'GraphQL', 'REST',
];

function ArchitectureTab({ projectId }: { projectId: string }) {
  const [description, setDescription] = useState('');
  const [selectedTech, setSelectedTech] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const toggleTech = (tech: string) => {
    setSelectedTech((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await designApi.generateArchitecture({
        project_id: projectId,
        project_description: description,
        tech_stack: selectedTech,
      });
      const code =
        res.data?.mermaid_code ??
        res.data?.diagram ??
        res.data?.content ??
        JSON.stringify(res.data, null, 2);
      setMermaidCode(code);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to generate architecture.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-purple-400" />
          Architecture Diagram Generator
        </h3>

        <div>
          <SectionLabel>Project Description</SectionLabel>
          <InputTextarea
            value={description}
            onChange={setDescription}
            placeholder="Describe the system architecture requirements, services, and interactions..."
            rows={3}
          />
        </div>

        <div>
          <SectionLabel>Tech Stack (select all that apply)</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {TECH_OPTIONS.map((tech) => (
              <button
                key={tech}
                onClick={() => toggleTech(tech)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  selectedTech.includes(tech)
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {tech}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <TriggerButton onClick={handleSubmit} loading={loading}>
          Generate Architecture
        </TriggerButton>
      </div>

      {/* Result */}
      {mermaidCode && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Mermaid Diagram</h3>
            <button
              onClick={() => copy(mermaidCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Mermaid'}
            </button>
          </div>
          <div className="bg-[#0a0f1e] border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-900/50">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-xs text-slate-500 font-mono">architecture.mmd</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {mermaidCode}
            </pre>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            Copy the code above and paste it into{' '}
            <a
              href="https://mermaid.live"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              mermaid.live
            </a>{' '}
            to render the diagram interactively.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── API Contract Tab ─────────────────────────────────────────────────────────

function ApiContractTab({ projectId }: { projectId: string }) {
  const [serviceName, setServiceName] = useState('');
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [yamlContent, setYamlContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const handleSubmit = async () => {
    if (!serviceName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const reqList = requirements
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);
      const res = await designApi.generateApiContract({
        project_id: projectId,
        service_name: serviceName,
        requirements: reqList,
      });
      const content =
        res.data?.openapi_spec ??
        res.data?.yaml ??
        res.data?.content ??
        JSON.stringify(res.data, null, 2);
      setYamlContent(content);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to generate API contract.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!yamlContent) return;
    const blob = new Blob([yamlContent], { type: 'application/x-yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName.replace(/\s+/g, '-').toLowerCase()}-openapi.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-emerald-400" />
          OpenAPI Contract Generator
        </h3>

        <div>
          <SectionLabel>Service Name</SectionLabel>
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="e.g. User Authentication Service"
            className="w-full px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition-colors"
          />
        </div>

        <div>
          <SectionLabel>Requirements (one per line)</SectionLabel>
          <InputTextarea
            value={requirements}
            onChange={setRequirements}
            placeholder={`User can register with email and password\nUser can log in and receive a JWT token\nUser can reset their password via email`}
            rows={5}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <TriggerButton onClick={handleSubmit} loading={loading}>
          Generate OpenAPI Spec
        </TriggerButton>
      </div>

      {/* Result */}
      {yamlContent && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">OpenAPI Specification</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copy(yamlContent)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy YAML'}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>
          <div className="border border-slate-700 rounded-xl overflow-hidden" style={{ height: 480 }}>
            <MonacoEditor
              height={480}
              language="yaml"
              value={yamlContent}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DB Schema Tab ────────────────────────────────────────────────────────────

function DbSchemaTab({ projectId }: { projectId: string }) {
  const [entities, setEntities] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [sqlDdl, setSqlDdl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const handleSubmit = async () => {
    if (!entities.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const entityList = entities
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      const res = await designApi.generateDbSchema({
        project_id: projectId,
        entities: entityList,
        description,
      });
      const sql =
        res.data?.sql_ddl ??
        res.data?.schema ??
        res.data?.content ??
        JSON.stringify(res.data, null, 2);
      setSqlDdl(sql);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to generate DB schema.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-400" />
          Database Schema Generator
        </h3>

        <div>
          <SectionLabel>Entity Names (comma separated)</SectionLabel>
          <input
            type="text"
            value={entities}
            onChange={(e) => setEntities(e.target.value)}
            placeholder="e.g. User, Product, Order, Category, Review"
            className="w-full px-3 py-2 bg-[#0a0f1e] border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition-colors"
          />
        </div>

        <div>
          <SectionLabel>Additional Description</SectionLabel>
          <InputTextarea
            value={description}
            onChange={setDescription}
            placeholder="Describe relationships, constraints, and special requirements..."
            rows={3}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <TriggerButton onClick={handleSubmit} loading={loading}>
          Generate Schema
        </TriggerButton>
      </div>

      {/* Result */}
      {sqlDdl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">SQL DDL Schema</h3>
            <button
              onClick={() => copy(sqlDdl)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg bg-slate-800/40 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy SQL'}
            </button>
          </div>
          <div className="bg-[#0a0f1e] border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-900/50">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-xs text-slate-500 font-mono">schema.sql</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-[480px] overflow-y-auto">
              {sqlDdl}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Design Review Tab ────────────────────────────────────────────────────────

function DesignReviewTab({ projectId }: { projectId: string }) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'architecture' | 'api' | 'database'>('architecture');
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await designApi.review({
        project_id: projectId,
        content,
        type,
      });
      const reviewText =
        res.data?.review ??
        res.data?.feedback ??
        res.data?.content ??
        JSON.stringify(res.data, null, 2);
      setReview(reviewText);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to perform design review.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          AI Design Review
        </h3>

        <div className="grid grid-cols-3 gap-2">
          {(['architecture', 'api', 'database'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all capitalize ${
                type === t
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {t === 'api' ? 'API Design' : t === 'database' ? 'Database' : 'Architecture'}
            </button>
          ))}
        </div>

        <div>
          <SectionLabel>Paste your design content for review</SectionLabel>
          <InputTextarea
            value={content}
            onChange={setContent}
            placeholder="Paste your architecture diagram, API spec, or database schema here for AI review..."
            rows={8}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <TriggerButton onClick={handleSubmit} loading={loading}>
          Review Design
        </TriggerButton>
      </div>

      {/* Result */}
      {review && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">AI Review</h3>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
              {review}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Artifacts Panel ──────────────────────────────────────────────────────────

function ArtifactsPanel({ projectId }: { projectId: string }) {
  const [artifacts, setArtifacts] = useState<DesignArtifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    designApi
      .getArtifacts(projectId)
      .then((res) => {
        const data: DesignArtifact[] = res.data?.items ?? res.data ?? [];
        setArtifacts(data);
      })
      .catch(() => setArtifacts([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner size="sm" label="Loading artifacts..." />
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No design artifacts yet. Generate one using the tabs above.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4">Name</th>
            <th className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4">Type</th>
            <th className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4">Status</th>
            <th className="text-left text-xs font-semibold text-slate-500 pb-2">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {artifacts.map((a) => (
            <tr key={a.id} className="hover:bg-slate-800/20 transition-colors">
              <td className="py-2.5 pr-4 text-slate-200 font-medium">{a.name}</td>
              <td className="py-2.5 pr-4">
                <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded capitalize">
                  {a.type}
                </span>
              </td>
              <td className="py-2.5 pr-4">
                <Badge status={a.status} />
              </td>
              <td className="py-2.5 text-xs text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {new Date(a.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('tech-stack');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
              <Compass className="w-4 h-4 text-white" />
            </div>
            Design & Architecture
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            AI-powered tech stack recommendations, architecture diagrams and API contracts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">SDLC Phase 3</span>
          <Badge status="active" />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <nav className="-mb-px flex gap-1 overflow-x-auto pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'tech-stack' && <TechStackTab projectId={id} />}
        {activeTab === 'architecture' && <ArchitectureTab projectId={id} />}
        {activeTab === 'api-contract' && <ApiContractTab projectId={id} />}
        {activeTab === 'db-schema' && <DbSchemaTab projectId={id} />}
        {activeTab === 'review' && <DesignReviewTab projectId={id} />}
      </div>

      {/* Design Artifacts */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Design Artifacts</h3>
        </div>
        <ArtifactsPanel projectId={id} />
      </div>
    </div>
  );
}
