import { Link, NavLink, Outlet } from 'react-router-dom';
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

const sections: { heading?: string; items: NavEntry[] }[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: 'home', end: true }] },
  {
    heading: 'Relationships',
    items: [
      { to: '/companies', label: 'Companies', icon: 'building' },
      { to: '/contacts', label: 'Contacts', icon: 'users' },
      { to: '/applications', label: 'Applications', icon: 'briefcase' },
      { to: '/campaigns', label: 'Campaigns', icon: 'megaphone' },
    ],
  },
  {
    heading: 'Day to day',
    items: [
      { to: '/follow-ups', label: 'Follow-ups', icon: 'task' },
      { to: '/activity', label: 'Activity history', icon: 'activity' },
      { to: '/emails/new', label: 'Add email', icon: 'mail' },
      { to: '/prep', label: 'Conversation prep', icon: 'note' },
    ],
  },
  { heading: 'Data', items: [{ to: '/import-export', label: 'Import & export', icon: 'upload' }] },
];

function NavItem({ to, label, icon, end, badge }: NavEntry) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-white/12 text-white' : 'text-ivey-100 hover:bg-white/6 hover:text-white'
        }`
      }
    >
      <Icon name={icon} className="h-[18px] w-[18px]" />
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

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="flex flex-col bg-ivey-700 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64">
        <div className="px-6 pt-6 pb-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ivey-200 uppercase">Ivey · Experiential Learning</p>
          <p className="mt-1 text-lg leading-snug font-semibold">Relationship Workspace</p>
        </div>

        <nav aria-label="Main" className="flex flex-row flex-wrap gap-1 px-3 lg:flex-1 lg:flex-col">
          {sections.map((section) => (
            <div key={section.heading ?? 'main'} className="contents lg:block lg:pb-2">
              {section.heading && <p className="hidden px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-ivey-200 uppercase lg:block">{section.heading}</p>}
              {section.items.map((item) => (
                <NavItem key={item.to} {...item} badge={item.to === '/follow-ups' ? overdueCount : undefined} />
              ))}
            </div>
          ))}
          <div className="my-3 hidden border-t border-white/10 lg:block" />
          <NavItem to="/about" label="Prototype & data" icon="database" />
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
