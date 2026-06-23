'use client';
import { useAuthStore } from '@/store/useAuthStore';
import { Settings, User, Shield, Bell, Key, Database } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Platform configuration and preferences</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Profile */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Profile</span>
          </div>
          <div className="space-y-4">
            {[{ label: 'Full Name', value: user?.full_name }, { label: 'Email', value: user?.email }, { label: 'Role', value: user?.role }, { label: 'Organisation ID', value: user?.org_id }].map(f => (
              <div key={f.label}>
                <p className="text-xs text-slate-500 mb-1">{f.label}</p>
                <p className="text-sm text-slate-200 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono">{f.value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Configuration */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Key className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">AI Configuration</span>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Default LLM Model</p>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-slate-200">claude-sonnet-4-6</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Anthropic API Key</p>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-400 font-mono">Set via ANTHROPIC_API_KEY env var</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">LLM Proxy</p>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-sm text-slate-200">LiteLLM — Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">Security</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'JWT Authentication', status: 'Active', color: 'text-green-400' },
              { label: 'MFA (TOTP/FIDO2)', status: 'Available', color: 'text-yellow-400' },
              { label: 'RBAC Permissions', status: 'Active', color: 'text-green-400' },
              { label: 'AES-256 Encryption', status: 'Active', color: 'text-green-400' },
              { label: 'Audit Logging (MEE)', status: 'Active', color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-sm text-slate-300">{s.label}</span>
                <span className={`text-xs font-medium ${s.color}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Infrastructure */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Database className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Infrastructure</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Database', value: 'SQLite (demo) / PostgreSQL (prod)' },
              { label: 'Cache', value: 'Redis 7' },
              { label: 'Event Bus', value: 'Apache Kafka' },
              { label: 'Object Store', value: 'MinIO (S3-compatible)' },
              { label: 'Secrets', value: 'HashiCorp Vault' },
              { label: 'Deployment', value: 'Kubernetes / Helm' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-xs text-slate-500">{s.label}</span>
                <span className="text-xs text-slate-300">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
