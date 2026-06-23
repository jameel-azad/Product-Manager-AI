'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { projectsApi } from '@/lib/api';
import { clsx } from 'clsx';

const SUB_NAV_TABS = [
  { label: 'Overview', href: '' },
  { label: 'Requirements', href: '/requirements' },
  { label: 'Design', href: '/design' },
  { label: 'Development', href: '/development' },
  { label: 'Testing', href: '/testing' },
  { label: 'Deployment', href: '/deployment' },
  { label: 'Monitoring', href: '/monitoring' },
  { label: 'Analytics', href: '/analytics' },
];

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: { id: string };
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const [projectName, setProjectName] = useState<string>('Loading...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    projectsApi
      .get(params.id)
      .then((res) => {
        setProjectName(res.data?.name ?? 'Unknown Project');
      })
      .catch(() => {
        setError('Failed to load project');
        setProjectName('Project');
      });
  }, [params?.id]);

  const basePath = `/projects/${params?.id}`;

  return (
    <div className="flex flex-col min-h-full">
      {/* Project header */}
      <div className="border-b border-slate-800 bg-[#0f172a]">
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/projects"
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Projects
            </Link>
            <span className="text-slate-600 text-sm">/</span>
            <span className="text-slate-200 text-sm font-medium">
              {projectName}
            </span>
          </div>

          {error && (
            <p className="text-red-400 text-xs mb-2">{error}</p>
          )}

          <h1 className="text-xl font-semibold text-white mb-4">
            {projectName}
          </h1>

          {/* Sub-navigation tabs */}
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {SUB_NAV_TABS.map((tab) => {
              const href = `${basePath}${tab.href}`;
              const isActive =
                tab.href === ''
                  ? pathname === basePath || pathname === basePath + '/'
                  : pathname.startsWith(href);

              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={clsx(
                    'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                    isActive
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
