import { useData } from '../state/DataContext';
import { fullName } from '../lib/selectors';
import { DO_NOT_CONTACT } from '../lib/options';
import { SelectField } from './ui';

export interface Link {
  companyId: string;
  contactId: string;
  /** '' when not linked to an application. */
  applicationId: string;
}

/**
 * Company + contact pickers that stay consistent: choosing a contact fills in their company,
 * and switching company clears a contact who doesn't work there.
 */
export function LinkFields({ value, onChange, error, withApplication = false }: {
  value: Link;
  onChange: (next: Link) => void;
  error?: string;
  /** Also offer an Application picker (activities and follow-ups). */
  withApplication?: boolean;
}) {
  const { companies, contacts, applications, contactById, companyById, applicationById } = useData();

  // An application belongs to one company, so it's dropped when the company changes away from it.
  const keepApplication = (companyId: string) => {
    const app = applicationById.get(value.applicationId);
    return app && app.companyId === companyId ? value.applicationId : '';
  };

  function changeCompany(companyId: string) {
    const current = contactById.get(value.contactId);
    const keepContact = current && (!companyId || current.companyId === companyId);
    onChange({ companyId, contactId: keepContact ? value.contactId : '', applicationId: keepApplication(companyId) });
  }

  function changeContact(contactId: string) {
    const person = contactById.get(contactId);
    const companyId = person?.companyId ?? value.companyId;
    onChange({ contactId, companyId, applicationId: keepApplication(companyId) });
  }

  function changeApplication(applicationId: string) {
    const app = applicationById.get(applicationId);
    if (!app) return onChange({ ...value, applicationId: '' });
    const person = contactById.get(value.contactId);
    const contactId = person && person.companyId === app.companyId ? value.contactId : (app.primaryContactId ?? '');
    onChange({ applicationId, companyId: app.companyId, contactId });
  }

  const applicationChoices = applications
    .filter((a) => !value.companyId || a.companyId === value.companyId || a.id === value.applicationId)
    .sort((a, b) => a.title.localeCompare(b.title));

  // The selected contact always stays in the list, even if they've since moved company
  // (e.g. when editing an older activity), so the link isn't silently lost.
  const selected = contactById.get(value.contactId);
  const contactChoices = contacts
    .filter((c) => !value.companyId || c.companyId === value.companyId || c.id === value.contactId)
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const label = (c: (typeof contacts)[number]) => {
    const movedAway = value.companyId && c.companyId !== value.companyId;
    const now = c.companyId ? companyById.get(c.companyId)?.name : 'no company';
    return `${fullName(c)}${movedAway ? ` (now at ${now})` : ''}${c.priority === DO_NOT_CONTACT ? ' · Do Not Contact' : ''}`;
  };

  return (
    <>
      <SelectField
        label="Company"
        value={value.companyId}
        onChange={changeCompany}
        error={error}
        options={[
          { value: '', label: 'No company' },
          ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <SelectField
        label="Contact"
        value={value.contactId}
        onChange={changeContact}
        options={[
          { value: '', label: contactChoices.length ? 'No contact' : 'No contacts at this company' },
          ...contactChoices.map((c) => ({ value: c.id, label: label(c) })),
        ]}
        hint={selected?.priority === DO_NOT_CONTACT ? `${fullName(selected)} is marked Do Not Contact.` : undefined}
      />
      {withApplication && (
        <SelectField
          className="sm:col-span-2"
          label="Application"
          value={value.applicationId}
          onChange={changeApplication}
          options={[
            { value: '', label: applicationChoices.length ? 'Not about a specific application' : value.companyId ? 'No applications for this company' : 'No applications yet' },
            ...applicationChoices.map((a) => ({
              value: a.id,
              label: `${a.title} · ${a.stage}${value.companyId ? '' : ` · ${companyById.get(a.companyId)?.name ?? ''}`}`,
            })),
          ]}
          hint="Optional. Link this to an engagement opportunity on the Applications page."
        />
      )}
    </>
  );
}

/** Starting links for a form opened from a contact's or application's page. */
export function useInitialLink(companyId?: string | null, contactId?: string | null, applicationId?: string | null): Link {
  const { contactById, applicationById } = useData();
  const app = applicationId ? applicationById.get(applicationId) : undefined;
  return {
    companyId: companyId ?? app?.companyId ?? (contactId ? contactById.get(contactId)?.companyId : null) ?? '',
    contactId: contactId ?? (app && !companyId ? (app.primaryContactId ?? '') : '') ?? '',
    applicationId: applicationId ?? '',
  };
}
