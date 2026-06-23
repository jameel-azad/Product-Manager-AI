'use client';

import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

// Map path segments to human-readable page titles
function deriveTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];

  if (!last || last === 'dashboard') return 'Dashboard';

  const TITLE_MAP: Record<string, string> = {
    projects: 'Projects',
    requirements: 'Requirements',
    design: 'Design',
    development: 'Development',
    tests: 'Test Management',
    deployments: 'Deployments',
    mee: 'Monitoring & Evidence',
    analytics: 'Analytics',
    agents: 'Agent Developer',
    'ai-engines': 'AI Engines',
    settings: 'Settings',
    new: 'Create New',
    backlog: 'Backlog',
    sprints: 'Sprints',
  };

  if (TITLE_MAP[last]) return TITLE_MAP[last];

  // Fallback: capitalise and replace hyphens
  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = deriveTitle(pathname);

  return <DashboardLayout title={title}>{children}</DashboardLayout>;
}
