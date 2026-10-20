import { useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { DO_NOT_CONTACT, PARTNER_STATUSES, shortLabel } from '../lib/options';
import { initials } from '../lib/selectors';

/* ---------- Buttons ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variantClasses: Record<Variant, string> = {
  primary: 'bg-ivey-700 text-white hover:bg-ivey-800 shadow-sm',
  secondary: 'bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-50 shadow-xs',
  ghost: 'text-neutral-700 hover:bg-neutral-100',
  danger: 'bg-red-700 text-white hover:bg-red-800 shadow-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: IconName;
}

export function Button({ variant = 'primary', size = 'md', icon, className = '', children, type = 'button', ...rest }: ButtonProps) {
  const sizing = size === 'sm' ? 'px-2.5 py-1.5 text-xs gap-1.5' : 'px-3.5 py-2 text-sm gap-2';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivey-600 disabled:cursor-not-allowed disabled:opacity-60 ${sizing} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {children}
    </button>
  );
}

/* ---------- Layout pieces ---------- */

export function Card({ title, action, children, className = '', padded = true }: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white shadow-xs ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>}
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions, back }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-ivey-700">
          <Icon name="arrowLeft" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">{title}</h1>
          {description && <div className="mt-1.5 text-sm text-neutral-600">{description}</div>}
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'info', title, message, action, compact = false }: {
  icon?: IconName;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-4 py-6' : 'px-6 py-14'}`}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ivey-50 text-ivey-700">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-neutral-600">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const letters = initials(name);
  const sizing = size === 'lg' ? 'h-12 w-12 text-base' : size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-100 font-semibold text-neutral-700 ${sizing}`} aria-hidden="true">
      {letters || '?'}
    </span>
  );
}

/* ---------- Badges ---------- */

const statusTone: Record<string, string> = {
  'Active Partner': 'bg-ivey-50 text-ivey-800 ring-ivey-200',
  Prospect: 'bg-sky-50 text-sky-800 ring-sky-200',
  'Outreach in Progress': 'bg-violet-50 text-violet-800 ring-violet-200',
  'Past Partner': 'bg-neutral-100 text-neutral-700 ring-neutral-200',
};
const reviewTone = 'bg-amber-50 text-amber-900 ring-amber-300';

/** Partner/contact statuses. A value outside Lauren's list is shown in amber with a review hint. */
export function StatusBadges({ statuses, max }: { statuses: string[]; max?: number }) {
  if (!statuses.length) return <span className="text-neutral-500">—</span>;
  const shown = max ? statuses.slice(0, max) : statuses;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((s) => {
        const known = (PARTNER_STATUSES as readonly string[]).includes(s);
        return (
          <Badge key={s} className={known ? statusTone[s] : reviewTone}>
            {!known && <Icon name="alert" className="h-3 w-3" />}
            {s}
            {!known && <span className="sr-only"> (needs review)</span>}
          </Badge>
        );
      })}
      {max && statuses.length > max && <Badge>+{statuses.length - max}</Badge>}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (!priority) return <span className="text-neutral-500">—</span>;
  const tone =
    priority === 'High'
      ? 'bg-ivey-700 text-white ring-ivey-700'
      : priority === 'Medium'
        ? 'bg-ivey-50 text-ivey-800 ring-ivey-200'
        : priority === 'Low'
          ? 'bg-neutral-100 text-neutral-700 ring-neutral-200'
          : priority === DO_NOT_CONTACT
            ? 'bg-red-50 text-red-800 ring-red-300'
            : reviewTone;
  return <Badge className={tone}>{priority === DO_NOT_CONTACT && <Icon name="alert" className="h-3 w-3" />}{priority}</Badge>;
}

/** Neutral chips for multi-select values such as project types or roles. */
export function Chips({ values, known, empty = 'Not recorded' }: { values: string[]; known?: readonly string[]; empty?: string }) {
  if (!values.length) return <span className="text-sm text-neutral-500">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {values.map((v) => {
        const flagged = known && !known.includes(v);
        return (
          <Badge key={v} className={flagged ? reviewTone : 'bg-white text-neutral-800 ring-neutral-300'}>
            {flagged && <Icon name="alert" className="h-3 w-3" />}
            <span title={v}>{shortLabel(v)}</span>
          </Badge>
        );
      })}
    </span>
  );
}

export function Badge({ children, className = 'bg-neutral-100 text-neutral-700 ring-neutral-200' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

/* ---------- Form fields ---------- */

export const inputClass =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-xs placeholder:text-neutral-400 focus:border-ivey-600 focus:ring-2 focus:ring-ivey-600/20 focus:outline-none aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-600/20';

/** Inline filter dropdowns: same look as inputs, but sized to their content so they sit in a row. */
export const filterSelectClass = inputClass.replace('block w-full ', 'block w-auto ');

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, required, error, hint, children, className = '' }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-800">
        {label}
        {required && <span className="ml-0.5 text-red-700" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-700">
          <Icon name="alert" className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface BaseFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function TextField({ type = 'text', ...props }: BaseFieldProps & { type?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} {...props}>
      <input
        id={id}
        type={type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        autoFocus={props.autoFocus}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error || props.hint ? `${id}-msg` : undefined}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function TextAreaField({ rows = 4, ...props }: BaseFieldProps & { rows?: number }) {
  const id = useId();
  return (
    <FieldShell id={id} {...props}>
      <textarea
        id={id}
        rows={rows}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error || props.hint ? `${id}-msg` : undefined}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function SelectField({ options, ...props }: BaseFieldProps & { options: { value: string; label: string }[] }) {
  const id = useId();
  if (props.value && !options.some((o) => o.value === props.value)) {
    options = [...options, { value: props.value, label: `${props.value} (not in list, needs review)` }];
  }
  return (
    <FieldShell id={id} {...props}>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error || props.hint ? `${id}-msg` : undefined}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}

export function SearchInput({ value, onChange, placeholder, label }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative w-full max-w-sm">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={`${inputClass} pl-9`}
      />
    </div>
  );
}

/** Shown above forms when the user tries to save with errors. */
export function FormErrorSummary({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div role="alert" className="mb-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
      Please fix the highlighted fields before saving.
    </div>
  );
}

/** Picklist with Lauren's options plus a blank "Not set" choice. */
export function picklist(values: readonly string[], blank = 'Not set'): { value: string; label: string }[] {
  return [{ value: '', label: blank }, ...values.map((v) => ({ value: v, label: v }))];
}

/**
 * Multi-select as a group of checkboxes. Values that aren't in `options` (legacy/imported)
 * are listed too, ticked and flagged, so they're preserved unless the user unticks them.
 * `exclusive` is an option that clears the others when chosen (e.g. "Not an Ivey Alumnus").
 */
export function CheckboxGroupField({ label, options, value, onChange, columns = 2, error, hint, exclusive, className = '' }: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  columns?: 1 | 2 | 3;
  error?: string;
  hint?: ReactNode;
  exclusive?: string;
  className?: string;
}) {
  const id = useId();
  const legacy = value.filter((v) => !options.includes(v));
  const all = [...options, ...legacy];

  function toggle(option: string, checked: boolean) {
    if (!checked) return onChange(value.filter((v) => v !== option));
    if (exclusive && option === exclusive) return onChange([option]);
    // Keep the user's picks in the official option order.
    const next = [...value.filter((v) => v !== exclusive), option];
    onChange(all.filter((o) => next.includes(o)));
  }

  const cols = columns === 3 ? 'sm:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : '';
  return (
    <fieldset className={className} aria-describedby={error || hint ? `${id}-msg` : undefined}>
      <legend className="mb-1.5 flex w-full items-baseline justify-between text-sm font-medium text-neutral-800">
        {label}
        {value.length > 0 && <span className="text-xs font-normal text-neutral-500">{value.length} selected</span>}
      </legend>
      <div className={`grid grid-cols-1 gap-x-4 gap-y-1 rounded-md border px-3 py-2.5 ${cols} ${error ? 'border-red-600' : 'border-neutral-300'}`}>
        {all.map((option) => {
          const isLegacy = legacy.includes(option);
          return (
            <label key={option} className="flex cursor-pointer items-start gap-2 py-0.5 text-sm text-neutral-800">
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={(e) => toggle(option, e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 accent-ivey-700"
              />
              <span className={isLegacy ? 'text-amber-900' : ''}>
                {option}
                {isLegacy && <span className="ml-1 text-xs font-medium">(not in list, needs review)</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-700">
          <Icon name="alert" className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </fieldset>
  );
}

/** A titled group of fields inside a long form. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-100 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * An optional group of fields that starts collapsed, so forms open short. `summary` says what's
 * already filled in while it's closed. It opens itself when `forceOpen` turns true (a field inside
 * has a validation error). Closed fields stay mounted (hidden), so their values are never lost.
 */
export function CollapsibleSection({ title, summary, forceOpen = false, revealKey, defaultOpen = false, children }: {
  title: string;
  summary?: string;
  forceOpen?: boolean;
  /** Changes on every failed save (e.g. a counter), so a section with errors reopens even if it was closed again. */
  revealKey?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  const id = useId();
  // Opened during render (not in an effect), so the fields exist before focus moves to the first error.
  const trigger = forceOpen ? `${revealKey ?? 0}` : '';
  const [lastTrigger, setLastTrigger] = useState(trigger);
  if (trigger !== lastTrigger) {
    setLastTrigger(trigger);
    if (forceOpen) setOpen(true);
  }
  return (
    <section className="rounded-lg border border-neutral-200">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-ivey-600"
        >
          <Icon name="chevronRight" className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="text-sm font-semibold text-neutral-950">{title}</span>
          <span className="ml-auto truncate pl-2 text-xs text-neutral-500">{summary || (open ? '' : 'Optional')}</span>
        </button>
      </h3>
      <div id={id} hidden={!open} className="grid grid-cols-1 gap-x-4 gap-y-5 border-t border-neutral-100 px-4 pt-4 pb-5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

/** After a failed save, move keyboard focus to the first field with an error (once sections have opened). */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  window.setTimeout(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
}

/** Short "what's filled in" text for a collapsed section: the non-empty values, joined. */
export function filledSummary(parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/**
 * Accessible tabs: arrow keys move between tabs, Home/End jump to the ends, only the active tab is
 * in the tab order. The parent owns the selected tab (e.g. stored in the URL so links keep working).
 */
export function Tabs<T extends string>({ label, tabs, value, onChange }: {
  label: string;
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const next = (i + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-neutral-200">
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(i + 1); }
              else if (e.key === 'ArrowLeft') { e.preventDefault(); move(i - 1); }
              else if (e.key === 'Home') { e.preventDefault(); move(0); }
              else if (e.key === 'End') { e.preventDefault(); move(tabs.length - 1); }
            }}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ivey-600 ${
              selected ? 'border-ivey-700 text-ivey-800' : 'border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-900'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className={`rounded-full px-1.5 text-xs tabular-nums ${selected ? 'bg-ivey-50 text-ivey-800' : 'bg-neutral-100 text-neutral-600'}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="focus-visible:outline-none">
      {children}
    </div>
  );
}

/** Amber notice listing values that aren't in Lauren's option lists. */
export function ReviewNotice({ issues }: { issues: { field: string; value: string }[] }) {
  if (!issues.length) return null;
  return (
    <div role="note" className="mb-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div>
        <p className="font-semibold">Some values need review</p>
        <p className="mt-0.5">These aren't in Lauren's option lists. They've been kept as they were. Edit the record to choose a replacement, or leave them as they are.</p>
        <ul className="mt-1.5 list-disc pl-5">
          {issues.map((i) => (
            <li key={i.field + i.value}>{i.field}: <strong className="font-semibold">“{i.value}”</strong></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
