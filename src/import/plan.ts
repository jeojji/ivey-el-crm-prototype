// Turns parsed CSV rows into a reviewable import plan. Pure functions: nothing here saves data.
//
// Safety rules (see CLAUDE.md):
// - Unknown picklist values are kept as written and flagged for review, never dropped.
// - A blank cell never clears an existing value.
// - Filling an empty field is a "fill" (applied by default). Replacing a different existing value
//   is a "conflict" that keeps the existing value unless the user chooses otherwise. Notes are
//   never overwritten or appended without an explicit choice.
// - Each row updates at most one existing record. Ambiguous matches wait for the user; two
//   existing records are never merged.

import { normalizeOption } from '../lib/options';
import { isValidEmail, isValidPhone, isValidUrl, isValidWebsite, normalizeWebsite } from '../lib/validation';
import { unprotectFormula } from '../lib/csv';
import { fullName } from '../lib/selectors';
import type { Company, Contact, Database } from '../types';
import { fieldsFor, getPath, type FieldDef, type FieldType, type ImportKind } from './fields';

export type Value = string | string[] | number;

// ---------------------------------------------------------------------------
// 1. Parsing rows
// ---------------------------------------------------------------------------

const INSTRUCTION_MARKERS = /^(instructions|required)|values:|e\.g\.|format:|separate multiple|free text/i;

/** True for the template's guidance row ("INSTRUCTIONS →", "Values: High | Medium | Low", …). */
export function isInstructionsRow(cells: string[]): boolean {
  const filled = cells.map((c) => c.trim()).filter(Boolean);
  if (!filled.length) return false;
  if (/^instructions\b/i.test(filled[0])) return true;
  return filled.filter((c) => INSTRUCTION_MARKERS.test(c)).length / filled.length >= 0.4;
}

export interface ParsedRow {
  /** Row number as shown in a spreadsheet (header = 1). */
  line: number;
  values: Record<string, Value>;
  /** Picklist values outside Lauren's lists: imported as written and flagged for review. */
  unknown: { label: string; value: string }[];
  /** Non-blocking notes about individual cells. */
  warnings: string[];
  /** Blocking problems: the row is not imported. */
  errors: string[];
  /** The raw Account Name (contacts only). */
  accountName: string;
}

export interface PreparedFile {
  kind: ImportKind;
  headers: string[];
  mapping: (string | null)[];
  instructionsLine: number | null;
  rows: ParsedRow[];
  /** Problems with the column mapping itself; importing is blocked until fixed. */
  mappingErrors: string[];
}

