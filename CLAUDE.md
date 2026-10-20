# EL Relationship Workspace — project instructions

Prototype for the Ivey MSc Advanced Field Project with Lauren Starr (Experiential Learning).
A single workspace to see companies, contacts, activity history and follow-ups for
experiential learning partners, in place of hunting through email and Salesforce.

Whether the final system complements Salesforce or replaces some of its workflows is
**still undecided**. Don't design anything that assumes either answer.

## Owner context
- The project owner is a beginner at coding. Explain steps in plain language, and say
  exactly where to click or what to type.
- Work in this folder (`EL AFP`).

## Hard boundaries
- **Fictional data only.** Sample companies use `.example` email domains and `555-01xx` phone numbers.
- **No real integrations yet:** no email, Salesforce, Calendly or AI APIs.
- Label any simulated feature clearly. Never claim an integration is connected.
- **No nonfunctional buttons.** Don't render a control unless it works. Unbuilt features
  can be described in plain text (e.g. on the "Prototype & data" page), never as dead buttons.
- Browser localStorage is prototype persistence only. It is **not** a secure or shared
  database, and the UI says so.
- **This is a standalone prototype of Lauren's requested workflows.** Never claim it configures
  or connects to Salesforce. Out of scope until asked: login, campaigns, opportunities/pipeline,
  email sending, live integrations.
- **`reference/` holds Lauren's real files (Word request + Salesforce CSV templates with real
  contact details).** It is git-ignored. Never copy its contents, names or contact details into
  `src/`, sample data, docs or commits. Read option lists and headers only.
- **Never discard data.** Unknown picklist values are kept as-is and flagged "Needs review".
  Schema upgrades need the user's click, offer a backup first, and leave the old copy untouched.
  New fields default to empty; never invent values.

## Tech stack
- React 18 + TypeScript (strict) + Vite + Tailwind CSS v4 (`@tailwindcss/vite`).
- React Router with `HashRouter`, plus `base: './'` in `vite.config.ts`, so the built app
  works under any GitHub Pages repository path (e.g. `https://user.github.io/repo-name/`).
- No backend. Data persists in `localStorage` under `el-relationship-workspace:v2` (schema 2).
  The schema-1 key `el-relationship-workspace:v1` is read once for the upgrade and never written.

## Commands
- `npm install`: install dependencies (first time only)
- `npm run dev`: start local dev server at http://localhost:5173/
- `npm run build`: type-check and build into `dist/`
- `npm run preview`: serve the built `dist/` folder locally
- Publish changes: `git add -A && git commit -m "..." && git push`. The site updates about 1 minute later.
- GitHub CLI lives at `~/.local/gh/bin/gh` (not on PATH). Signed in as `jeojji`. Commits use
  GitHub's noreply email (set in this repo's git config).

## Requirements
`REQUIREMENTS.md` maps Lauren's Word document (primary source) and the CSV template headers
(import aliases) to the data model, lists every difference between them, and holds the open
questions for Lauren. Update it whenever a field or option list changes.

## Schema (version 2)
Option lists: `src/lib/options.ts`. Picklist fields are typed `string`/`string[]` on purpose,
so legacy or imported values outside the list are preserved (and flagged by `src/lib/review.ts`).

**Company:** `name`, `phone`, `website`, `address {street, city, province, postalCode, country}`,
`industry` (INDUSTRIES, 38), `priority` (High/Medium/Low), `statuses[]` (PARTNER_STATUSES),
`projectParticipation[]` (PROJECT_TYPES, 17), `lastProjectDate` (YYYY-MM-DD or ''),
`description` (prototype-only "About"), `notes` (Relationship notes), `legacy?` (pre-upgrade originals).

**Contact:** `companyId`, `firstName`, `lastName`, `jobTitle`, `email`, `workPhone`, `mobilePhone`,
`linkedInUrl`, `statuses[]`, `priority` (adds "Do Not Contact"), `roles[]` (CONTACT_ROLES),
`projectParticipation[]`, `lastProjectDate`, `preferredContactMethod`, `source` (SOURCES),
`alumniPrograms[]` (ALUMNI_OPTIONS incl. "Not an Ivey Alumnus", which is exclusive),
`graduationYear` (number | null; needs an alumni program), `notes`.

**Activity / Task:** unchanged from schema 1. They carry their own `companyId` (the company at the time).

Migration: `src/data/migrations.ts` (`previewV1Migration`, `migrateV1`), shown to the user
by `components/UpgradeScreen.tsx`.

### Relationship-history rule
Activities and completed follow-ups **never** change company when a contact moves. On a
company change, `updateContact(id, changes, { moveOpenTasks })` moves only that contact's
**open** follow-ups at the old company, and only if the user chose to. New records default to
the contact's current company. `LinkFields` keeps a moved contact selectable on old records.

