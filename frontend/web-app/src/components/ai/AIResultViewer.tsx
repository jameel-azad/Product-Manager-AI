'use client';

import { useState } from 'react';
import { Copy, Check, Code2, FileJson, FileText } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIResultViewerProps {
  result: any;
  engine: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isJsonLike(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'object') return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  }
  return false;
}

function isCodeLike(text: string): boolean {
  const codeSignals = [
    /^import\s/m,
    /^from\s/m,
    /^def\s/m,
    /^class\s/m,
    /^const\s/m,
    /^function\s/m,
    /^export\s/m,
    /^<!DOCTYPE/i,
    /^<html/i,
    /^#include/m,
    /^package\s/m,
    /```/,
  ];
  return codeSignals.some((r) => r.test(text));
}

function detectLanguage(text: string, engine: string): string {
  if (engine === 'apix') return 'python';
  if (engine === 'uix') return 'tsx';
  if (engine === 'mobile_ai') return 'dart';
  if (engine === 'integrationx') return 'python';
  if (/def\s|import\s.*:\n|\.py/i.test(text)) return 'python';
  if (/function|const |=>|import\s.*from/i.test(text)) return 'typescript';
  if (/<html|<!DOCTYPE/i.test(text)) return 'html';
  if (/{[\s\S]*?:[\s\S]*?}/i.test(text) && text.trim().startsWith('{')) return 'json';
  return 'text';
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
        copied
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
          : 'bg-slate-700/40 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600'
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" /> Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" /> Copy
        </>
      )}
    </button>
  );
}

// ─── JSON view ───────────────────────────────────────────────────────────────

function JsonView({ data }: { data: unknown }) {
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = data;
    }
  }
  const text = JSON.stringify(parsed, null, 2);

  return (
    <div className="relative">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/60 border-b border-slate-700/60">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <FileJson className="w-3.5 h-3.5 text-amber-400" />
          <span>JSON</span>
        </div>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre">
        {text}
      </pre>
    </div>
  );
}

// ─── Code view ───────────────────────────────────────────────────────────────

function CodeView({ text, lang }: { text: string; lang: string }) {
  // Strip markdown fences if present
  const clean = text.replace(/^```[\w]*\n?/, '').replace(/```$/, '').trim();

  return (
    <div className="relative">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/60 border-b border-slate-700/60">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Code2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-mono text-blue-300">{lang}</span>
        </div>
        <CopyButton text={clean} />
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre">
        {clean}
      </pre>
    </div>
  );
}

// ─── Text view ───────────────────────────────────────────────────────────────

function TextView({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/60 border-b border-slate-700/60">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span>Text</span>
        </div>
        <CopyButton text={text} />
      </div>
      <div className="p-4">
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIResultViewer({ result, engine }: AIResultViewerProps) {
  if (result == null) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
        No result to display.
      </div>
    );
  }

  // Determine the content to display
  const content =
    result?.output ??
    result?.generated_code ??
    result?.content ??
    result?.result ??
    result;

  const renderContent = () => {
    // Object or parseable JSON string
    if (isJsonLike(content)) {
      // Check if it has a string code field
      const asObj = typeof content === 'object' ? content : null;
      if (asObj) {
        const codeField =
          asObj?.code ?? asObj?.generated_code ?? asObj?.output ?? null;
        if (typeof codeField === 'string' && codeField.length > 0) {
          const lang = detectLanguage(codeField, engine);
          return <CodeView text={codeField} lang={lang} />;
        }
      }
      return <JsonView data={content} />;
    }

    // Plain string
    if (typeof content === 'string') {
      if (isCodeLike(content)) {
        const lang = detectLanguage(content, engine);
        return <CodeView text={content} lang={lang} />;
      }
      return <TextView text={content} />;
    }

    // Fallback: stringify whatever we have
    return <JsonView data={content} />;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl overflow-hidden">
      {renderContent()}
    </div>
  );
}