function isRealDate(value: string): boolean {
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

function parseCell(field: FieldDef, raw: string, row: ParsedRow): void {
  const text = unprotectFormula(raw).trim();
  if (!text) return;
  const flag = (value: string) => row.unknown.push({ label: field.label, value });

  switch (field.type) {
    case 'single': {
      const { value, known } = normalizeOption(field.options ?? [], text, field.aliases);
      if (!known) flag(value);
      row.values[field.key] = value;
      return;
    }
    case 'multi': {
      const out: string[] = [];
      for (const part of text.split(';')) {
        if (!part.trim()) continue;
        const { value, known } = normalizeOption(field.options ?? [], part, field.aliases);
        if (!known) flag(value);
        if (!out.includes(value)) out.push(value);
      }
      if (out.length) row.values[field.key] = out;
      return;
    }
    case 'date':
      if (isRealDate(text)) row.values[field.key] = text.replace(/\//g, '-');
      else row.warnings.push(`${field.label} “${text}” isn't a YYYY-MM-DD date, so it was left out.`);
      return;
    case 'year': {
      const n = Number(text);
      if (/^\d{4}$/.test(text) && n >= 1900 && n <= 2100) row.values[field.key] = n;
      else row.warnings.push(`${field.label} “${text}” isn't a 4-digit year, so it was left out.`);
      return;
    }
    case 'email':
      if (!isValidEmail(text)) row.warnings.push(`${field.label} “${text}” doesn't look like an email address. Imported as written.`);
      row.values[field.key] = isValidEmail(text) ? text.toLowerCase() : text;
      return;
    case 'website':
      if (isValidWebsite(text)) row.values[field.key] = normalizeWebsite(text);
      else {
        row.warnings.push(`${field.label} “${text}” doesn't look like a web address. Imported as written.`);
        row.values[field.key] = text;
      }
      return;
    case 'url': {
      const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      if (isValidUrl(withProtocol)) row.values[field.key] = withProtocol;
      else {
        row.warnings.push(`${field.label} “${text}” isn't a web address. Imported as written.`);
        row.values[field.key] = text;
      }
      return;
    }
    case 'phone':
      if (!isValidPhone(text)) row.warnings.push(`${field.label} “${text}” has an unusual format. Imported as written.`);
      row.values[field.key] = text;
      return;
    case 'company':
      row.accountName = text;
      return;
    default:
      row.values[field.key] = text;
  }
}

/** Applies a column mapping to raw CSV rows (header row first). */
export function prepareFile(kind: ImportKind, table: string[][], mapping: (string | null)[]): PreparedFile {
  const [headers = [], ...body] = table;
  const fields = fieldsFor(kind);
  const mappingErrors: string[] = [];

  const seen = new Map<string, string>();
  mapping.forEach((key, i) => {
    if (!key) return;
    const label = fields.find((f) => f.key === key)?.label ?? key;
    if (seen.has(key)) mappingErrors.push(`“${headers[i]}” and “${seen.get(key)}” are both mapped to ${label}. Choose one.`);
    else seen.set(key, headers[i]);
  });
  for (const f of fields.filter((f) => f.required)) {
    if (!mapping.includes(f.key)) mappingErrors.push(`No column is mapped to ${f.label}, which is required.`);
  }

  let instructionsLine: number | null = null;
  let start = 0;
  if (body.length && isInstructionsRow(body[0])) {
    instructionsLine = 2;
    start = 1;
  }

  const rows = body.slice(start).map((cells, i): ParsedRow => {
    const row: ParsedRow = { line: i + start + 2, values: {}, unknown: [], warnings: [], errors: [], accountName: '' };
    mapping.forEach((key, col) => {
      const field = key ? fields.find((f) => f.key === key) : undefined;
      if (field) parseCell(field, cells[col] ?? '', row);
    });
    for (const f of fields.filter((f) => f.required)) {
      if (!row.values[f.key]) row.errors.push(`${f.label} is missing.`);
    }
    if (cells.length > headers.length && cells.slice(headers.length).some((c) => c.trim())) {
      row.warnings.push(`This row has more cells than there are columns. The extra cells were ignored.`);
    }
    return row;
  });

  return { kind, headers, mapping, instructionsLine, rows, mappingErrors };
}

// ---------------------------------------------------------------------------
// 2. Matching rows to existing records
// ---------------------------------------------------------------------------

/** Case-, spacing- and punctuation-insensitive company name. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const LEGAL_SUFFIX = /\s+(inc|incorporated|ltd|limited|corp|corporation|co|company|llc|llp|lp|plc)$/;
/** Name without a legal suffix ("Acme Ltd" → "acme"), for suggesting possible matches. */
function coreName(name: string): string {
  let n = normalizeName(name);
  while (LEGAL_SUFFIX.test(n)) n = n.replace(LEGAL_SUFFIX, '');
  return n;
}

export interface Candidate {
  id: string;
  label: string;
}

export type MatchStatus =
  | 'new' // no existing record
  | 'matched' // exactly one existing record
  | 'ambiguous' // several existing records fit: the user must choose
  | 'possible'; // a similar record exists: the user must confirm

export interface RecordMatch {
  status: MatchStatus;
  matchId: string | null;
  reason: string;
  candidates: Candidate[];
}

export interface CompanyMatch {
  /** Normalized Account Name, used to group contacts with the same company. */
  key: string;
  accountName: string;
  status: MatchStatus | 'none';
  companyId: string | null;
  candidates: Candidate[];
}

export function matchCompanyName(name: string, companies: Company[]): CompanyMatch {
  const key = normalizeName(name);
  if (!key) return { key: '', accountName: name, status: 'none', companyId: null, candidates: [] };
  const exact = companies.filter((c) => normalizeName(c.name) === key);
  if (exact.length === 1) return { key, accountName: name, status: 'matched', companyId: exact[0].id, candidates: [] };
  const toCand = (c: Company) => ({ id: c.id, label: c.name });
  if (exact.length > 1) return { key, accountName: name, status: 'ambiguous', companyId: null, candidates: exact.map(toCand) };
  const core = coreName(name);
  const similar = core ? companies.filter((c) => coreName(c.name) === core) : [];
  if (similar.length) return { key, accountName: name, status: 'possible', companyId: null, candidates: similar.map(toCand) };
  return { key, accountName: name, status: 'new', companyId: null, candidates: [] };
}

export interface PlanRow extends ParsedRow {
  label: string;
  match: RecordMatch;
  /** Contacts only. */
  company?: CompanyMatch;
  /** Set when an earlier row in the same file already describes this record. */
  duplicateOfLine?: number;
}

function companyLabel(row: ParsedRow): string {
  return String(row.values.name ?? '(no name)');
}
function contactLabel(row: ParsedRow): string {
  return `${row.values.firstName ?? ''} ${row.values.lastName ?? ''}`.trim() || '(no name)';
}

export function matchRows(file: PreparedFile, db: Database): PlanRow[] {
  const firstLineFor = new Map<string, number>();
  return file.rows.map((row) => {
    const id = typeof row.values.id === 'string' ? row.values.id : '';
    let match: RecordMatch;
    let company: CompanyMatch | undefined;
    let dupKey: string;

    if (file.kind === 'companies') {
      const byId = id ? db.companies.find((c) => c.id === id) : undefined;
      const name = String(row.values.name ?? '');
      if (byId) match = { status: 'matched', matchId: byId.id, reason: 'same Workspace ID', candidates: [] };
      else {
        const m = matchCompanyName(name, db.companies);
        match =
          m.status === 'matched'
            ? { status: 'matched', matchId: m.companyId, reason: 'same name', candidates: [] }
            : { status: m.status === 'none' ? 'new' : m.status, matchId: null, reason: m.status === 'possible' ? 'similar name' : m.status === 'ambiguous' ? 'several companies share this name' : '', candidates: m.candidates };
      }
      dupKey = match.matchId ?? `name:${normalizeName(name)}`;
    } else {
      company = matchCompanyName(row.accountName, db.companies);
      const email = typeof row.values.email === 'string' && isValidEmail(row.values.email) ? row.values.email.toLowerCase() : '';
      const first = String(row.values.firstName ?? '').toLowerCase();
      const last = String(row.values.lastName ?? '').toLowerCase();
      const byId = id ? db.contacts.find((c) => c.id === id) : undefined;
      const byEmail = email ? db.contacts.find((c) => c.email.toLowerCase() === email) : undefined;
      const toCand = (c: Contact) => ({ id: c.id, label: `${fullName(c)}${c.email ? ` (${c.email})` : ''}` });
      if (byId) match = { status: 'matched', matchId: byId.id, reason: 'same Workspace ID', candidates: [] };
      else if (byEmail) match = { status: 'matched', matchId: byEmail.id, reason: 'same email', candidates: [] };
      else {
        const sameName = db.contacts.filter((c) => c.firstName.toLowerCase() === first && c.lastName.toLowerCase() === last);
        // Without an email, a single same-named contact at the same resolved company (or both with no company) is a match.
        const resolvedCompany = company.status === 'matched' || company.status === 'none' ? company.companyId : undefined;
        const sameNameSameCompany = resolvedCompany === undefined ? [] : sameName.filter((c) => c.companyId === resolvedCompany);
        if (!email && sameNameSameCompany.length === 1 && sameName.length === 1)
          match = { status: 'matched', matchId: sameNameSameCompany[0].id, reason: 'same name and company', candidates: [] };
        else if (sameName.length)
          match = { status: sameName.length > 1 ? 'ambiguous' : 'possible', matchId: null, reason: 'a contact with the same name already exists', candidates: sameName.map(toCand) };
        else match = { status: 'new', matchId: null, reason: '', candidates: [] };
      }
      dupKey = match.matchId ?? (email ? `email:${email}` : `name:${first} ${last}|${company.key}`);
    }

    const planRow: PlanRow = { ...row, label: file.kind === 'companies' ? companyLabel(row) : contactLabel(row), match, company };
    if (row.errors.length === 0) {
      const earlier = firstLineFor.get(dupKey);
      if (earlier) planRow.duplicateOfLine = earlier;
      else firstLineFor.set(dupKey, row.line);
    }
    return planRow;
  });
}

// ---------------------------------------------------------------------------
// 3. Comparing with existing records
// ---------------------------------------------------------------------------

export type ConflictChoice = 'keep' | 'file' | 'combine' | 'append';

export interface FieldChange {
  key: string;
  label: string;
  type: FieldType;
  current: Value | null;
  incoming: Value;
  kind: 'fill' | 'conflict';
  /** Choices offered for a conflict. The first is the default. */
  choices: ConflictChoice[];
}

function isEmpty(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

function sameValue(type: FieldType, a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return b.every((v) => a.includes(v)); // nothing new in the file
  if (type === 'email') return String(a).toLowerCase() === String(b).toLowerCase();
  if (type === 'website') {
    const site = (v: unknown) => normalizeWebsite(String(v)).toLowerCase().replace(/^www\./, '');
    return site(a) === site(b);
  }
  if (type === 'longtext') return String(a).trim() === String(b).trim() || String(a).includes(String(b).trim());
  if (type === 'text') return String(a).trim() === String(b).trim();
  return a === b;
}

/** Field-by-field comparison of a row with an existing record. */
export function diffRecord(kind: ImportKind, row: ParsedRow, existing: Company | Contact, companyId?: string | null): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fieldsFor(kind)) {
    if (field.type === 'id') continue;
    let incoming: Value | undefined = row.values[field.key];
    if (field.type === 'company') incoming = companyId ?? undefined;
    if (incoming === undefined || isEmpty(incoming)) continue;
    const current = getPath(existing, field.key) as Value | null;
    if (isEmpty(current)) {
      changes.push({ key: field.key, label: field.label, type: field.type, current: null, incoming, kind: 'fill', choices: [] });
    } else if (!sameValue(field.type, current, incoming)) {
      const choices: ConflictChoice[] =
        field.type === 'longtext' ? ['keep', 'append', 'file'] : field.type === 'multi' ? ['keep', 'combine', 'file'] : ['keep', 'file'];
      changes.push({ key: field.key, label: field.label, type: field.type, current, incoming, kind: 'conflict', choices });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// 4. The user's decisions → write operations
// ---------------------------------------------------------------------------

export interface RowDecision {
  include: boolean;
  /** 'new' to create, an existing record id to update, or null when still unresolved. */
  target: 'new' | string | null;
  conflicts: Record<string, ConflictChoice>;
}

/** Per Account Name (contacts): an existing company id, 'create', 'none' (no company), or null (unresolved). */
export type CompanyDecision = string | 'create' | 'none' | null;

export function defaultRowDecision(row: PlanRow): RowDecision {
  const blocked = row.errors.length > 0 || row.duplicateOfLine !== undefined;
  const target = row.match.status === 'matched' ? row.match.matchId : row.match.status === 'new' ? 'new' : null;
  return { include: !blocked, target, conflicts: {} };
}

export function defaultCompanyDecision(m: CompanyMatch): CompanyDecision {
  if (m.status === 'none') return 'none';
  return m.status === 'matched' ? m.companyId : null;
}

export type RowOutcome =
  | { action: 'create' }
  | { action: 'update'; changes: FieldChange[] }
  | { action: 'unchanged' }
  | { action: 'skip'; reason: string };

/** True when an update would actually change something (a fill, or a conflict not left as "keep"). */
export function changesSomething(outcome: RowOutcome, decision: RowDecision): boolean {
  return outcome.action === 'update' && outcome.changes.some((c) => c.kind === 'fill' || (decision.conflicts[c.key] ?? 'keep') !== 'keep');
}

export function companyIdFor(row: PlanRow, companyDecisions: Record<string, CompanyDecision>): string | null | 'create' | undefined {
  if (!row.company || row.company.status === 'none') return null;
  const d = companyDecisions[row.company.key];
  if (d === undefined || d === null) return undefined; // unresolved
  if (d === 'none') return null;
  return d;
}

/** What will happen to one row, given the user's decisions. */
export function outcomeFor(kind: ImportKind, row: PlanRow, decision: RowDecision, db: Database, companyDecisions: Record<string, CompanyDecision> = {}): RowOutcome {
  if (row.errors.length) return { action: 'skip', reason: row.errors.join(' ') };
  if (row.duplicateOfLine !== undefined) return { action: 'skip', reason: `Same record as row ${row.duplicateOfLine} in this file.` };
  if (!decision.include) return { action: 'skip', reason: 'Excluded by you.' };
  if (decision.target === null) return { action: 'skip', reason: 'Waiting for you to choose a match.' };
  const companyId = kind === 'contacts' ? companyIdFor(row, companyDecisions) : null;
  if (companyId === undefined) return { action: 'skip', reason: `Company “${row.company?.accountName}” needs a match.` };
  if (decision.target === 'new') return { action: 'create' };
  const existing = (kind === 'companies' ? db.companies : db.contacts).find((r) => r.id === decision.target);
  if (!existing) return { action: 'skip', reason: 'The matched record no longer exists.' };
  const changes = diffRecord(kind, row, existing, companyId === 'create' ? '(new company)' : companyId);
  return changes.length ? { action: 'update', changes } : { action: 'unchanged' };
}

function setPath(target: Record<string, unknown>, key: string, value: unknown) {
  const parts = key.split('.');
  let obj = target;
  for (const p of parts.slice(0, -1)) {
    obj[p] = { ...((obj[p] as object) ?? {}) };
    obj = obj[p] as Record<string, unknown>;
  }
  obj[parts[parts.length - 1]] = value;
}

function resolveConflict(change: FieldChange, choice: ConflictChoice): Value | null {
  switch (choice) {
    case 'file':
      return change.incoming;
    case 'combine': {
      const current = (change.current as string[]) ?? [];
      return [...current, ...(change.incoming as string[]).filter((v) => !current.includes(v))];
    }
    case 'append':
      return `${String(change.current ?? '').trimEnd()}\n\n${String(change.incoming).trim()}`;
    default:
      return null; // keep
  }
}

export function emptyCompany(): Omit<Company, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    phone: '',
    website: '',
    address: { street: '', city: '', province: '', postalCode: '', country: '' },
    industry: '',
    priority: '',
    statuses: [],
    projectParticipation: [],
    lastProjectDate: '',
    description: '',
    notes: '',
  };
}

export function emptyContact(): Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    companyId: null,
    firstName: '',
    lastName: '',
    jobTitle: '',
    email: '',
    workPhone: '',
    mobilePhone: '',
    linkedInUrl: '',
    statuses: [],
    priority: '',
    roles: [],
    projectParticipation: [],
    lastProjectDate: '',
    preferredContactMethod: '',
    source: '',
    alumniPrograms: [],
    graduationYear: null,
    notes: '',
  };
}

