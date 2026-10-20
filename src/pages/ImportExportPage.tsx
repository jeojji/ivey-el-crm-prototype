import { useState, type ChangeEvent } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { readFileText } from '../lib/csv';
import { downloadTextFile, timestampForFilename } from '../lib/download';
import { checkBackup, type BackupCheck } from '../data/backup';
import { activitiesCsv, applicationsCsv, companiesCsv, contactsCsv, followUpsCsv } from '../import/exporters';
import { Button, Card, PageHeader } from '../components/ui';
import { ConfirmDialog } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ImportWizard } from '../components/ImportWizard';

export function ImportExportPage() {
  const data = useData();
  const { notify } = useToast();
  const [restore, setRestore] = useState<{ fileName: string; check: BackupCheck } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const db = data.database;

  function exportCsv(name: string, csv: string) {
    downloadTextFile(`el-workspace-${name}-${timestampForFilename()}.csv`, csv, 'text/csv;charset=utf-8');
    notify(`${name[0].toUpperCase()}${name.slice(1)} exported to your Downloads folder.`);
  }

  async function backup() {
    try {
      await data.downloadBackup('current');
      notify('Backup saved to your Downloads folder.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create the backup.', 'error');
    }
  }

  async function onRestoreFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestore({ fileName: file.name, check: checkBackup(await readFileText(file)) });
  }

  async function doRestore() {
    setConfirmRestore(false);
    if (!restore?.check.ok) return;
    try {
      await data.restoreBackup(restore.check.db);
      notify(`Backup restored from ${restore.fileName}.`);
      setRestore(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Restore failed. Your data was not changed.', 'error');
    }
  }

  const current = { companies: data.companies.length, contacts: data.contacts.length, applications: data.applications.length, activities: data.activities.length, tasks: data.tasks.length, campaigns: data.campaigns.length, feedback: data.feedback.length };

  return (
    <>
      <PageHeader
        title="Import & export"
        description="Bring in Lauren's Salesforce template files, export to CSV, and back up or restore the whole workspace. Files are read and created in this browser only. Nothing is uploaded."
      />

      <Card title="Fictional demo files" className="mb-6">
        <p className="text-sm text-neutral-700">
          Made-up companies, contacts and an application email in Lauren's template format, for trying the import and
          “Add email” workflows. Nothing in them is real.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['demo-accounts.csv', 'Demo companies (CSV)'],
            ['demo-contacts.csv', 'Demo contacts (CSV)'],
            ['demo-application-email.txt', 'Demo application email (text)'],
          ].map(([file, label]) => (
            <a key={file} href={`./demo/${file}`} download={file} className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 shadow-xs hover:bg-neutral-50">
              <Icon name="download" className="h-4 w-4" />
              {label}
            </a>
          ))}
        </div>
      </Card>

      <Card title="Import from CSV" className="mb-6">
        <ImportWizard />
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Export to CSV">
          <p className="mb-4 text-sm text-neutral-700">
            Company and contact files use the same column headers as the Salesforce templates, plus a Workspace ID column. Re-importing an export
            matches every record, so nothing is duplicated.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="download" onClick={() => exportCsv('companies', companiesCsv(db))}>Companies ({current.companies})</Button>
            <Button variant="secondary" icon="download" onClick={() => exportCsv('contacts', contactsCsv(db))}>Contacts ({current.contacts})</Button>
            <Button variant="secondary" icon="download" onClick={() => exportCsv('applications', applicationsCsv(db))}>Applications ({current.applications})</Button>
            <Button variant="secondary" icon="download" onClick={() => exportCsv('activities', activitiesCsv(db))}>Activities ({current.activities})</Button>
            <Button variant="secondary" icon="download" onClick={() => exportCsv('follow-ups', followUpsCsv(db))}>Follow-ups ({current.tasks})</Button>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            “Last Project Participated” is the EL project date you record. “Last Communication” is worked out from logged emails, calls and meetings,
            and is exported for reference only. Importing never changes it.
          </p>
        </Card>

        <Card title="Backup & restore">
          <p className="mb-4 text-sm text-neutral-700">A backup is a .json file with every company, contact, application, activity and follow-up in this browser.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="download" onClick={backup}>Download full backup</Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 shadow-xs hover:bg-neutral-50 has-focus-visible:outline-2 has-focus-visible:outline-ivey-600">
              <Icon name="upload" className="h-4 w-4" />
              Restore from backup…
              <input type="file" accept=".json,application/json" onChange={onRestoreFile} className="sr-only" />
            </label>
          </div>

          {restore && !restore.check.ok && (
            <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="font-semibold">“{restore.fileName}” can't be restored. Your data has not been changed.</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
                {restore.check.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {restore?.check.ok && (
            <div className="mt-4 rounded-md border border-neutral-200 p-4 text-sm">
              <p className="font-semibold text-neutral-950">“{restore.fileName}” passed all checks</p>
              {restore.check.fromVersion < 3 && <p className="mt-0.5 text-xs text-neutral-600">It's from an earlier version and will be upgraded as it's restored. Unmatched values are kept and flagged; no applications are created.</p>}
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr><th scope="col" className="py-1 font-medium"></th><th scope="col" className="py-1 font-medium">Now</th><th scope="col" className="py-1 font-medium">In backup</th></tr>
                </thead>
                <tbody className="text-neutral-800 tabular-nums">
                  {(['companies', 'contacts', 'applications', 'activities', 'tasks', 'campaigns', 'feedback'] as const).map((k) => (
                    <tr key={k} className="border-t border-neutral-100">
                      <td className="py-1 capitalize">{k === 'tasks' ? 'Follow-ups' : k}</td>
                      <td className="py-1">{current[k]}</td>
                      <td className="py-1">{restore.check.ok && restore.check.counts[k]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-neutral-600">Restoring replaces everything currently in this browser. Download a backup of the current data first if you might need it.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon="download" onClick={backup}>Back up current data</Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmRestore(true)}>Replace with this backup</Button>
                <Button size="sm" variant="ghost" onClick={() => setRestore(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmRestore}
        title="Replace all workspace data?"
        message={`Everything in this browser will be replaced with the contents of “${restore?.fileName}”. This can't be undone unless you have a backup.`}
        confirmLabel="Replace data"
        onConfirm={doRestore}
        onCancel={() => setConfirmRestore(false)}
      />
    </>
  );
}
