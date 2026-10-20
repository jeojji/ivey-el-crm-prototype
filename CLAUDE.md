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
- **No real integrations yet:** no email, Salesforce or Calendly. **No cloud AI, ever**: the only AI is
  an optional local model (Ollama on 127.0.0.1) used to *suggest* fields in "Add email" (see below).
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
- No backend. Data persists in `localStorage` under `el-relationship-workspace:v3` (schema 3).
  Older keys (`…:v2`, `…:v1`) are read for the upgrade and never written, so they stay as backups.

## Local AI (optional, Add email suggestions)
Setup and limitations for the owner: `SETUP-LOCAL-AI.md`. Architecture:
- `server/localAi.ts`: a Vite plugin (dev and preview servers only) serving `GET /local-ai/status` and
  `POST /local-ai/extract`. It accepts only loopback requests with a loopback (or no) Origin and JSON
  content type, talks only to Ollama at a loopback URL (otherwise it throws at startup), refuses
  cloud models (`*cloud` names or a `remote_host`/`remote_model` in tags), sets a timeout
  (`LOCAL_AI_TIMEOUT_MS`, default 120 s), and validates the output before returning it.
- `src/ai/extraction.ts`: shared contract: JSON schema (Ollama `format`), system prompt, the email
  wrapped in `<email>` tags (tags inside the text are neutralised), `findInstructionSpans` (heuristic
  injection detector), `validateExtraction` (every value needs a verbatim evidence quote found in the
  email; names/emails/companies must appear literally; enums and stated years only; values from
  instruction lines are blanked; malformed output throws `MalformedResponseError`).
- `src/ai/client.ts`: browser side. `DEMO_MODE` (`VITE_DEMO_MODE=true`, set in the Pages workflow)
  means no AI requests at all. It re-validates responses in the browser.
- `components/AiAssist.tsx`: the panel on step 1 of Add email: editable suggestions with evidence,
  per-field "Use" ticks, an injection banner, safety warnings. **Apply** copies into the form only;
  saving still goes through the normal review and confirm. Provenance: `email.aiAssist`.
- Default model `qwen2.5:7b` (4.68 GB). Ollama lives in `~/.local/ollama`; models in `~/.ollama`.

- Briefs: `src/ai/brief.ts` (BRIEF_SCHEMA, BRIEF_SYSTEM_PROMPT, `redactInstructions`, `validateBrief`),
  `src/lib/briefSources.ts` (`buildSources` S1…Sn, `briefFreshness`), backend `POST /local-ai/brief`
  (timeout `LOCAL_AI_BRIEF_TIMEOUT_MS`, default 240 s, num_predict 1800). Both endpoints use num_ctx 16384 so the model isn't reloaded.
  Pages `PrepPage.tsx` (/prep) and `BriefPage.tsx` (/briefs/:id). Saved in the optional `briefs` collection.

### AI rules (don't weaken)
- Never call a non-local endpoint, and never add a cloud fallback.
- The email is data: keep it delimited, keep the system prompt rule, keep `validateExtraction` in
  both the backend and the browser.
- Unknown = blank. Never infer a company from a domain or a year from relative dates.
- AI output never saves, merges or links records by itself.
- Briefs: facts must cite S-ids with quotes found in the (redacted) source text. Commitments need
  commitment wording, and approval words need approval wording in the quote. Suggestions are checked for
  unsupported money and claimed agreements (removed), and years and institutions (flagged). Instruction-like
  lines are redacted from the model's copy only. Next steps become tasks only via the confirm dialog.
- Measured trade-off: precision over recall. Don't loosen checks to "find more facts"; improve the prompt instead.

## Commands
- `npm install`: install dependencies (first time only)
- `npm run dev`: start local dev server at http://localhost:5173/
- `npm run build`: type-check (app + `tsconfig.node.json` for vite.config/server) and build into `dist/`
- Local AI: `OLLAMA_NO_CLOUD=1 OLLAMA_HOST=127.0.0.1:11434 ~/.local/ollama/ollama serve` in one terminal, `npm run dev` in another
- `npm run preview`: serve the built `dist/` folder locally
- Publish changes: `git add -A && git commit -m "..." && git push`. The site updates about 1 minute later.
- GitHub CLI lives at `~/.local/gh/bin/gh` (not on PATH). Signed in as `jeojji`. Commits use
  GitHub's noreply email (set in this repo's git config).

