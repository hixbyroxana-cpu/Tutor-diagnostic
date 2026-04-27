import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, CheckSquare } from 'lucide-react';
import { cn } from '../lib/utils';

export function AdminLayout() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Tests', path: '/tests' },
    { name: 'Results', path: '/results' },
  ];

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
            Σ
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">Tutor Diag</h1>
        </div>
        <div className="flex gap-4 md:gap-6 text-sm font-medium text-slate-600">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "transition-colors pb-1 border-b-2",
                  isActive
                    ? "text-blue-600 border-blue-600"
                    : "border-transparent hover:text-blue-600"
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">System Online</span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
