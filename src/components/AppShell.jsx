import { FileStack, History, LogOut, Plus } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';

const navItem = ({ isActive }) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-brand text-white' : 'text-slate-700 hover:bg-slate-200'}`;

export const AppShell = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-200 bg-white px-4 py-5">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-ink text-white">
            <FileStack size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold">Replace</div>
            <div className="text-xs text-slate-500">{user?.email}</div>
          </div>
        </div>
        <nav className="space-y-1">
          <NavLink className={navItem} to="/">
            <FileStack size={17} /> Dashboard
          </NavLink>
          <NavLink className={navItem} to="/batches/new">
            <Plus size={17} /> New batch
          </NavLink>
          <NavLink className={navItem} to="/history">
            <History size={17} /> History
          </NavLink>
        </nav>
        <button
          className="focus-ring absolute bottom-5 left-4 right-4 flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
          onClick={logout}
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <main className="ml-64 min-h-screen px-8 py-7">
        <Outlet />
      </main>
    </div>
  );
};
