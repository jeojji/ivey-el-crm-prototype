import { useState } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { Button, Card } from './ui';
import { Icon } from './Icon';

/** Shown once when this browser holds data from the previous version of the prototype. */
export function UpgradeScreen() {
  const { pendingMigration, runMigration, downloadBackup } = useData();
  const { notify } = useToast();
  const [downloaded, setDownloaded] = useState(false);
  const [working, setWorking] = useState(false);
  if (!pendingMigration) return null;
  const { counts, unmatchedStatuses, unmatchedIndustries } = pendingMigration;

  async function backup() {
    try {
      if (await downloadBackup('pre-upgrade')) {
        setDownloaded(true);
        notify('Backup saved to your Downloads folder.');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create the backup.', 'error');
    }
  }

  async function upgrade() {
    setWorking(true);
    try {
      await runMigration();
      notify(`Upgrade complete. All ${counts.companies} companies and ${counts.contacts} contacts were kept.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'The upgrade failed. Your data has not been changed.', 'error');
      setWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Update your saved data</h1>
      <p className="mt-2 text-sm text-neutral-600">
        This version adds the fields from Lauren's requirements (priorities, multiple statuses, project participation,
        contact roles, alumni details and more). The data saved in this browser needs a one-time upgrade first.
      </p>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900">What will happen</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-ivey-700" />
            All {counts.companies} companies, {counts.contacts} contacts, {counts.activities} activities and {counts.tasks} follow-ups are kept.</li>
          <li className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-ivey-700" />
            New fields start empty. Nothing is filled in automatically.</li>
          <li className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-ivey-700" />
            Old statuses that match Lauren's list (e.g. "Active partner") become the matching option. Each company also keeps its original value for reference.</li>
          <li className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-ivey-700" />
            A contact's old "Phone" becomes their work phone. A company's old city text stays in City as it was.</li>
          <li className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-ivey-700" />
            The original data stays in this browser untouched, as a second backup.</li>
        </ul>
        {unmatchedStatuses.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">{unmatchedStatuses.length} status{unmatchedStatuses.length === 1 ? '' : 'es'} will be flagged for review</p>
            <p className="mt-0.5">These aren't in Lauren's list. They'll be kept exactly as they are and marked "Needs review":</p>
            <ul className="mt-1.5 list-disc pl-5">
              {unmatchedStatuses.map((u) => (
                <li key={u.company}>{u.company}: “{u.status}”</li>
              ))}
            </ul>
          </div>
        )}
        {unmatchedIndustries.length > 0 && (
          <p className="mt-3 text-sm text-neutral-700">
            Industries typed into the previous version ({unmatchedIndustries.map((i) => `“${i}”`).join(', ')}) aren't in Lauren's
            industry list either. They'll also be kept as they are and marked "Needs review", so you can pick the closest match later.
          </p>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon="database" onClick={backup}>{downloaded ? 'Download backup again' : '1. Download a backup'}</Button>
        <Button onClick={upgrade} disabled={working}>{working ? 'Upgrading…' : downloaded ? '2. Upgrade my data' : 'Upgrade without downloading'}</Button>
      </div>
      <p className="mt-3 text-xs text-neutral-500">The backup is a .json file containing everything currently saved in this browser.</p>
    </div>
  );
}
