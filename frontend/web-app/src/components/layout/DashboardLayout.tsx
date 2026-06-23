'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import Sidebar from './Sidebar';
import { Bell, User } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function DashboardLayout({
  children,
  title,
}: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, loadFromStorage } = useAuthStore();

  // Hydrate from localStorage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Auth guard
  useEffect(() => {
    // Small delay to allow hydration
    const timeout = setTimeout(() => {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null;
      if (!token && !isAuthenticated) {
        router.replace('/auth/login');
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [isAuthenticated, router]);

  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">
      {/* Sidebar */}
      <Sidebar currentPath={pathname} />

      {/* Main content area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen overflow-hidden">
        {/* Top header bar */}
        <header className="h-16 shrink-0 border-b border-slate-800 bg-[#080e1c]/80 backdrop-blur-sm flex items-center justify-between px-6 z-30">
          {/* Page title */}
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-white">{title}</h1>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <button
              className="relative w-9 h-9 rounded-lg border border-slate-700 bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-600 transition-all"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {/* Unread indicator */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-1 ring-[#080e1c]" />
            </button>

            {/* User avatar */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                {user?.full_name ? (
                  <span className="text-xs font-semibold text-white">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-slate-200 leading-tight">
                  {user?.full_name ?? 'User'}
                </p>
                <p className="text-[10px] text-slate-500 capitalize leading-tight">
                  {user?.role ?? 'Member'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#0a0f1e]">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
