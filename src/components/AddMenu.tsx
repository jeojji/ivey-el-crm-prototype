import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { fullName } from '../lib/selectors';
import { MenuButton } from './Menu';
import { Modal } from './Modal';
import { ActivityForm, tomorrowAtTen } from './ActivityForm';
import { CompanyForm } from './CompanyForm';
import { ContactForm } from './ContactForm';
import { ApplicationForm } from './applications';
import { TaskForm } from './TaskForm';

type Kind = 'call' | 'schedule' | 'meetingNotes' | 'task' | 'company' | 'contact' | 'application';

/** Builds the Add email link, carrying the record it was started from. */
export function emailIntakeLink(ctx: { companyId?: string | null; contactId?: string | null; applicationId?: string | null }) {
  const q = new URLSearchParams();
  if (ctx.companyId) q.set('company', ctx.companyId);
  if (ctx.contactId) q.set('contact', ctx.contactId);
  if (ctx.applicationId) q.set('application', ctx.applicationId);
  const s = q.toString();
  return `/emails/new${s ? `?${s}` : ''}`;
}

/**
 * The one "+ Add" menu used in every page header. Opened from a record, it prefills that record's
 * company, contact and application in whatever is added, and stays on the record after saving.
 * Opened from a list or Home, a new company, contact or application opens its own page.
 */
export function AddMenu({ companyId, contactId, applicationId }: { companyId?: string; contactId?: string; applicationId?: string }) {
  const { companyById, contactById, applicationById } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Kind | null>(null);
  const close = () => setOpen(null);

  // Fill in what the record implies: an application's company and primary contact, a contact's company.
  const app = applicationId ? applicationById.get(applicationId) : undefined;
  const contactKey = contactId || app?.primaryContactId || undefined;
  const contact = contactKey ? contactById.get(contactKey) : undefined;
  const companyKey = companyId || app?.companyId || contact?.companyId || undefined;
  const company = companyKey ? companyById.get(companyKey) : undefined;
  const ctx = { companyId: company?.id, contactId: contact?.id, applicationId: app?.id };
  const forWhom = [company?.name, contact && fullName(contact), app?.title].filter(Boolean).join(' · ');
  const description = forWhom || undefined;

  return (
    <>
      <MenuButton
        label="Add"
        icon="plus"
        primary
        heading={forWhom ? `Linked to ${forWhom}` : undefined}
        groups={[
          {
            label: 'Record what happened',
            items: [
              { label: 'Email', description: 'Paste an email and link it', icon: 'mail', onSelect: () => navigate(emailIntakeLink(ctx)) },
              { label: 'Call or note', icon: 'phone', onSelect: () => setOpen('call') },
              { label: 'Meeting notes', description: 'For a meeting that has happened', icon: 'note', onSelect: () => setOpen('meetingNotes') },
            ],
          },
          {
            label: 'Plan',
            items: [
              { label: 'Schedule meeting', description: 'Shows under upcoming meetings', icon: 'calendar', onSelect: () => setOpen('schedule') },
              { label: 'Follow-up', description: 'Something to do by a date', icon: 'task', onSelect: () => setOpen('task') },
            ],
          },
          {
            label: 'New record',
            items: [
              { label: 'Company', icon: 'building', onSelect: () => setOpen('company') },
              { label: 'Contact', icon: 'users', onSelect: () => setOpen('contact') },
              { label: 'Application', icon: 'briefcase', onSelect: () => setOpen('application') },
            ],
          },
        ]}
      />

      <Modal open={open === 'call'} onClose={close} title="Add call or note" description={description} size="lg">
        <ActivityForm defaultType="call" defaultCompanyId={ctx.companyId} defaultContactId={ctx.contactId} defaultApplicationId={ctx.applicationId} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={open === 'meetingNotes'} onClose={close} title="Add meeting notes" description={description} size="lg">
        <ActivityForm defaultType="meeting" defaultCompanyId={ctx.companyId} defaultContactId={ctx.contactId} defaultApplicationId={ctx.applicationId} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={open === 'schedule'} onClose={close} title="Schedule meeting" description={description ? `${description}. Records it here only: no calendar is connected.` : 'Records it here only: no calendar is connected.'} size="lg">
        <ActivityForm defaultType="meeting" defaultOccurredAt={tomorrowAtTen()} defaultCompanyId={ctx.companyId} defaultContactId={ctx.contactId} defaultApplicationId={ctx.applicationId} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={open === 'task'} onClose={close} title="Add follow-up" description={description} size="lg">
        <TaskForm defaultCompanyId={ctx.companyId} defaultContactId={ctx.contactId} defaultApplicationId={ctx.applicationId} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={open === 'company'} onClose={close} title="Add company" description="Fictional data only in this prototype." size="lg">
        <CompanyForm onSaved={(c) => { close(); navigate(`/companies/${c.id}`); }} onCancel={close} />
      </Modal>
      <Modal open={open === 'contact'} onClose={close} title="Add contact" description={company ? `At ${company.name}` : undefined} size="lg">
        <ContactForm defaultCompanyId={ctx.companyId} onSaved={(c) => { close(); if (!forWhom) navigate(`/contacts/${c.id}`); }} onCancel={close} />
      </Modal>
      <Modal open={open === 'application'} onClose={close} title="Add application" description={company?.name} size="xl">
        <ApplicationForm defaultCompanyId={ctx.companyId} defaultContactId={ctx.contactId} onSaved={(a) => { close(); if (!forWhom) navigate(`/applications/${a.id}`); }} onCancel={close} />
      </Modal>
    </>
  );
}