## Code structure
```
src/
  types.ts                 Domain models: Company, Contact, Activity, Task, Database
  data/
    repository.ts          DataRepository interface (async, collection-based)
    localStorageRepository.ts  Current implementation (browser storage)
    seed.ts                Fictional sample data, dates relative to "today"
    index.ts               createRepository(): the ONE place to swap in an API later
  state/
    DataContext.tsx        Loads data, exposes CRUD actions + cross-record rules
    ToastContext.tsx       Save/error feedback messages
  data/migrations.ts       Schema 1 → 2 upgrade (pure functions)
  lib/                     Pure helpers (dates, validation, selectors, ids)
    options.ts             Lauren's picklists, CSV aliases, normalizeOption()
    review.ts              "Needs review" detection, address formatting
  components/              Layout, UI primitives, forms, timeline
  pages/                   One file per route
```

### Rules for keeping it ready for a shared database
- UI components **never** touch `localStorage` directly. They go through `useData()` →
  `DataRepository`.
- Repository methods are `async` even though localStorage is sync, so a REST/Supabase/
  Salesforce-backed implementation can drop in without changing pages.
- Cross-record rules (e.g. deleting a contact unlinks their activities) live in
  `DataContext`, which is the future service/API layer.
- Every record has `id`, `createdAt` and `updatedAt`. Activities record `source: 'manual'`
  so imported or synced records can be told apart later.

## Design rules
- Desktop-first workspace with a dark Ivey Green sidebar and a light neutral content area.
- Colours: Ivey Green `#034638` (Tailwind `ivey-700`) as the brand/primary colour, with black,
  greys (Tailwind `neutral-*`) and white. Use red, amber and blue only for status meaning.
- Text contrast must meet WCAG AA. Body text `neutral-900`/`neutral-600` on white.
- Every list has an empty state. Every form validates inline with clear messages. Every save,
  delete or error shows a toast.

## Implementation plan
1. **Foundation** ✅ Vite/React/TS/Tailwind setup, layout + sidebar, data layer,
   seed data, toasts, UI primitives.
2. **Companies** ✅ Searchable/filterable directory; profile with details, linked
   contacts, relationship notes, activity timeline, open follow-ups; add/edit/delete.
3. **Contacts** ✅ Searchable directory; profile; add/edit/delete linked to companies.
4. **Activity history** ✅ Log/edit/delete emails, calls, meetings and notes against a
   company and/or contact; global history page with filters.
5. **Dashboard** ✅ (first pass) Summary counts, overdue follow-ups, upcoming meetings,
   recent activity.
6. **Follow-ups** ✅ `/follow-ups` page with Open / Overdue / Due in 7 days / Completed / All
   views (deep-linkable via `?view=`), search and company filter. Create from the page, the
   dashboard, company/contact profiles, or "Also create a follow-up" when logging an
   activity. Tick to complete (toast offers Undo), edit, delete. Overdue count badge in the sidebar.
7. **Lauren's fields** ✅ (2026-10-19, not yet pushed) Expanded company and contact schema,
   sectioned forms with multi-selects, detailed profiles, new filters (status, priority,
   project type, role, "Needs review"), Do Not Contact flags, schema-1 → 2 upgrade with backup
   download, relationship-history fix. Verified with headless-browser scripts: 44 upgrade,
   field and history checks, plus the original workflow test.
8. **CSV import/export** ⏳ Export each collection. Import with column mapping using the CSV
   template headers as aliases (see REQUIREMENTS.md), skip the template's instructions row,
   split `;` multi-values, normalize options via `normalizeOption()`, keep and flag unknown values,
   link contacts to companies by exact Account Name, preview, per-row validation and duplicate
   detection before saving.
9. **Deploy** ✅ Repo https://github.com/jeojji/ivey-el-crm-prototype (public). Live at
   https://jeojji.github.io/ivey-el-crm-prototype/. Every push to `main` rebuilds and
   redeploys via `.github/workflows/deploy.yml` (Pages source: GitHub Actions).

Acceptance workflow (verified end to end with a headless-browser script on 2026-10-19):
Add a company → add a contact → log a meeting → create a follow-up → see it on the dashboard.

## Remaining work and open questions
- CSV import/export (step 8).
- Push this phase to GitHub when the owner approves. The live site then shows the upgrade
  screen to anyone who used the earlier version.
- Open questions for Lauren are listed at the end of REQUIREMENTS.md (project-type list for
  contacts, referral Source wording, "Not an Ivey Alumnus"/EMBA, multi-select project participation,
  Contact Status in the import template).
- Not planned until requested: opportunities pipeline (10 stages), campaigns, login and sharing,
  Outlook logging, course/student linking (Lauren's Phase 2).
