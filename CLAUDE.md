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

## Tech stack
- React 18 + TypeScript (strict) + Vite + Tailwind CSS v4 (`@tailwindcss/vite`).
- React Router with `HashRouter`, plus `base: './'` in `vite.config.ts`, so the built app
  works under any GitHub Pages repository path (e.g. `https://user.github.io/repo-name/`).
- No backend. Data persists in `localStorage` under the key `el-relationship-workspace:v1`.

## Commands
- `npm install`: install dependencies (first time only)
- `npm run dev`: start local dev server at http://localhost:5173/
- `npm run build`: type-check and build into `dist/`
- `npm run preview`: serve the built `dist/` folder locally
- Publish changes: `git add -A && git commit -m "..." && git push`. The site updates about 1 minute later.
- GitHub CLI lives at `~/.local/gh/bin/gh` (not on PATH). Signed in as `jeojji`. Commits use
  GitHub's noreply email (set in this repo's git config).

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
  lib/                     Pure helpers (dates, validation, selectors, ids)
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
7. **CSV import/export** ⏳ Export each collection; import with column mapping, a
   preview, per-row validation and duplicate detection before saving.
8. **Deploy** ✅ Repo https://github.com/jeojji/ivey-el-crm-prototype (public). Live at
   https://jeojji.github.io/ivey-el-crm-prototype/. Every push to `main` rebuilds and
   redeploys via `.github/workflows/deploy.yml` (Pages source: GitHub Actions).

Acceptance workflow (verified end to end with a headless-browser script on 2026-10-19):
Add a company → add a contact → log a meeting → create a follow-up → see it on the dashboard.
