import { Link } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { briefFreshness } from '../lib/briefSources';
import { formatDate } from '../lib/dates';
import { fullName } from '../lib/selectors';
import type { Brief } from '../types';
import { Badge, Card } from './ui';

/** Newest saved brief that matches the record, so it can be opened without generating a new one. */
export function latestBriefFor(briefs: Brief[], match: (b: Brief) => boolean): Brief | undefined {
  return briefs.filter(match).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
}

/**
 * The latest saved relationship brief for a record: when it was made, whether newer records exist,
 * its first recorded facts, and a link to open it. "Prepare for conversation" makes a new one.
 */
export function LatestBriefCard({ brief, prepLink }: { brief?: Brief; prepLink: string }) {
  const { database, contactById, applicationById } = useData();
  const fresh = brief ? briefFreshness(brief, database) : null;
  const about = brief
    ? [brief.contactId && contactById.get(brief.contactId) && fullName(contactById.get(brief.contactId)!), brief.applicationId && applicationById.get(brief.applicationId)?.title].filter(Boolean).join(' · ')
    : '';
  return (
    <Card
      title="Latest relationship brief"
      action={<Link to={prepLink} className="text-sm font-medium text-ivey-700 hover:underline">{brief ? 'Make a new brief' : 'Prepare for conversation'}</Link>}
    >
      {brief ? (
        <div className="text-sm">
          <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
            Saved {formatDate(brief.generatedAt)}{about && ` · ${about}`} · made with local AI from {brief.sources.length} records
            {fresh?.outdated && <Badge className="bg-amber-50 text-amber-900 ring-amber-300">May be outdated</Badge>}
          </p>
          {brief.content.summary.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-800">
              {brief.content.summary.slice(0, 3).map((f) => <li key={f.text}>{f.text}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-neutral-600">This brief found little to summarise.</p>
          )}
          {fresh?.outdated && <p className="mt-2 text-xs text-amber-900">Records it used were edited or deleted since. Open it to see which, or make a new one.</p>}
          {fresh && fresh.newer > 0 && (
            <p className="mt-2 text-xs text-neutral-600">
              {fresh.newer} newer communication{fresh.newer === 1 ? '' : 's'} added since {fresh.newer === 1 ? 'isn’t' : 'aren’t'} included.
            </p>
          )}
          <Link to={`/briefs/${brief.id}`} className="mt-3 inline-flex items-center rounded-md bg-ivey-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-ivey-800">
            Open brief
          </Link>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">No saved brief yet. “Prepare for conversation” summarises the records with the local AI, with each fact linked to the record it came from.</p>
      )}
    </Card>
  );
}
