import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { createId } from '../lib/id';
import { formatDateTime, fromDateTimeLocalValue } from '../lib/dates';
import { fullName } from '../lib/selectors';
import { isValidEmail, isValidIsoDate } from '../lib/validation';
import { emailFingerprint, findDuplicateEmails, firstAddress, splitName, suggestCompanies, suggestContacts } from '../lib/email';
import { termLabel, termOptions } from '../lib/applications';
import { APPLICATION_PROJECT_TYPES, APPLICATION_STAGES, DO_NOT_CONTACT, PROGRAMS, TERM_SEASONS } from '../lib/options';
import { emptyCompany, emptyContact, normalizeName } from '../import/plan';
import { Badge, Button, Card, PageHeader, SelectField, TextAreaField, TextField, inputClass, picklist } from '../components/ui';
import { Icon } from '../components/Icon';
import { StageBadge } from '../components/applications';
import { ConfirmDialog } from '../components/Modal';
import { AiAssist, type AiApply } from '../components/AiAssist';

type Step = 1 | 2 | 3 | 4;
const STEPS = ['Email', 'Contact & company', 'Application', 'Review & save'];

/** A selectable option card used for every "choose one" decision. */
function Choice({ name, value, checked, onSelect, title, detail, children }: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (v: string) => void;
  title: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-lg border ${checked ? 'border-ivey-700 bg-ivey-50/50' : 'border-neutral-200 bg-white'}`}>
      <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
        <input type="radio" name={name} value={value} checked={checked} onChange={() => onSelect(value)} className="mt-1 accent-ivey-700" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-neutral-900">{title}</span>
          {detail && <span className="mt-0.5 block text-xs text-neutral-600">{detail}</span>}
        </span>
      </label>
      {checked && children && <div className="border-t border-neutral-200 px-4 py-4">{children}</div>}
    </div>
  );
}

function StepError({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <div role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      {messages.map((m) => (
        <p key={m} className="flex items-start gap-2"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />{m}</p>
      ))}
    </div>
  );
}

const LAUNCH_REASON = 'The record you started from';

/** Remounting the form (new key) clears every field for a fresh email. */
export function EmailIntakePage() {
  const [run, setRun] = useState(0);
  return <EmailIntake key={run} onReset={() => setRun((n) => n + 1)} />;
}

function EmailIntake({ onReset }: { onReset: () => void }) {
  const data = useData();
  const { companies, contacts, applications, companyById, contactById, applicationById } = data;
  const { notify } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Step 1: the email, as Lauren enters it
  const [originalText, setOriginalText] = useState('');
  const [direction, setDirection] = useState<'received' | 'sent'>('received');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [forwarded, setForwarded] = useState(false);
  const [origName, setOrigName] = useState('');
  const [origEmail, setOrigEmail] = useState('');
  const [origUnknown, setOrigUnknown] = useState(false);

  // Step 2: links
  const [contactChoice, setContactChoice] = useState('');
  const [otherContactId, setOtherContactId] = useState('');
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', jobTitle: '' });
  const [companyHint, setCompanyHint] = useState('');
  const [companyChoice, setCompanyChoice] = useState('');
  const [otherCompanyId, setOtherCompanyId] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [step2Seeded, setStep2Seeded] = useState(false);

  // Step 3: application
  const [appChoice, setAppChoice] = useState('none');
  const [newApp, setNewApp] = useState({ title: '', scope: '', projectType: '', program: '', termSeason: '', termYear: '', confirmationDeadline: '', stage: 'Identifying' });
  const [aiMeta, setAiMeta] = useState<AiApply['meta'] | null>(null);

  // Step 4
  const [notes, setNotes] = useState('');
  const [ackDuplicates, setAckDuplicates] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /** The partner-side person: the original sender of a forwarded email, else the sender (received) or first recipient (sent). */
  const partner = useMemo(() => {
    if (direction === 'sent') return { name: '', email: firstAddress(to) };
    if (forwarded) return origUnknown ? { name: '', email: '' } : { name: origName.trim(), email: origEmail.trim().toLowerCase() };
    return { name: fromName.trim(), email: fromEmail.trim().toLowerCase() };
  }, [direction, forwarded, origUnknown, origName, origEmail, fromName, fromEmail, to]);

  // Opened from a record (Add → Email): that record is offered, labelled, and pre-selected unless
  // the email address matches someone else exactly. Every link is still confirmed on the next steps.
  const launchApp = applicationById.get(params.get('application') ?? '');
  const launchContact = contactById.get(params.get('contact') ?? '') ?? (launchApp?.primaryContactId ? contactById.get(launchApp.primaryContactId) : undefined);
  const launchCompany = companyById.get(params.get('company') ?? '') ?? (launchApp ? companyById.get(launchApp.companyId) : undefined) ?? (launchContact?.companyId ? companyById.get(launchContact.companyId) : undefined);
  const launchLabel = [launchCompany?.name, launchContact && fullName(launchContact), launchApp?.title].filter(Boolean).join(' · ');

  const contactSuggestions = useMemo(() => {
    const found = suggestContacts(data.database, partner);
    return launchContact && !found.some((f) => f.contact.id === launchContact.id) ? [...found, { contact: launchContact, reason: LAUNCH_REASON }] : found;
  }, [data.database, partner, launchContact]);

  // Resolved choices
  const contactId =
    contactChoice.startsWith('existing:') ? contactChoice.slice(9) : contactChoice === 'other' ? otherContactId : null;
  const chosenContact = contactId ? contactById.get(contactId) : undefined;
  const companySuggestions = useMemo(() => {
    const found = suggestCompanies(data.database, { companyName: companyHint, email: partner.email, contact: chosenContact });
    return launchCompany && !found.some((f) => f.company.id === launchCompany.id) ? [...found, { company: launchCompany, reason: LAUNCH_REASON }] : found;
  }, [data.database, companyHint, partner.email, chosenContact, launchCompany]);
  const companyId = companyChoice.startsWith('existing:') ? companyChoice.slice(9) : companyChoice === 'other' ? otherCompanyId : null;
  const chosenCompany = companyId ? companyById.get(companyId) : undefined;
  // Applications offered are the chosen company's only, so the email's links always agree.
  const appId = appChoice.startsWith('existing:') ? appChoice.slice(9) : null;
  const chosenApp = appId ? applicationById.get(appId) : undefined;
  const companyApps = companyId ? applications.filter((a) => a.companyId === companyId) : [];

  const occurredAt = dateValue ? fromDateTimeLocalValue(dateValue) : null;
  const duplicates = useMemo(
    () =>
      step === 4
        ? findDuplicateEmails(data.database, {
            originalText,
            subject,
            occurredAt: occurredAt ?? new Date().toISOString(),
            dateKnown: !!occurredAt,
            partnerEmail: partner.email,
            contactId: contactId,
          })
        : [],
    [step, data.database, originalText, subject, occurredAt, partner.email, contactId],
  );

  // ------------------------------------------------------------ validation

  function validate(s: Step): string[] {
    const e: string[] = [];
    if (s === 1) {
      if (!originalText.trim()) e.push('Paste the email message.');
      if (fromEmail.trim() && !isValidEmail(fromEmail)) e.push('The sender email address doesn’t look right.');
      if (dateValue && !occurredAt) e.push('The date isn’t valid. Clear it if the date is unknown.');
      if (direction === 'received' && forwarded) {
        if (!origUnknown && !origName.trim() && !origEmail.trim()) e.push('This is a forwarded email: enter the original sender, or tick “Original sender unknown”.');
        if (origEmail.trim() && !isValidEmail(origEmail)) e.push('The original sender’s email address doesn’t look right.');
      }
    }
    if (s === 2) {
      if (!contactChoice) e.push('Choose a contact, create a new one, or choose “Don’t link a contact”.');
      if (contactChoice === 'other' && !otherContactId) e.push('Pick the existing contact from the list.');
      if (contactChoice === 'new') {
        if (!newContact.firstName.trim() && !newContact.lastName.trim()) e.push('Enter at least a first or last name for the new contact.');
        if (newContact.email.trim() && !isValidEmail(newContact.email)) e.push('The new contact’s email address doesn’t look right.');
        const dup = newContact.email.trim() && contacts.find((c) => c.email.toLowerCase() === newContact.email.trim().toLowerCase());
        if (dup) e.push(`${fullName(dup)} already uses ${dup.email}. Choose them instead of creating a duplicate.`);
      }
      if (!companyChoice) e.push('Choose a company, create a new one, or choose “No company”.');
      if (companyChoice === 'other' && !otherCompanyId) e.push('Pick the existing company from the list.');
      if (companyChoice === 'new') {
        if (!newCompanyName.trim()) e.push('Enter the new company’s name.');
        const dup = companies.find((c) => normalizeName(c.name) === normalizeName(newCompanyName));
        if (newCompanyName.trim() && dup) e.push(`“${dup.name}” already exists. Choose it instead of creating a duplicate.`);
      }
    }
    if (s === 3) {
      if (appChoice === 'new') {
        if (!newApp.title.trim()) e.push('Give the new application a title.');
        if (companyChoice === 'none') e.push('A new application needs a company. Go back and choose or create one.');
        if (Boolean(newApp.termSeason) !== Boolean(newApp.termYear)) e.push('Choose both the term and the year, or neither.');
        if (!isValidIsoDate(newApp.confirmationDeadline)) e.push('The participation confirmation deadline isn’t a valid date.');
      }
    }
    if (s === 4 && duplicates.length && !ackDuplicates) e.push('This may already be saved. Check the possible duplicates and tick “Save anyway” to continue.');
    return e;
  }

  function goTo(next: Step) {
    if (next > step) {
      const e = validate(step);
      setErrors(e);
      if (e.length) return;
    } else setErrors([]);
    if (next === 2 && !step2Seeded) {
      // Pre-select only certain matches: one contact with exactly this email address, and their company.
      const exact = contactSuggestions.filter((s) => s.reason === 'Same email address');
      if (exact.length === 1) {
        setContactChoice(`existing:${exact[0].contact.id}`);
        if (exact[0].contact.companyId) setCompanyChoice(`existing:${exact[0].contact.companyId}`);
        if (launchApp && exact[0].contact.companyId === launchApp.companyId) setAppChoice(`existing:${launchApp.id}`);
      } else if (launchContact || launchCompany) {
        if (launchContact) setContactChoice(`existing:${launchContact.id}`);
        if (launchCompany) setCompanyChoice(`existing:${launchCompany.id}`);
        if (launchApp && launchApp.companyId === launchCompany?.id) setAppChoice(`existing:${launchApp.id}`);
      }
      setStep2Seeded(true);
    }
    if (next === 4) setAckDuplicates(false);
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  function chooseContact(v: string) {
    setContactChoice(v);
    if (v === 'new' && !newContact.firstName && !newContact.lastName && !newContact.email) {
      setNewContact((n) => ({ ...splitName(partner.name), email: partner.email, jobTitle: n.jobTitle }));
    }
    const person = v.startsWith('existing:') ? contactById.get(v.slice(9)) : undefined;
    if (person?.companyId && !companyChoice) setCompanyChoice(`existing:${person.companyId}`);
  }

  /** Copies the suggestions Lauren selected into the form. Every field stays editable. */
  function applyAi(a: AiApply) {
    const fwd = a.forwarded ?? forwarded;
    if (a.forwarded) {
      setDirection('received');
      setForwarded(true);
      setOrigUnknown(false);
    }
    if (direction === 'sent' && !a.forwarded) {
      const who = [a.contactName, a.contactEmail && `<${a.contactEmail}>`].filter(Boolean).join(' ');
      if (who && !to.trim()) setTo(who);
    } else {
      if (a.contactName !== undefined) (fwd ? setOrigName : setFromName)(a.contactName);
      if (a.contactEmail !== undefined) (fwd ? setOrigEmail : setFromEmail)(a.contactEmail);
    }
    if (a.companyName !== undefined) setCompanyHint(a.companyName);
    if (a.contactJobTitle !== undefined) setNewContact((n) => ({ ...n, jobTitle: a.contactJobTitle! }));
    setNewApp((app) => ({
      ...app,
      ...(a.projectTitle !== undefined ? { title: a.projectTitle } : {}),
      ...(a.projectNeed !== undefined ? { scope: a.projectNeed } : {}),
      ...(a.projectType !== undefined ? { projectType: a.projectType } : {}),
      ...(a.termSeason !== undefined ? { termSeason: a.termSeason } : {}),
      ...(a.termYear !== undefined ? { termYear: a.termYear } : {}),
    }));
    if (a.missingInformation?.length) {
      setNotes((n) => [n.trim(), 'Missing information to ask about:', ...a.missingInformation!.map((m) => `- ${m}`)].filter(Boolean).join('\n'));
    }
    setAiMeta(a.meta);
  }

  function chooseCompany(v: string) {
    setCompanyChoice(v);
    if (v === 'new' && !newCompanyName) setNewCompanyName(companyHint.trim());
    // An application belongs to one company: drop a linked one that no longer matches.
    if (appChoice.startsWith('existing:')) setAppChoice('none');
  }

  // ------------------------------------------------------------------ save

  async function save() {
    const e = validate(4);
    setErrors(e);
    if (e.length) return;
    setSaving(true);
    const now = new Date().toISOString();
    const ids = { company: createId(), contact: createId(), app: createId(), activity: createId() };
    const finalCompanyId = companyChoice === 'new' ? ids.company : companyId;
    const finalContactId = contactChoice === 'new' ? ids.contact : contactId;
    const finalAppId = appChoice === 'new' ? ids.app : appId;
    try {
      await data.saveBatch({
        creates: {
          companies: companyChoice === 'new' ? [{ id: ids.company, input: { ...emptyCompany(), name: newCompanyName.trim() } }] : [],
          contacts:
            contactChoice === 'new'
              ? [{ id: ids.contact, input: { ...emptyContact(), firstName: newContact.firstName.trim(), lastName: newContact.lastName.trim(), email: newContact.email.trim().toLowerCase(), jobTitle: newContact.jobTitle.trim(), companyId: finalCompanyId } }]
              : [],
          applications:
            appChoice === 'new'
              ? [{
                  id: ids.app,
                  input: {
                    title: newApp.title.trim(),
                    companyId: finalCompanyId!,
                    primaryContactId: finalContactId,
                    projectType: newApp.projectType,
                    program: newApp.program,
                    termSeason: newApp.termSeason,
                    termYear: newApp.termYear ? Number(newApp.termYear) : null,
                    scope: newApp.scope.trim(),
                    confirmationDeadline: newApp.confirmationDeadline,
                    stage: newApp.stage,
                    notes: '',
                    stageHistory: [{ stage: newApp.stage, changedAt: now }],
                  },
                }]
              : [],
          activities: [{
            id: ids.activity,
            input: {
              type: 'email',
              subject: subject.trim(),
              details: notes.trim(),
              occurredAt: occurredAt ?? now,
              companyId: finalCompanyId,
              contactId: finalContactId,
              applicationId: finalAppId,
              source: 'email-intake',
              email: {
                direction,
                from: { name: fromName.trim(), email: fromEmail.trim().toLowerCase() },
                to: to.trim(),
                forwarded: direction === 'received' && forwarded,
                originalSender: direction === 'received' && forwarded && !origUnknown ? { name: origName.trim(), email: origEmail.trim().toLowerCase() } : null,
                dateKnown: !!occurredAt,
                originalText,
                fingerprint: emailFingerprint(originalText),
                ...(aiMeta ? { aiAssist: aiMeta } : {}),
              },
              editHistory: [],
            },
          }],
        },
        updates: {},
      });
      notify('Email saved' + (companyChoice === 'new' || contactChoice === 'new' || appChoice === 'new' ? ' with the new records you confirmed.' : '.'));
      navigate(`/emails/${ids.activity}`);
    } catch (err) {
      notify(err instanceof Error ? `${err.message} Nothing was saved.` : 'Saving failed. Nothing was saved.', 'error');
      setSaving(false);
    }
  }

  // -------------------------------------------------------------- render

  const years = termOptions();
  const contactLabel = chosenContact ? fullName(chosenContact) : contactChoice === 'new' ? `${newContact.firstName} ${newContact.lastName}`.trim() : null;
  const companyLabel = chosenCompany ? chosenCompany.name : companyChoice === 'new' ? newCompanyName.trim() : null;

  return (
    <>
      <PageHeader
        title="Add email"
        description="Paste an email, check who it's from, link it to the right records, then confirm. You enter and confirm every detail. Nothing is read from your inbox and nothing is filled in automatically."
        actions={(step > 1 || originalText.trim()) && <Button variant="secondary" icon="x" onClick={() => setConfirmDiscard(true)}>Discard and start over</Button>}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this email?"
        message="Everything entered on this page is cleared. Nothing has been saved yet."
        confirmLabel="Discard"
        onConfirm={() => { setConfirmDiscard(false); onReset(); window.scrollTo({ top: 0 }); }}
        onCancel={() => setConfirmDiscard(false)}
      />

      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          return (
            <li key={label} aria-current={n === step ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${n === step ? 'bg-ivey-700 text-white ring-ivey-700' : n < step ? 'bg-ivey-50 text-ivey-800 ring-ivey-200' : 'bg-white text-neutral-500 ring-neutral-200'}`}>
              <span className="tabular-nums">{n}</span>{label}
            </li>
          );
        })}
      </ol>

      {launchLabel && step < 4 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-neutral-700">
          <Icon name="info" className="h-4 w-4 shrink-0 text-ivey-700" />
          Started from <strong className="font-semibold">{launchLabel}</strong>. It's pre-selected in the next steps, where you confirm or change the links.
        </p>
      )}
      <StepError messages={errors} />

      {step === 1 && (
        <Card>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
            <div className="lg:row-span-4">
              <label htmlFor="original-text" className="mb-1.5 block text-sm font-medium text-neutral-800">Original message <span className="text-red-700" aria-hidden="true">*</span></label>
              <textarea id="original-text" rows={18} value={originalText} onChange={(e) => setOriginalText(e.target.value)}
                placeholder="Paste the whole email here, including any forwarded part."
                className={`${inputClass} font-mono text-xs leading-relaxed`} />
              <p className="mt-1.5 text-xs text-neutral-500">Saved exactly as pasted, and kept separate from your notes. It can't be edited later.</p>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-neutral-800">Direction</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="direction" checked={direction === 'received'} onChange={() => setDirection('received')} className="accent-ivey-700" />Received from a partner</label>
                <label className="flex items-center gap-2"><input type="radio" name="direction" checked={direction === 'sent'} onChange={() => setDirection('sent')} className="accent-ivey-700" />Sent by the EL office</label>
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="From: name" value={fromName} onChange={setFromName} placeholder="Leave blank if unknown" />
              <TextField label="From: email address" type="email" value={fromEmail} onChange={setFromEmail} placeholder="Leave blank if unknown" />
            </div>
            <TextField label="To" value={to} onChange={setTo} placeholder="Recipients, as shown in the email" hint={direction === 'sent' ? 'The first address here is used to look for the partner contact.' : undefined} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Subject" value={subject} onChange={setSubject} placeholder="Leave blank if none" />
              <TextField label="Date and time sent" type="datetime-local" value={dateValue} onChange={setDateValue} hint="Leave blank if unknown." />
            </div>

            <AiAssist
              input={{ originalText, subject, fromName, fromEmail, to, date: dateValue, forwardedTicked: forwarded, direction }}
              onApply={applyAi}
            />

            {direction === 'received' && (
              <div className="rounded-lg border border-neutral-200 p-4 lg:col-span-2">
                <label className="flex items-center gap-2.5 text-sm font-medium text-neutral-900">
                  <input type="checkbox" checked={forwarded} onChange={(e) => setForwarded(e.target.checked)} className="h-4 w-4 accent-ivey-700" />
                  This is a forwarded email
                </label>
                {forwarded && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-neutral-700">The person in “From” forwarded it. Who wrote the original message? Their details are used to find the partner contact.</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <TextField label="Original sender: name" value={origName} onChange={(v) => { setOrigName(v); setOrigUnknown(false); }} />
                      <TextField label="Original sender: email address" type="email" value={origEmail} onChange={(v) => { setOrigEmail(v); setOrigUnknown(false); }} />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input type="checkbox" checked={origUnknown} onChange={(e) => { setOrigUnknown(e.target.checked); if (e.target.checked) { setOrigName(''); setOrigEmail(''); } }} className="h-4 w-4 accent-ivey-700" />
                      Original sender unknown. I'll choose the contact myself in the next step.
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => goTo(2)}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Partner contact">
            <p className="mb-4 text-sm text-neutral-700">
              {partner.email || partner.name ? (
                <>Looking for <strong className="font-semibold">{[partner.name, partner.email && `<${partner.email}>`].filter(Boolean).join(' ')}</strong>{forwarded && direction === 'received' ? ' (original sender)' : ''}.</>
              ) : (
                'No partner name or address was entered, so there are no suggestions. Choose a contact yourself.'
              )}
            </p>
            <div className="space-y-2" role="radiogroup" aria-label="Contact">
              {contactSuggestions.map(({ contact: c, reason }) => (
                <Choice key={c.id} name="contact" value={`existing:${c.id}`} checked={contactChoice === `existing:${c.id}`} onSelect={chooseContact}
                  title={<span className="flex flex-wrap items-center gap-2">{fullName(c)} <Badge className={reason === 'Same email address' || reason === LAUNCH_REASON ? 'bg-ivey-50 text-ivey-800 ring-ivey-200' : 'bg-amber-50 text-amber-900 ring-amber-300'}>{reason}</Badge>{c.priority === DO_NOT_CONTACT && <Badge className="bg-red-50 text-red-800 ring-red-300">Do Not Contact</Badge>}</span>}
                  detail={[c.email, c.companyId ? companyById.get(c.companyId)?.name : 'No company'].filter(Boolean).join(' · ')} />
              ))}
              <Choice name="contact" value="other" checked={contactChoice === 'other'} onSelect={chooseContact} title="Choose another existing contact">
                <SelectField label="Contact" value={otherContactId} onChange={(v) => { setOtherContactId(v); const p = contactById.get(v); if (p?.companyId && !companyChoice) setCompanyChoice(`existing:${p.companyId}`); }}
                  options={[{ value: '', label: 'Choose…' }, ...[...contacts].sort((a, b) => fullName(a).localeCompare(fullName(b))).map((c) => ({ value: c.id, label: `${fullName(c)}${c.email ? ` · ${c.email}` : ''}` }))]} />
              </Choice>
              <Choice name="contact" value="new" checked={contactChoice === 'new'} onSelect={chooseContact} title="Create a new contact" detail="Filled from the details you entered. Check them, and leave anything unknown blank.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField label="First name" value={newContact.firstName} onChange={(v) => setNewContact((n) => ({ ...n, firstName: v }))} />
                  <TextField label="Last name" value={newContact.lastName} onChange={(v) => setNewContact((n) => ({ ...n, lastName: v }))} />
                  <TextField label="Email" type="email" value={newContact.email} onChange={(v) => setNewContact((n) => ({ ...n, email: v }))} />
                  <TextField label="Job title" value={newContact.jobTitle} onChange={(v) => setNewContact((n) => ({ ...n, jobTitle: v }))} />
                </div>
                <p className="mt-3 text-xs text-neutral-500">They'll be linked to the company you choose on the right.</p>
              </Choice>
              <Choice name="contact" value="none" checked={contactChoice === 'none'} onSelect={chooseContact} title="Don't link a contact" />
            </div>
          </Card>

          <Card title="Company">
            <TextField label="Company named in the email (optional)" value={companyHint} onChange={setCompanyHint} placeholder="Type it to look for matches" />
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Company">
              {companySuggestions.map(({ company: c, reason }) => (
                <Choice key={c.id} name="company" value={`existing:${c.id}`} checked={companyChoice === `existing:${c.id}`} onSelect={chooseCompany}
                  title={<span className="flex flex-wrap items-center gap-2">{c.name} <Badge className={reason === 'Same name' || reason.startsWith('The contact') || reason === LAUNCH_REASON ? 'bg-ivey-50 text-ivey-800 ring-ivey-200' : 'bg-amber-50 text-amber-900 ring-amber-300'}>{reason}</Badge></span>}
                  detail={[c.industry, c.address.city].filter(Boolean).join(' · ') || undefined} />
              ))}
              <Choice name="company" value="other" checked={companyChoice === 'other'} onSelect={chooseCompany} title="Choose another existing company">
                <SelectField label="Company" value={otherCompanyId} onChange={(v) => { setOtherCompanyId(v); if (appChoice.startsWith('existing:')) setAppChoice('none'); }}
                  options={[{ value: '', label: 'Choose…' }, ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))]} />
              </Choice>
              <Choice name="company" value="new" checked={companyChoice === 'new'} onSelect={chooseCompany} title="Create a new company" detail="Only the name is saved. Add other details later on the company profile.">
                <TextField label="Company name" value={newCompanyName} onChange={setNewCompanyName} />
              </Choice>
              <Choice name="company" value="none" checked={companyChoice === 'none'} onSelect={chooseCompany} title="No company" detail="Keep the email linked only to the contact." />
            </div>
            {chosenContact && companyId && chosenContact.companyId && chosenContact.companyId !== companyId && (
              <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">
                {fullName(chosenContact)} is at {companyById.get(chosenContact.companyId)?.name}. The email will be filed under {chosenCompany?.name}, and the contact's own company won't change.
              </p>
            )}
          </Card>

          <div className="flex justify-between xl:col-span-2">
            <Button variant="secondary" onClick={() => goTo(1)}>Back</Button>
            <Button onClick={() => goTo(3)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card title="Application (optional)">
          <p className="mb-4 text-sm text-neutral-700">If this email is about an engagement opportunity, link it to the application, or create one.</p>
          <div className="space-y-2" role="radiogroup" aria-label="Application">
            <Choice name="app" value="none" checked={appChoice === 'none'} onSelect={setAppChoice} title="Not about a specific application" />
            {companyApps.map((a) => (
              <Choice key={a.id} name="app" value={`existing:${a.id}`} checked={appChoice === `existing:${a.id}`} onSelect={setAppChoice}
                title={<span className="flex flex-wrap items-center gap-2">{a.title} <StageBadge stage={a.stage} /></span>}
                detail={[a.projectType, termLabel(a)].filter(Boolean).join(' · ') || undefined} />
            ))}
            {companyId && companyApps.length === 0 && (
              <p className="px-1 text-xs text-neutral-500">{chosenCompany?.name} has no applications yet.</p>
            )}
            {!companyId && companyChoice !== 'new' && (
              <p className="px-1 text-xs text-neutral-500">Existing applications are listed once a company is chosen.</p>
            )}
            <Choice name="app" value="new" checked={appChoice === 'new'} onSelect={setAppChoice}
              title="Create a new application" detail={companyLabel ? `For ${companyLabel}${contactLabel ? `, with ${contactLabel} as primary contact` : ''}. Leave anything unknown blank.` : 'Needs a company. Go back to choose one.'}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField className="sm:col-span-2" label="Title" value={newApp.title} onChange={(v) => setNewApp((a) => ({ ...a, title: v }))} />
                <TextAreaField className="sm:col-span-2" label="Scope / description" value={newApp.scope} onChange={(v) => setNewApp((a) => ({ ...a, scope: v }))} rows={3} />
                <SelectField label="Project type" value={newApp.projectType} onChange={(v) => setNewApp((a) => ({ ...a, projectType: v }))} options={picklist(APPLICATION_PROJECT_TYPES)} />
                <SelectField label="Program" value={newApp.program} onChange={(v) => setNewApp((a) => ({ ...a, program: v }))} options={picklist(PROGRAMS)} />
                <div className="grid grid-cols-2 gap-2">
                  <SelectField label="Term" value={newApp.termSeason} onChange={(v) => setNewApp((a) => ({ ...a, termSeason: v }))} options={picklist(TERM_SEASONS, 'Not set')} />
                  <SelectField label="Year" value={newApp.termYear} onChange={(v) => setNewApp((a) => ({ ...a, termYear: v }))} options={[{ value: '', label: 'Not set' }, ...years.map((y) => ({ value: String(y), label: String(y) }))]} />
                </div>
                <TextField label="Participation confirmation deadline" type="date" value={newApp.confirmationDeadline} onChange={(v) => setNewApp((a) => ({ ...a, confirmationDeadline: v }))} />
                <SelectField className="sm:col-span-2" label="Stage" value={newApp.stage} onChange={(v) => setNewApp((a) => ({ ...a, stage: v }))} options={APPLICATION_STAGES.map((s) => ({ value: s, label: s }))} />
              </div>
            </Choice>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => goTo(2)}>Back</Button>
            <Button onClick={() => goTo(4)}>Review</Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {duplicates.length > 0 && (
              <section role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="flex items-center gap-2 font-semibold"><Icon name="alert" className="h-4 w-4 text-amber-700" />This email may already be saved</p>
                <ul className="mt-2 space-y-1.5">
                  {duplicates.map((d) => (
                    <li key={d.activity.id}>
                      <Badge className={d.level === 'exact' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-white text-amber-900 ring-amber-300'}>{d.level === 'exact' ? 'Same message' : 'Possible duplicate'}</Badge>{' '}
                      <Link to={d.activity.email ? `/emails/${d.activity.id}` : '/activity'} target="_blank" className="font-medium underline">{d.activity.subject || '(no subject)'}</Link>
                      {' · '}{formatDateTime(d.activity.occurredAt)}{' · '}{d.reason}
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={ackDuplicates} onChange={(e) => setAckDuplicates(e.target.checked)} className="h-4 w-4 accent-ivey-700" />
                  I've checked. Save anyway as a separate email.
                </label>
              </section>
            )}

            <Card title="What will be saved">
              <dl className="divide-y divide-neutral-100 text-sm">
                {[
                  ['Email', <>{subject.trim() || <em className="text-neutral-500">(no subject)</em>} · {occurredAt ? formatDateTime(occurredAt) : <em className="text-neutral-500">date unknown</em>} · {direction === 'received' ? 'received' : 'sent'}{forwarded && direction === 'received' ? ', forwarded' : ''}</>],
                  ['From', [fromName, fromEmail && `<${fromEmail}>`].filter(Boolean).join(' ') || <em className="text-neutral-500">blank</em>],
                  ['To', to || <em className="text-neutral-500">blank</em>],
                  ...(forwarded && direction === 'received' ? [['Original sender', origUnknown ? <em className="text-neutral-500">unknown</em> : [origName, origEmail && `<${origEmail}>`].filter(Boolean).join(' ')]] : []),
                  ['Contact', contactChoice === 'new' ? <><Badge className="bg-ivey-50 text-ivey-800 ring-ivey-200">New</Badge> {contactLabel || '(no name)'}{newContact.email && ` · ${newContact.email}`}</> : chosenContact ? `${fullName(chosenContact)} (existing)` : <em className="text-neutral-500">not linked</em>],
                  ['Company', companyChoice === 'new' ? <><Badge className="bg-ivey-50 text-ivey-800 ring-ivey-200">New</Badge> {companyLabel}</> : chosenCompany ? `${chosenCompany.name} (existing)` : <em className="text-neutral-500">not linked</em>],
                  ['Application', appChoice === 'new' ? <><Badge className="bg-ivey-50 text-ivey-800 ring-ivey-200">New</Badge> {newApp.title} · {newApp.stage}</> : chosenApp ? `${chosenApp.title} (existing)` : <em className="text-neutral-500">not linked</em>],
                ].map(([k, v]) => (
                  <div key={String(k)} className="grid grid-cols-[9rem_1fr] gap-3 py-2.5">
                    <dt className="text-neutral-500">{k}</dt>
                    <dd className="min-w-0 break-words text-neutral-900">{v}</dd>
                  </div>
                ))}
              </dl>
              {aiMeta && <p className="mt-3 text-xs text-neutral-600">Some details were suggested by local AI ({aiMeta.model}) and are shown here for you to confirm.</p>}
              <p className="mt-3 text-xs text-neutral-500">Everything above is saved together. If saving fails, nothing is saved.</p>
            </Card>

            <Card title="Original message (read-only)">
              <pre className="max-h-80 overflow-auto rounded-md bg-neutral-50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-800">{originalText}</pre>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Your notes">
              <TextAreaField label="Notes (optional, editable later)" value={notes} onChange={setNotes} rows={6} placeholder="Your own summary, decisions or next steps. The original message is kept separately." />
            </Card>
            <div className="flex flex-col gap-2">
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Confirm and save'}</Button>
              <Button variant="secondary" onClick={() => goTo(3)}>Back</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