## Requirements
`REQUIREMENTS.md` maps Lauren's Word document (primary source) and the CSV template headers
(import aliases) to the data model, lists every difference between them, and holds the open
questions for Lauren. Update it whenever a field or option list changes.

## Schema (version 3)
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

**Campaign:** name, purpose (CAMPAIGN_PURPOSES), projectTypes[], termSeason/termYear, state, description,
templateSubject/templateBody, participants[] {contactId, companyId at add time, status, statusHistory, notes}.
**Feedback:** applicationId (null if the application is deleted), applicationLabel, companyId, source,
givenBy, receivedOn, **originalText** (immutable), outcome, notes, flags[] {flag, flaggedAt, note}, editHistory.
Both are optional lists added after schema 3 (`withOptionalLists`), like briefs.

**Activity / Task:** `companyId` (the company at the time), `contactId`, and `applicationId`
(optional link to an application, added in schema 3). Activities also have optional
`email?: EmailDetails` (direction, from, to, forwarded, originalSender, dateKnown,
**originalText**, fingerprint) for emails added via "Add email" (`source: 'email-intake'`), and
optional `editHistory?: ActivityEdit[]`. These are optional fields, so no schema bump was needed.

**Application** (Lauren's "Opportunity", an engagement opportunity, NOT a job application):
`title`, `companyId` (required; many per company), `primaryContactId`, `projectType`
(APPLICATION_PROJECT_TYPES, 15), `program` (HBA/MBA/MSc/CEMS), `termSeason` (Fall/Winter/Summer) +
`termYear`, `scope`, `confirmationDeadline` (the "Close Date", always labelled "Participation
confirmation deadline"), `stage` (APPLICATION_STAGES: the 10 exact stage names), `notes`,
`stageHistory[]` ({stage, changedAt}, appended by `updateApplication` on every stage change).

Migrations: `src/data/migrations.ts`: `migrateV1` (1→2), `migrateV2` (2→3: empty applications,
`applicationId: null`; never infers applications from participation tags), `upgradeToCurrent`
(chains them), `previewMigration`. Shown to the user by `components/UpgradeScreen.tsx`.

### Campaign and feedback rules
- Campaign participant status = APPLICATION_STAGES (Lauren: campaigns reuse Opportunity statuses). It's stored
  per participant (`Campaign.participants[]`) and never synced with company statuses or application stages.
- Do Not Contact: refused in `addParticipants` and `recordOutreach`, disabled in the UI, left out of
  `participantsCsv`. Never send email or claim sequences; outreach is recorded by hand (one activity per person).
- Feedback `originalText` is immutable (`updateFeedback` drops changes to it). Flags are manual, dated,
  and shown with their project. Nothing may block, hide or rank companies by flag automatically.

### Email intake rules
- Manual entry only: never parse, extract, guess or simulate AI. Unknown values stay blank
  (`dateKnown: false` when there's no date).
- `email.originalText` is immutable: `updateActivity` restores it if a change tries to alter it.
  Notes live in `details`.
- For forwarded emails, the partner is the explicitly entered original sender, never the forwarder.
- Pre-select only a single exact email-address match. Everything else is an explicit choice.
- New records + the email are saved with one `saveBatch` (all or nothing). Duplicates are flagged
  (`findDuplicateEmails`), and saving needs an explicit "Save anyway".
- `updateActivity` appends an `editHistory` entry for changes to TRACKED_ACTIVITY_FIELDS.

### Application rules
- Application stage is separate from company partner statuses and contact statuses. Never sync them.
- "Awaiting review" = Application submitted / Meeting completed. "Approaching deadline" = within
  `DEADLINE_SOON_DAYS` (14) or passed, while unconfirmed (Identifying → Project Approved).
  Definitions live in `lib/options.ts` + `lib/applications.ts`. They're prototype choices, listed
  in REQUIREMENTS.md for Lauren to confirm.
- Deleting an application keeps its activities and follow-ups (it only clears `applicationId`).
  Companies with applications can't be deleted. Deleting a contact clears `primaryContactId`.

### Import rules (don't weaken these)
- Never drop data: unknown picklist values are imported as written and flagged. Blank cells never clear fields.
- A matched record's differing value is a **conflict that keeps the current value** unless the user
  chooses otherwise. Notes change only via an explicit "add below" or "replace" choice.
- Never merge records. Ambiguous or possible matches (records or Account Names) wait for the
  user. Unresolved rows are skipped, not guessed.
- Re-importing the same file (or an export) must create nothing: match by Workspace ID, then
  name/email. Duplicate rows within a file are skipped.
- Import never creates activities. `lastProjectDate` ≠ last communication (derived from emails,
  calls and meetings via `lastCommunicationAt`).
- Imports are written with one `repository.bulkWrite` (all or nothing). Restores go through `checkBackup` first.
- Never commit anything from `reference/`. Testing against the real templates is done locally,
  printing counts only.

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
  data/backup.ts           JSON backup validation (types, unique ids, links) before restore
  components/applications.tsx  StageBadge, StageSelect (saves + Undo), DeadlineText, ApplicationForm, ApplicationMiniList
  pages/ApplicationsPage.tsx    List + pipeline (?view=pipeline, ?stage=__review|__deadlines|__open|<stage>)
  pages/ApplicationDetailPage.tsx  Stage tracker, details, linked activities/follow-ups, history
  lib/applications.ts      Term labels/sorting, deadline state, awaiting-review/closed helpers
  lib/email.ts             Email intake: contact/company suggestions, duplicate check, fingerprint
  pages/EmailIntakePage.tsx  4-step "Add email" (email → contact & company → application → review & save)
  pages/EmailDetailPage.tsx  Original message (read-only), notes, links + corrections, edit history
  pages/PrepPage.tsx       Conversation prep: choose records, preview sources, generate brief
  pages/BriefPage.tsx      Brief: facts with sources, suggestions, drafts, confirm-to-task, freshness
  lib/briefSources.ts      Numbered source pack from a selection; outdated detection
  pages/CampaignsPage.tsx, CampaignDetailPage.tsx  Campaign list; participants, template copy, record outreach, export
  components/campaigns.tsx Campaign form + state badge;  lib/campaigns.ts  template filling, participant CSV (no DNC)
  components/feedback.tsx  Feedback form/list, FlagBadge, CompanyFlags (profile + new-application form)
  ai/extraction.ts         Local-AI contract: schema, prompt, injection detector, validation (shared with server/)
  ai/client.ts             Browser client for /local-ai (DEMO_MODE disables it)
  components/AiAssist.tsx  "Suggest details with local AI" panel
server/
  localAi.ts               Vite plugin: local backend for AI extraction (loopback-only Ollama)
  import/
    fields.ts              Import/export columns: template headers (export order) + aliases
    plan.ts                Pure import logic: parse rows, match, diff, decisions → write operations
    exporters.ts           CSV exports (companies/contacts in template format, activities, follow-ups)
  lib/                     Pure helpers (dates, validation, selectors, ids)
    options.ts             Lauren's picklists, CSV aliases, normalizeOption()
    review.ts              "Needs review" detection, address formatting
    csv.ts                 RFC 4180 parse/serialize, formula protection, UTF-8/Windows-1252 file reading
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
7. **Lauren's fields** ✅ (2026-10-19, pushed 2026-10-20) Expanded company and contact schema,
   sectioned forms with multi-selects, detailed profiles, new filters (status, priority,
   project type, role, "Needs review"), Do Not Contact flags, schema-1 → 2 upgrade with backup
   download, relationship-history fix. Verified with headless-browser scripts: 44 upgrade,
   field and history checks, plus the original workflow test.
8. **CSV import/export + backup/restore** ✅ (2026-10-20, pushed 2026-10-20) `/import-export` page.
   Import: choose file → column mapping (template headers auto-mapped) → preview (new, updates,
   conflicts with per-field choices, needs-your-choice, already up to date, skipped, flagged) →
   one all-or-nothing `bulkWrite`. Company matching for contacts is resolved per Account Name.
   Exports: companies/contacts in template format (+ Workspace ID), activities, follow-ups.
   Full JSON backup and validated restore. Full rules: REQUIREMENTS.md, "CSV import and export".
9. **Applications** ✅ (2026-10-20, pushed 2026-10-20) Engagement opportunities with Lauren's
   10 stages: list with search and filters (stage, awaiting review, deadlines, project type, program,
   term, company), pipeline with a stage control per card (+ Undo), detail page with a stage tracker,
   next/previous buttons and stage history, add/edit/delete, applications on company and contact
   profiles, activity/follow-up links, dashboard "Open applications", "Applications awaiting review"
   and "Participation deadlines", CSV export, schema 2 → 3 upgrade.
10. **Add email intake** ✅ (2026-10-20, pushed 2026-10-20) Manual 4-step intake from the Possible
    Workflow PDF: paste email + enter sender/recipients/subject/date, explicit original sender for
    forwards, suggested contact/company matches, create-or-link records, optional application,
    review with duplicate warning, one all-or-nothing save. Email page with read-only original,
    separate notes, link corrections and edit history. Emails show in company, contact and
    application histories.
11. **Local AI suggestions** ✅ (2026-10-20, pushed 2026-10-20) Ollama + qwen2.5:7b on 127.0.0.1, backend
    plugin, validated structured output with verifiable excerpts, injection detection, demo mode on
    Pages. Measured 98.1% on 14 synthetic emails, ~17 s per email, verified with internet blocked.
    Tuning notes: no `repeat_penalty` (it breaks verbatim quoting); schema `maxLength`/`maxItems` +
    `num_predict` 900 prevent runaway repetition.
12. **Relationship briefs + conversation prep** ✅ (2026-10-20, pushed 2026-10-20) /prep and /briefs/:id,
    facts with verified quotes, separated suggestions, outdated detection, confirm-before-task,
    editable/copyable drafts. Live eval: all safety checks pass; ~27 s per brief.
13. **Campaign tracking + project feedback** ✅ (2026-10-20, pushed 2026-10-20) Campaigns with per-participant
    Opportunity statuses, DNC exclusion, templates for copying, manual outreach recording, participant
    export. Feedback with immutable original text, dated manual flags shown on company + new application.
14. **Daily-use review + demo preparation** ✅ (2026-10-20, pushed 2026-10-20) Every delete explains
    what happens to linked records (`LinkedImpact`). Closing a form with typed input asks first (Modal). Other-tab
    saves sync in (`repository.subscribe`), and future feedback dates are refused. Tables scroll on narrow screens, the sidebar
    is grouped, and "Import contacts next" works. **Reset demo data** (Prototype & data, `#demo-data`) asks for confirmation and offers a backup.
    "What works where" table. Fictional demo files in `public/demo/` (5 companies, 7 contacts, 1
    application email; no reference-file values). DEMO.md has the script, both operating modes, the localStorage
    limitation, the SQLite migration proposal and dependencies. The demo journey passed 19/19 with the real model.
15. **Deploy** ✅ Repo https://github.com/jeojji/ivey-el-crm-prototype (public). Live at
   https://jeojji.github.io/ivey-el-crm-prototype/. Every push to `main` rebuilds and
   redeploys via `.github/workflows/deploy.yml` (Pages source: GitHub Actions).

Acceptance workflow (verified end to end with a headless-browser script on 2026-10-19):
Add a company → add a contact → log a meeting → create a follow-up → see it on the dashboard.

## Verification approach
No test framework is installed. Each phase was verified with throwaway scripts in the session
scratchpad: pure-logic checks bundled with esbuild (`npx esbuild … --bundle --platform=node`),
plus headless-Chrome checks driven over the DevTools protocol against `npm run dev`. Re-create
similar checks when changing import, migration or history logic. Adding Vitest would be a
sensible next step if tests should live in the repo.

## Remaining work and open questions
- All phases were pushed on 2026-10-20 (commit 7f8e848). Anyone who
  used the live site gets the upgrade screen (schema 2 → 3) once.
- From the Possible Workflow PDF, not built: application documents, uploading saved email files, a review queue for uncertain matches, refreshing a brief
  automatically after a meeting.
- Open questions for Lauren are listed at the end of REQUIREMENTS.md (project-type list for
  contacts, referral Source wording, "Not an Ivey Alumnus"/EMBA, multi-select project participation,
  Contact Status in the import template).
- Proposed, separate piece of work: local SQLite database behind a small local server (see DEMO.md).
- Not planned until requested: sending email / sequences, login and sharing,
  Outlook logging, course/student linking (Lauren's Phase 2).
