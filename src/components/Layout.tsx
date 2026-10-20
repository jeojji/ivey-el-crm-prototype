import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { useData } from '../state/DataContext';
import { UpgradeScreen } from './UpgradeScreen';
import { todayDateString } from '../lib/dates';
import { isOverdue } from '../lib/selectors';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  badge?: number;
}

/** Lauren's daily destinations. Everything else is one level down, and every URL still works. */
const primary: NavEntry[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/companies', label: 'Companies', icon: 'building' },
  { to: '/contacts', label: 'Contacts', icon: 'users' },
  { to: '/applications', label: 'Applications', icon: 'briefcase' },
  { to: '/follow-ups', label: 'Follow-ups', icon: 'task' },
];
const more: NavEntry[] = [
  { to: '/campaigns', label: 'Campaigns', icon: 'megaphone' },
  { to: '/activity', label: 'Activity history', icon: 'activity' },
  { to: '/prep', label: 'Conversation prep', icon: 'note' },
];
const admin: NavEntry[] = [
  { to: '/import-export', label: 'Import & export', icon: 'upload' },
  { to: '/about', label: 'Prototype & data', icon: 'database' },
];

function NavItem({ to, label, icon, end, badge, small }: NavEntry & { small?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-white ${small ? 'py-1.5 text-[13px]' : 'py-2 text-sm'} ${
          isActive ? 'bg-white/12 text-white' : 'text-ivey-100 hover:bg-white/6 hover:text-white'
        }`
      }
    >
      <Icon name={icon} className={small ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
      {label}
      {badge ? (
        <span className="ml-auto rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white" aria-label={`${badge} overdue`}>
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function Layout() {
  const { status, loadError, tasks } = useData();
  const today = todayDateString();
  const overdueCount = tasks.filter((t) => isOverdue(t, today)).length;
  const { pathname } = useLocation();
  const inMore = more.some((m) => pathname === m.to || pathname.startsWith(m.to + '/') || (m.to === '/prep' && pathname.startsWith('/briefs/')));
  // "More" opens itself when you're on one of its pages, and otherwise remembers what you chose.
  const [moreOpen, setMoreOpen] = useState(inMore);
  useEffect(() => {
    if (inMore) setMoreOpen(true);
  }, [inMore]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="flex flex-col bg-ivey-700 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64">
        <div className="px-6 pt-6 pb-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ivey-200 uppercase">Ivey · Experiential Learning</p>
          <p className="mt-1 text-lg leading-snug font-semibold">Relationship Workspace</p>
        </div>

        <nav aria-label="Main" className="flex flex-row flex-wrap gap-1 px-3 lg:flex-1 lg:flex-col">
          {primary.map((item) => (
            <NavItem key={item.to} {...item} badge={item.to === '/follow-ups' ? overdueCount : undefined} />
          ))}
          <div className="contents lg:block lg:pt-2">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="nav-more"
              onClick={() => setMoreOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ivey-100 hover:bg-white/6 hover:text-white focus-visible:outline-2 focus-visible:outline-white lg:w-full"
            >
              <Icon name="chevronRight" className={`h-[18px] w-[18px] transition-transform ${moreOpen ? 'rotate-90' : ''}`} />
              More
            </button>
            <div id="nav-more" hidden={!moreOpen} className="lg:pl-3">
              {more.map((item) => <NavItem key={item.to} {...item} />)}
            </div>
          </div>
          <div className="contents lg:mt-auto lg:block lg:border-t lg:border-white/10 lg:pt-3">
            <p className="hidden px-3 pb-1 text-[11px] font-semibold tracking-wider text-ivey-200 uppercase lg:block">Administration</p>
            {admin.map((item) => <NavItem key={item.to} {...item} small />)}
          </div>
        </nav>

        <div className="m-3 hidden rounded-lg bg-black/20 p-3.5 text-xs leading-relaxed text-ivey-100 lg:block">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
            Prototype
          </p>
          Fictional data only. Saved in this browser. No email, Salesforce or calendar connections.
          <Link to="/about#demo-data" className="mt-2 block font-medium text-white underline-offset-2 hover:underline">Reset demo data…</Link>
        </div>
      </aside>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {status === 'loading' && <p className="text-sm text-neutral-600">Loading workspace…</p>}
        {status === 'error' && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">The workspace could not load its data.</p>
            <p className="mt-1">{loadError}</p>
          </div>
        )}
        {status === 'needs-upgrade' && <UpgradeScreen />}
        {status === 'ready' && <Outlet />}
      </main>
    </div>
  );
}
