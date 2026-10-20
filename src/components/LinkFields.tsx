import { useData } from '../state/DataContext';
import { fullName } from '../lib/selectors';
import { DO_NOT_CONTACT } from '../lib/options';
import { SelectField } from './ui';

export interface Link {
  companyId: string;
  contactId: string;
}

/**
 * Company + contact pickers that stay consistent: choosing a contact fills in their company,
 * and switching company clears a contact who doesn't work there.
 */
export function LinkFields({ value, onChange, error }: { value: Link; onChange: (next: Link) => void; error?: string }) {
  const { companies, contacts, contactById, companyById } = useData();

  function changeCompany(companyId: string) {
    const current = contactById.get(value.contactId);
    const keepContact = current && (!companyId || current.companyId === companyId);
    onChange({ companyId, contactId: keepContact ? value.contactId : '' });
  }

  function changeContact(contactId: string) {
    const person = contactById.get(contactId);
    onChange({ contactId, companyId: person?.companyId ?? value.companyId });
  }

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
    </>
  );
}

/** Starting company for a form opened from a contact's page. */
export function useInitialLink(companyId?: string | null, contactId?: string | null): Link {
  const { contactById } = useData();
  return {
    companyId: companyId ?? (contactId ? contactById.get(contactId)?.companyId : null) ?? '',
    contactId: contactId ?? '',
  };
}
