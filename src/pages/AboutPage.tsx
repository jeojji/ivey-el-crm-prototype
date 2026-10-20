import { useState } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { STORAGE_KEY } from '../data/localStorageRepository';
import { Button, Card, PageHeader } from '../components/ui';
import { ConfirmDialog } from '../components/Modal';
import { Icon } from '../components/Icon';

export function AboutPage() {
  const { companies, contacts, activities, tasks, resetToSampleData, clearAllData } = useData();
  const { notify } = useToast();
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null);

  async function run(action: 'reset' | 'clear') {
    setConfirm(null);
    try {
      if (action === 'reset') {
        await resetToSampleData();
        notify('Sample data restored.');
      } else {
        await clearAllData();
        notify('Workspace cleared. You now have an empty workspace.');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Something went wrong.', 'error');
    }
  }

  return (
    <>
      <PageHeader title="Prototype & data" description="What this prototype is, where its data lives, and what isn't connected yet." />

      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="About this prototype" className="lg:col-span-2">
          <div className="space-y-3 text-sm text-neutral-700">
            <p>
              An interactive prototype of a unified relationship workspace for Experiential Learning, built for the
              Ivey MSc Advanced Field Project. It explores how company and contact history, activity and follow-ups
              could live in one place.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">All sample organizations and people are fictional.</strong>{' '}
              Do not enter real personal information.
            </p>
          </div>
        </Card>

        <Card title="Not connected">
          <ul className="space-y-2.5 text-sm text-neutral-700">
            {['Email (Outlook / Gmail)', 'Salesforce', 'Calendly or calendars', 'AI services'].map((s) => (
              <li key={s} className="flex items-center gap-2">
                <Icon name="x" className="h-4 w-4 text-neutral-400" />
                {s}: <span className="text-neutral-500">not connected</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-neutral-600">Every activity is logged by hand. Nothing is sent, synced or read from other systems.</p>
        </Card>

        <Card title="Where data is stored">
          <div className="space-y-3 text-sm text-neutral-700">
            <p>
              Data is saved in <strong className="font-semibold text-neutral-900">this browser's local storage</strong> on this
              device only. It is not shared with anyone, not backed up, and not a secure database.
            </p>
            <p>Clearing your browser data, or using a different browser or computer, gives you a separate workspace.</p>
            <p className="text-xs text-neutral-500">Storage key: <code className="rounded bg-neutral-100 px-1 py-0.5">{STORAGE_KEY}</code></p>
          </div>
        </Card>

        <Card title="Workspace data" className="lg:col-span-2">
          <dl className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Companies', companies.length],
              ['Contacts', contacts.length],
              ['Activities', activities.length],
              ['Follow-ups', tasks.length],
            ].map(([label, n]) => (
              <div key={label} className="rounded-lg bg-neutral-50 px-4 py-3">
                <dt className="text-xs text-neutral-600">{label}</dt>
                <dd className="text-xl font-semibold text-neutral-950 tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setConfirm('reset')}>Reset to sample data</Button>
            <Button variant="secondary" onClick={() => setConfirm('clear')}>Start with an empty workspace</Button>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Useful for demos and testing. Both replace everything currently saved in this browser.</p>
        </Card>

        <Card title="Coming in the next builds" className="lg:col-span-2">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-700">
            <li>CSV import (with preview and validation) and CSV export</li>
            <li>Publishing the prototype to GitHub Pages</li>
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset to sample data?"
        message="Everything you've added or changed in this browser will be replaced with the original fictional sample data."
        confirmLabel="Reset data"
        onConfirm={() => run('reset')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        title="Start with an empty workspace?"
        message="All companies, contacts, activities and follow-ups in this browser will be deleted. You can restore the sample data later."
        confirmLabel="Delete everything"
        onConfirm={() => run('clear')}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
