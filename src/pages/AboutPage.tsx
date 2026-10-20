import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { STORAGE_KEY } from '../data/localStorageRepository';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import { ConfirmDialog } from '../components/Modal';
import { Icon } from '../components/Icon';
import { DEMO_MODE } from '../ai/client';

export function AboutPage() {
  const data = useData();
  const { companies, contacts, activities, tasks, applications, resetToSampleData, clearAllData, downloadBackup } = data;
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

  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#demo-data') document.getElementById('demo-data')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const counts: [string, number][] = [
    ['Companies', companies.length],
    ['Contacts', contacts.length],
    ['Applications', applications.length],
    ['Activities', activities.length],
    ['Follow-ups', tasks.length],
    ['Campaigns', data.campaigns.length],
    ['Feedback', data.feedback.length],
    ['Briefs', data.briefs.length],
  ];

  async function backup(kind: 'current' | 'pre-upgrade') {
    try {
      const saved = await downloadBackup(kind);
      notify(saved ? 'Backup saved to your Downloads folder.' : 'There is no data from the previous version in this browser.', saved ? 'success' : 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create the backup.', 'error');
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

        <Card title="What works where" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-neutral-600 uppercase">
                <tr><th scope="col" className="py-2 pr-4">Status</th><th scope="col" className="py-2">Features</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 align-top">
                <tr>
                  <td className="py-3 pr-4"><Badge className="bg-ivey-50 text-ivey-800 ring-ivey-200">Working</Badge><p className="mt-1 text-xs text-neutral-500">Saved in this browser</p></td>
                  <td className="py-3 text-neutral-800">Companies, contacts, applications and pipeline, campaigns (tracking only), follow-ups, activity history, “Add email” with manual review, project feedback and flags, CSV import/export, JSON backup and restore.</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4"><Badge className="bg-violet-50 text-violet-800 ring-violet-200">AI suggestions</Badge><p className="mt-1 text-xs text-neutral-500">{DEMO_MODE ? 'Not in this online demo' : 'Local computer only'}</p></td>
                  <td className="py-3 text-neutral-800">
                    Suggested details from a pasted email, and relationship briefs with conversation prep. They run on a model on your own computer (Ollama), are always shown as suggestions with sources, and are never saved without your confirmation.
                    {DEMO_MODE && <span className="mt-1 block text-neutral-600">This online demo can't run them: they need the local installation (see SETUP-LOCAL-AI.md in the project).</span>}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4"><Badge className="bg-neutral-100 text-neutral-700 ring-neutral-200">Not connected</Badge><p className="mt-1 text-xs text-neutral-500">Not built in the prototype</p></td>
                  <td className="py-3 text-neutral-800">Outlook or any inbox, Salesforce, Calendly or calendars, meeting note-taking tools, cloud AI services, sending email or running sequences, sign-in and shared access for colleagues.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Not connected">
          <ul className="space-y-2.5 text-sm text-neutral-700">
            {['Email (Outlook / Gmail)', 'Salesforce', 'Calendly or calendars', 'Cloud AI services'].map((s) => (
              <li key={s} className="flex items-center gap-2">
                <Icon name="x" className="h-4 w-4 text-neutral-400" />
                {s}: <span className="text-neutral-500">not connected</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-neutral-600">Every activity is logged by hand. Nothing is sent, synced or read from other systems.</p>
          <p className="mt-3 text-sm text-neutral-600">
            <strong className="font-semibold text-neutral-800">Local AI (optional):</strong>{' '}
            {DEMO_MODE
              ? 'not available in this online demo. On a computer set up with Ollama, “Add email” can suggest details using a model that runs entirely on that computer.'
              : '“Add email” can suggest details using a model running on this computer through Ollama. Emails are never sent to a cloud AI, and there is no cloud fallback. Suggestions are only proposals that you review.'}
          </p>
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

        <Card title="Demo data and backups" className="lg:col-span-2">
          <div id="demo-data" className="scroll-mt-6" />
          <p className="mb-4 text-sm text-neutral-700">What's saved in this browser right now:</p>
          <dl className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
            {counts.map(([label, n]) => (
              <div key={label} className="rounded-lg bg-neutral-50 px-4 py-3">
                <dt className="text-xs text-neutral-600">{label}</dt>
                <dd className="text-xl font-semibold text-neutral-950 tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4">
              <h3 className="text-sm font-semibold text-neutral-950">Backups</h3>
              <p className="mt-1 text-xs text-neutral-600">A .json file with everything in this browser, saved to your Downloads folder. Restore it from Import &amp; export.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon="download" onClick={() => backup('current')}>Download backup</Button>
                <Button size="sm" variant="ghost" onClick={() => backup('pre-upgrade')}>Download pre-upgrade original</Button>
              </div>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4">
              <h3 className="text-sm font-semibold text-neutral-950">Reset demo data</h3>
              <p className="mt-1 text-xs text-neutral-700">For demos and testing. Both options <strong>replace everything</strong> saved in this browser. You'll be asked to confirm, with a chance to download a backup first.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirm('reset')}>Reset to fictional demo data</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirm('clear')}>Start with an empty workspace</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Not in this prototype" className="lg:col-span-2">
          <p className="mb-2 text-sm text-neutral-700">From Lauren's request, these are out of scope for now:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-700">
            <li>Sending emails or running email sequences (campaigns are tracked by hand, and nothing is sent)</li>
            <li>Sign-in, shared access and record sharing</li>
            <li>Connecting partners to courses and student teams (Lauren's Phase 2)</li>
          </ul>
          <p className="mt-3 text-sm text-neutral-700">
            CSV import/export and full backups are on the <Link to="/import-export" className="font-medium text-ivey-700 hover:underline">Import &amp; export</Link> page.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset to fictional demo data?"
        message={<ReplaceWarning action="replaced with the original fictional demo data" counts={counts} onBackup={() => backup('current')} />}
        confirmLabel="Replace with demo data"
        onConfirm={() => run('reset')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        title="Start with an empty workspace?"
        message={<ReplaceWarning action="deleted, leaving an empty workspace" counts={counts} onBackup={() => backup('current')} />}
        confirmLabel="Delete everything"
        onConfirm={() => run('clear')}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function ReplaceWarning({ action, counts, onBackup }: { action: string; counts: [string, number][]; onBackup: () => void }) {
  const nonEmpty = counts.filter(([, n]) => n > 0);
  return (
    <div className="space-y-3">
      <p>Everything saved in this browser will be {action}:</p>
      <p className="text-neutral-800">{nonEmpty.length ? nonEmpty.map(([l, n]) => `${n} ${l.toLowerCase()}`).join(' · ') : 'The workspace is already empty.'}</p>
      <p className="text-neutral-600">This can't be undone without a backup.</p>
      <Button size="sm" variant="secondary" icon="download" onClick={onBackup}>Download a backup first</Button>
    </div>
  );
}
