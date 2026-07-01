import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const authRequired = import.meta.env.VITE_AUTH_REQUIRED === 'true';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="brand-shell min-h-screen flex items-center justify-center p-8 text-sm font-medium text-slate-600">
        Loading account.
      </div>
    );
  }

  if (authRequired && !user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/account" state={{ returnTo }} replace />;
  }

  return <Outlet />;
}