export interface ImportOperations {
  createCompanies: { id: string; input: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> }[];
  updateCompanies: { id: string; changes: Record<string, unknown> }[];
  createContacts: { id: string; input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> }[];
  updateContacts: { id: string; changes: Record<string, unknown> }[];
}

export interface ImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  companiesCreated: number;
}

/** Builds the write operations. `newId` is injected so ids can be pre-assigned (contacts may link to new companies). */
export function buildOperations(
  kind: ImportKind,
  rows: PlanRow[],
  decisions: RowDecision[],
  db: Database,
  companyDecisions: Record<string, CompanyDecision>,
  newId: () => string,
): { ops: ImportOperations; summary: ImportSummary } {
  const ops: ImportOperations = { createCompanies: [], updateCompanies: [], createContacts: [], updateContacts: [] };
  const summary: ImportSummary = { created: 0, updated: 0, unchanged: 0, skipped: 0, companiesCreated: 0 };
  const createdCompanyIdByKey = new Map<string, string>();

  rows.forEach((row, i) => {
    const decision = decisions[i];
    const outcome = outcomeFor(kind, row, decision, db, companyDecisions);
    if (outcome.action === 'skip') return void summary.skipped++;
    if (outcome.action === 'unchanged') return void summary.unchanged++;

    // Contacts linked to an Account Name the user chose to create as a new company.
    let companyId: string | null = null;
    if (kind === 'contacts') {
      const resolved = companyIdFor(row, companyDecisions);
      if (resolved === 'create' && row.company) {
        let id = createdCompanyIdByKey.get(row.company.key);
        if (!id) {
          id = newId();
          createdCompanyIdByKey.set(row.company.key, id);
          ops.createCompanies.push({ id, input: { ...emptyCompany(), name: row.company.accountName.trim() } });
          summary.companiesCreated++;
        }
        companyId = id;
      } else companyId = resolved ?? null;
    }

    if (outcome.action === 'create') {
      const input: Record<string, unknown> = kind === 'companies' ? emptyCompany() : emptyContact();
      for (const [key, value] of Object.entries(row.values)) if (key !== 'id') setPath(input, key, value);
      if (kind === 'contacts') {
        input.companyId = companyId;
        ops.createContacts.push({ id: newId(), input: input as unknown as Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> });
      } else {
        ops.createCompanies.push({ id: newId(), input: input as unknown as Omit<Company, 'id' | 'createdAt' | 'updatedAt'> });
      }
      summary.created++;
      return;
    }

    const existing = (kind === 'companies' ? db.companies : db.contacts).find((r) => r.id === decision.target)!;
    const changes: Record<string, unknown> = {};
    for (const change of outcome.changes) {
      let value: Value | null;
      if (change.kind === 'fill') value = change.incoming;
      else value = resolveConflict(change, decision.conflicts[change.key] ?? 'keep');
      if (value === null) continue;
      if (change.type === 'company') value = companyId as string;
      if (change.key.startsWith('address.')) {
        changes.address = { ...(existing as Company).address, ...((changes.address as object) ?? {}), [change.key.slice(8)]: value };
      } else changes[change.key] = value;
    }
    if (Object.keys(changes).length === 0) return void summary.unchanged++;
    (kind === 'companies' ? ops.updateCompanies : ops.updateContacts).push({ id: existing.id, changes });
    summary.updated++;
  });

  return { ops, summary };
}
