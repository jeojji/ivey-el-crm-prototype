import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import type { RelationshipStatus } from '../types';
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
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
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

const statusTone: Record<RelationshipStatus, string> = {
  'Active partner': 'bg-ivey-50 text-ivey-800 ring-ivey-200',
  Prospect: 'bg-sky-50 text-sky-800 ring-sky-200',
  'On hold': 'bg-amber-50 text-amber-800 ring-amber-200',
  'Past partner': 'bg-neutral-100 text-neutral-700 ring-neutral-200',
};

export function StatusBadge({ status }: { status: RelationshipStatus }) {
  return <Badge className={statusTone[status]}>{status}</Badge>;
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
