'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
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
  Bot,
  RefreshCw,
  Brain,
  Settings,
  Zap,
  LogOut,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
      {
        label: 'Projects',
        href: '/projects',
        icon: <FolderOpen className="w-4 h-4" />,
      },
    ],
  },
  {
    title: 'SDLC Phases',
    items: [
      {
        label: 'Requirements',
        href: '/requirements',
        icon: <FileText className="w-4 h-4" />,
      },
      {
        label: 'Design',
        href: '/projects',
        icon: <Compass className="w-4 h-4" />,
      },
      {
        label: 'Development',
        href: '/projects',
        icon: <Code2 className="w-4 h-4" />,
      },
      {
        label: 'Testing',
        href: '/testing',
        icon: <TestTube className="w-4 h-4" />,
      },
      {
        label: 'Deployment',
        href: '/deployment',
        icon: <Rocket className="w-4 h-4" />,
      },
      {
        label: 'Monitoring',
        href: '/monitoring',
        icon: <Activity className="w-4 h-4" />,
      },
      {
        label: 'Analytics',
        href: '/analytics',
        icon: <BarChart3 className="w-4 h-4" />,
      },
    ],
  },
  {
    title: 'AI Engines',
    items: [
      {
        label: 'Agent Developer',
        href: '/agents',
        icon: <Bot className="w-4 h-4" />,
      },
      {
        label: 'Legacy Conversion',
        href: '/legacy',
        icon: <RefreshCw className="w-4 h-4" />,
      },
      {
        label: 'Business Extraction',
        href: '/extraction',
        icon: <Brain className="w-4 h-4" />,
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        label: 'Settings',
        href: '/settings',
        icon: <Settings className="w-4 h-4" />,
      },
    ],
  },
];

interface SidebarProps {
  currentPath: string;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.replace('/auth/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return currentPath === '/dashboard';
    return currentPath.startsWith(href) && href !== '/';
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#080e1c] border-r border-slate-800 flex flex-col z-40 overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold gradient-text tracking-tight">
              Xccelera
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 tracking-wider uppercase">
              AI
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <span
                        className={`shrink-0 transition-colors ${
                          active
                            ? 'text-blue-400'
                            : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && (
                        <ChevronRight className="w-3 h-3 text-blue-400/60 shrink-0" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User info / Logout */}
      <div className="px-3 py-4 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-800">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">
              {user?.full_name ?? 'User'}
            </p>
            <p className="text-[10px] text-slate-500 truncate capitalize">
              {user?.role ?? 'Member'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
