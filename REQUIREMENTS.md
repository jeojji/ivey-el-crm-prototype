# Requirements reconciliation

How Lauren Starr's requested fields map onto this prototype's data model, and where the
source files disagree.

**Sources** (kept in `reference/`, which is git-ignored and never published):

| Source | Role |
| --- | --- |
| `Salesforce CRM Setup Request.docx` (Lauren Starr, May 2026). Paragraphs and both field tables read. | **Primary.** Option lists and field types follow this document. |
| `SF_Import_Accounts.csv` (14 columns) | Import template. Its column names are supported as **import aliases**. |
| `SF_Import_Contacts.csv` (17 columns) | Import template. Its column names are supported as **import aliases**. |
| `Possible Workflow.pdf` (team proposal, 9 pages) | Workflow context: applications linked to companies and contacts, each with its own status, and "applications awaiting review" on the dashboard. Its AI, email-intake and local-database proposals are **not** part of this prototype. |

> The request referred to `SF_Import_Accounts(1).csv` and `SF_Import_Contacts(1).csv`. The files
> provided are named without "(1)". These are assumed to be the same files.

Both CSVs begin with an **instructions row** (row 2), e.g. `Values: High | Medium | Low`. It is a
template guide, not a record. The importer detects and skips it.

Option lists in code: `src/lib/options.ts`. Review flags: `src/lib/review.ts`.

---

## Company (Account) fields

| Lauren's field (Word doc) | CSV column (alias) | App field | Type in app | Notes |
| --- | --- | --- | --- | --- |
| Company Name (Accounts) | `Account Name` | `name` | text, required, unique | |
| — *(not in doc)* | `Phone` | `phone` | text | Requested for this phase. CSV format `+1-XXX-XXX-XXXX`. |
| — *(not in doc)* | `Website` | `website` | text | Existing field. |
| — *(not in doc)* | `Billing Street` / `City` / `State/Province` / `Postal Code` / `Country` | `address.street` / `.city` / `.province` / `.postalCode` / `.country` | text ×5 | "Full address" requested for this phase. |
| Industry (picklist, 38 values) | `Industry` | `industry` | single select | Doc list used. See differences below. |
| Partnership Priority (High, Medium, Low) | `Partnership Priority` | `priority` | single select | Lists match. |
| "Parnter Status" (sic): picklist, **multiple choice** | `Partner Status` | `statuses[]` | multi-select | Same 4 values in both. The doc label has a typo; the app shows "Partner status". |
| Project Participation ("which project types has this company *ever* participated in?") | `EL Project Participation (Account)` | `projectParticipation[]` | multi-select | Doc says "Picklist" (single), but the question and the CSV (`;`-separated) imply multiple. **Multi-select used, as requested.** |
| Last Project Participated (Date) | `Last Project Participated (Account)` | `lastProjectDate` | date `YYYY-MM-DD` | **This row appears twice in the doc table** (once with a description, once bare). Treated as one field. |
| Notes / Relationship Context (Long Text) | `Description/Notes` | `notes` | long text | Shown as "Relationship notes". |
| — | — | `description` | text | Prototype-only "About the company" summary, kept from v1. Not in Lauren's list. |

## Contact (Individual) fields

| Lauren's field (Word doc) | CSV column (alias) | App field | Type in app | Notes |
| --- | --- | --- | --- | --- |
| *(standard)* | `First Name`, `Last Name` | `firstName`, `lastName` | text, required | |
| *(standard)* | `Title` | `jobTitle` | text | |
| *(standard)* | `Account Name` | `companyId` | link to company | CSV links by **exact company name**. |
| *(standard)* | `Email` | `email` | email, unique | |
| — | `Phone` ("Direct work phone") | `workPhone` | text | v1 `phone` migrated here. |
| — | `Mobile` | `mobilePhone` | text | |
| Contact Status (multiple choice) | **— no CSV column** | `statuses[]` | multi-select | Same 4 values as Partner Status. **Not in the CSV template**, so imports will leave it empty. |
| Contact Priority (High, Medium, Low, Do not Contact) | `Contact Priority` | `priority` | single select | Doc spells "Do not Contact", CSV "Do Not Contact". Matched case-insensitively. Stored as **"Do Not Contact"**. |
| Contact Role (multiple choice) | `Contact Role` | `roles[]` | multi-select | Lists match (8 values). |
| EL Project Participation (multiple choice) | `EL Project Participation (Contact)` | `projectParticipation[]` | multi-select | Doc's contact list differs from its account list. See below. |
| Last Project Participated (Date) | `Last Project Participated (Contact)` | `lastProjectDate` | date | |
| LinkedIn URL | `LinkedIn URL` | `linkedInUrl` | URL (`https://…`) | |
| Preferred Contact Method (Email, Phone, LinkedIn, In-Person) | `Preferred Contact Method` | `preferredContactMethod` | single select | Lists match. |
| Source | `Source` | `source` | single select | Doc and CSV wording differ. See below. |
| Alumni (multiple choice) | `Ivey Alumni` | `alumniPrograms[]` | multi-select | Doc and CSV lists differ. See below. |
| Graduation year [If alumni] (4-digit number) | `Graduation Year` | `graduationYear` | number or empty | Validated: 4 digits, 1920 to current year + 6. Requires an alumni program. |
| Notes / Relationship Context (Long Text) | `Notes / Relationship Context` | `notes` | long text | Shown as "Relationship notes". |

---

## Where the sources differ, and what the app does

Rule: **the Word document wins.** CSV spellings that clearly mean the same thing are accepted
as aliases. Values with a *different meaning* are **kept as-is and flagged "Needs review"**,
never silently converted or dropped.

| Field | Word document | CSV template | Decision |
| --- | --- | --- | --- |
| Industry | 38 detailed values, e.g. `Energy/Resources`, `Charities/Non-Profit`, `Transportation/Distribution/Logistics/Wholesale Trade` | 10 example values, e.g. `Energy`, `Non-Profit`, `Transportation` | Doc list used. Aliases: `Energy` → `Energy/Resources`, `Non-Profit` → `Charities/Non-Profit`, `Transportation` → `Transportation/…Wholesale Trade`. Other CSV examples already match the doc. |
| Project type names | Account list: `MBA Ivey Field Project`, `HBA Ivey Field Project`, includes `Guest Speaker` (17 values) | Same as the doc's Account list, for **both** accounts and contacts | One shared list (the doc's Account list) for companies and contacts. |
| Project type names (contacts) | Contact list: `MBA Field Project`, `HBA Field Project`, **no** `Guest Speaker`, and `MMA Field Project Other` (missing comma) | Uses the Account list | `MMA Field Project Other` read as two values, `MMA Field Project` and `Other`. Aliases: `MBA Field Project` → `MBA Ivey Field Project`, `HBA Field Project` → `HBA Ivey Field Project`. `Guest Speaker` is offered for contacts too, matching the CSV. **Confirm with Lauren.** |
| Partner Status label | `Parnter Status` | `Partner Status` | Typo. App uses "Partner status". |
| Contact Status | Present (multi) | **Missing** | Field included. CSV imports leave it empty. |
| Contact Priority | `Do not Contact` | `Do Not Contact` | Case-only difference. Stored as `Do Not Contact`. |
| Source: incoming | `Incoming interest` | `Incoming Interest` | Case-only difference. Doc spelling stored. |
| Source: referral | `Referral (from Corporate partners, Alumni or Faculty)` | `Referral (Alumni/Faculty/Student)` | **Different meaning** (the CSV adds students and drops corporate partners). Not aliased: an imported CSV value is kept as-is and flagged for review. **Confirm with Lauren.** |
| Alumni | Includes `EMBA` | Omits `EMBA`, adds `Not an Ivey Alumnus` | Doc list used, **plus** `Not an Ivey Alumnus`, so "confirmed not alumni" isn't lost as "unknown". Choosing it clears the other options. |
| Address, company phone, website | Not in the doc's custom-field table (standard Salesforce fields) | Present (`Billing …`, `Phone`, `Website`) | Included, as requested for this phase. |
| Work phone vs mobile | Not specified | `Phone` = direct work phone, `Mobile` = mobile | Two separate fields. |

---

## Migration from the previous prototype (schema 1 → 2)

Done in the browser by `src/data/migrations.ts`, **only after the user clicks Upgrade** on a
screen that first offers a downloadable `.json` backup.

| Previous field | New field | Rule |
| --- | --- | --- |
| Company `status` (single: Active partner / Prospect / On hold / Past partner) | `statuses[]` | Case-insensitive match to Lauren's list: `Active partner` → `Active Partner`, `Past partner` → `Past Partner`, `Prospect` → `Prospect`. **`On hold` has no match.** It's kept as-is and flagged "Needs review". The original value is always copied to `legacy.status`. |
| Company `city` (free text, e.g. "Toronto, ON") | `address.city` | Copied unchanged, not split into city/province, so nothing is guessed. Also kept in `legacy.city`. |
| Company `industry` (free text) | `industry` | Kept unchanged. Values outside Lauren's list are flagged for review. |
| Contact `phone` | `workPhone` | Copied unchanged. `mobilePhone` starts empty. |
| — | all other new fields | Empty: `''`, `[]` or `null`. Nothing is invented. |
| Activities, follow-ups | unchanged | Byte-for-byte identical after migration. |

Storage: the upgraded data is saved under `el-relationship-workspace:v2`. The original
`el-relationship-workspace:v1` entry is **never modified or deleted**, so it remains a second
backup ("Download pre-upgrade original" on the Prototype & data page).

---

## Relationship history rule (fixed in this phase)

**Previous behaviour (bug):** saving *any* edit to a contact rewrote the company on **all** their
activities and follow-ups to the contact's current company, even when the company hadn't
changed. Moving a contact erased which company past meetings were with.

**Now:**
- Activities keep the company they were logged against, forever.
- Completed follow-ups keep their company.
- When a contact's company changes, the form asks whether to **move their open follow-ups** to
  the new company or keep them with the old one. The default is to move them.
- New activities and follow-ups default to the contact's **current** company.
- The contact's profile still lists every past activity, each linked to the company it happened with.
- Editing an old activity keeps the original contact selected, even if they've since moved
  (shown as "Name (now at Company)").

---

## CSV import and export (built)

Code: `src/lib/csv.ts` (reading/writing), `src/import/fields.ts` (column definitions),
`src/import/plan.ts` (matching and preview logic), `src/import/exporters.ts`,
`src/data/backup.ts` (backup validation), UI in `components/ImportWizard.tsx` and
`pages/ImportExportPage.tsx`. Files are read and created **in the browser only**.

**Columns.** Every header in both templates maps automatically (case-insensitive). Each column
can be re-mapped or set to "Don't import" before previewing. The doc labels (e.g. "Parnter Status",
"Contact Status", "Alumni") and the app's own labels are accepted too. Two columns can't map
to the same field, and the required fields (Account Name, or First and Last Name) must be mapped.

**Instructions row.** The row directly under the headers is skipped when it is the template's
guidance row (first cell starts with "INSTRUCTIONS", or at least 40% of cells look like
"Values: …", "e.g. …", "Format: …", "REQUIRED", "Separate multiple…").

**Values.**
| Type | Rule |
| --- | --- |
| Multi-select | Split on `;`, trimmed, de-duplicated. Each value is matched to Lauren's list ignoring case, then via aliases. |
| Picklists | Unknown values are **imported as written and flagged "Needs review"**. Nothing is dropped. |
| Dates | `YYYY-MM-DD` (or `YYYY/MM/DD`) and must be a real date. Anything else (e.g. `04/15/2024`) is left out with a warning, because month/day order can't be guessed safely. |
| Graduation year | 4 digits, 1900–2100, otherwise left out with a warning. |
| Email, phone, LinkedIn, website | Kept as written. A warning appears if the format looks wrong. Emails are lower-cased. LinkedIn gets `https://` if it's missing. |
| Blank cells | Never clear an existing value. |

**Matching (re-imports never duplicate).**
- Companies: Workspace ID (from an export), then name ignoring case, accents, punctuation and
  "&"/"and". If several existing companies match, that's **ambiguous**. A name that only matches
  after dropping a legal suffix (Inc, Ltd, Corp, Co, LLC…) is a **possible** match. Both wait for
  the user to choose an existing record or "add as new". Records are never merged.
- Contacts: Workspace ID, then email. Without an email, a single same-named contact at the same
  company (or both with no company) is a match. Otherwise a same-named contact is a possible match.
- Contacts → companies: Account Name is matched the same way as company names. Each unmatched,
  possible or ambiguous Account Name is listed **once** with how many contacts use it. The user
  picks an existing company, "Create new company", or "Import without a company". Rows stay
  skipped until the user chooses. Import companies first so most Account Names match.
- A second row in the same file describing the same record is skipped as a duplicate.

**Updates.** For a matched record, each field is either:
- **Fill**: the existing field is empty, so the file value is applied.
- **Conflict**: both have different values. The default is **keep current**. The user can choose
  "use file value". Multi-selects also offer "keep both". Notes offer "add file note below
  current". Notes are never overwritten or appended without that explicit choice. A note
  already contained in the existing notes is not a conflict, so a re-import doesn't append it twice.

**Last project vs last communication.** "Last Project Participated" imports into the record's
`lastProjectDate` only. Import never creates activities. "Last communication" is worked out from
logged emails, calls and meetings (notes excluded), is shown separately on profiles and
directories, and is exported read-only as "Last Communication (read-only)".

**Exports.** Companies and Contacts CSVs use the template headers in template order, then extra
columns: About (companies), Contact Status (contacts), Workspace ID, and Last Communication.
Multi-selects are joined with `;`, as in the template. Cells that a spreadsheet would read as a
formula get a leading apostrophe (phone numbers are left alone), and it's removed again on
import. Activities and follow-ups also export to CSV.

**Backup and restore.** A full JSON backup can be downloaded at any time. A restore file is checked
before anything changes: valid JSON, a known schema version (schema 1 files are upgraded the same way
as browser data), every field the right type, no duplicate ids, and every link (contact → company,
activity/follow-up → company/contact) pointing to a record in the file. Problems are listed and
the workspace is left untouched. A valid file shows counts next to the current data and requires
confirmation.

**Real template check (local only).** Lauren's two templates import with no unmatched columns:
15 companies and 23 contacts, every contact linked to its company, nothing skipped. 8 contacts are
flagged because their Source uses the CSV's referral wording. Re-importing creates nothing. Only
counts were recorded. No reference data is in the repository.

## Applications (Lauren's "Opportunities")

Called **Applications** in the app, as in the workflow PDF. They are engagement opportunities with a
partner, **not** job applications. Code: `Application` in `src/types.ts`, options in
`src/lib/options.ts`, helpers in `src/lib/applications.ts`, UI in `components/applications.tsx`,
`pages/ApplicationsPage.tsx` and `pages/ApplicationDetailPage.tsx`.

| Lauren's field (Word doc, "Fields to Track Per Opportunity") | App field | Notes |
| --- | --- | --- |
| *(record name)* | `title` | Required. |
| *(account)* | `companyId` | Required. One company can have **many** applications. |
| Primary Contact ("who you're negotiating with") | `primaryContactId` | Optional. The picker lists the company's contacts. A contact who later moves company stays selected, shown as "(now at …)". |
| Project Type | `projectType` | See the list difference below. |
| Program: HBA, MBA, MSc, CEMS | `program` | Single choice. |
| Academic Term: Fall/Winter/Summer + Year | `termSeason` + `termYear` | Both or neither. |
| Stage | `stage` | The 10 stages below, exact wording. |
| Close Date ("the deadline to confirm participation") | `confirmationDeadline` | Labelled **"Participation confirmation deadline"** everywhere. |
| *(requested for this phase)* | `scope` | "Scope / description". The PDF also lists scope per application. |
| *(requested for this phase)* | `notes` | |
| *(prototype)* | `stageHistory` | Every stage change with a timestamp, oldest first. |

**Stages** (exact text and order from the doc's pipeline table; meanings shown as hints):
Identifying · Outreach Sent · Application submitted · Meeting completed · Project Approved ·
Team Confirmed · Active · Completed · Declined · Deferred.
The capitalisation is inconsistent in the source ("Application submitted" vs "Outreach Sent") and
is kept exactly as written.

**Separate concepts.** An application's stage never changes a company's partner status or a
contact's status, and vice versa (the PDF says "Company partnership status, contact priority and
application status are separate concepts").

**Project type list.** The doc's Opportunity list has 15 values, spelled "MBA Field Project" and
"HBA Field Project", with no "Guest Speaker" and no "Other". The app uses the same 15 project types,
with the shared spellings "MBA Ivey Field Project" / "HBA Ivey Field Project" (as for companies and
contacts), so all three can be filtered together. **See open question 7.**

**Dashboard rules** (prototype definitions, for Lauren to confirm):
- *Awaiting review* = stage **Application submitted** or **Meeting completed**: the scope has been
  shared, but the EL office hasn't approved the project yet.
- *Approaching deadline* = confirmation deadline within **14 days**, or already passed, while the stage
  is still before **Team Confirmed** (Identifying → Project Approved). Once the partner has
  confirmed, or the application is closed, the deadline is no longer highlighted.
- *Open* = any stage except Completed, Declined or Deferred.

**Links.** Activities and follow-ups have an optional `applicationId`. Choosing an application in
their form fills its company (and its primary contact if none is chosen). Changing the company
away from the application's company clears the link. Deleting an application keeps its activities
and follow-ups and only removes the link. A company with applications can't be deleted. Deleting a
contact clears them as primary contact.

**Migration (schema 2 → 3).** Runs only after the user clicks Upgrade (backup offered first). It
adds an empty `applications` list and `applicationId: null` on every activity and follow-up.
**No applications are created from project-participation tags**, which record past involvement,
not opportunities. The schema-2 copy (`el-relationship-workspace:v2`) is left untouched. Schema-1
data upgrades through both steps. JSON backups from any earlier schema are upgraded the same way
on restore.

**Export.** Applications export to CSV (title, company, primary contact, project type, program, term,
year, stage, participation confirmation deadline, scope, notes, date of last stage change,
Workspace ID). They are included in JSON backups. There is no CSV *import* for applications (Lauren's
templates don't include one).

**From the PDF, not built:** documents attached to applications, project outcomes and student
feedback flags, email intake/extraction, AI summaries and drafts, a review queue.

## "Add email" intake (manual)

Based on the Possible Workflow PDF's "From email to CRM" flow (paste → check existing records →
Lauren reviews → save linked records). In this prototype, **Lauren enters the details herself.
Nothing is extracted, guessed or simulated**: no AI, no parsing of the message body, no inbox access.
Code: `pages/EmailIntakePage.tsx`, `pages/EmailDetailPage.tsx`, `lib/email.ts`.

| Step | What happens |
| --- | --- |
| 1. Email | Paste the original message (required). Enter direction (received/sent), From name and address, To, Subject and Date. Anything unknown stays blank. For a forwarded email, the original sender must be entered, or "Original sender unknown" ticked explicitly. |
| 2. Contact & company | Suggestions, each labelled with its reason: contacts with the **same email address**, the same name, or the same company email domain (personal domains like gmail.com are ignored); companies that are the contact's company, have the same or a similar name, or whose website or other contacts use the email's domain. Only an exact single email-address match is pre-selected. Lauren chooses an existing record, **creates a new one** (prefilled only from what she typed), or links none. Creating a contact or company that duplicates an existing email or name is refused. |
| 3. Application | Optional: none, one of the chosen company's applications, or a new application (title required, other fields blank unless entered; primary contact = the chosen contact). |
| 4. Review & save | Shows everything that will be created or linked, the read-only original message, and an editable notes box. **Possible duplicates** are listed first, and saving is blocked until Lauren ticks "Save anyway". Confirm saves **everything in one all-or-nothing write**. If it fails, nothing is saved and the form keeps the entered details for a retry. "Discard and start over" clears the form. |

**What is stored.** An `email` activity (`source: 'email-intake'`) with `email` details: direction,
from, to, forwarded, original sender, whether the date is known, the **original message exactly as
pasted**, and a fingerprint. The editable notes are kept separately in the activity's `details`. If
the date is unknown, `occurredAt` is the time it was added and the email is shown as "Date unknown".

**Matching the partner.** For a received email the partner is the sender, or the **original sender**
if forwarded. For a sent email it's the first address in To. The forwarder is never treated as the partner.

**Duplicate check.** *Same message*: the pasted text matches a saved email, ignoring spacing and
case. *Possible duplicate*: the same subject (ignoring "Re:"/"Fwd:") on the same day with the same
contact or address. Manually logged email activities with the same subject on the same day count too.

**Where it appears.** In the company, contact and application histories (each linked by the
activity's own company/contact/application), in Activity history and on the dashboard. Each email
links to its page.

**Corrections and edit history.** On the email page, "Correct links or details" changes the
company, contact, application, subject or date. Notes are edited in place. Every change to an
activity (by any form) is appended to its `editHistory` with time, field, old and new value. The
email page shows it in plain words. The original message can't be changed: the data layer
ignores any attempt. Correcting a link doesn't change the linked contact or company records.

**Data compatibility.** The new fields are optional, so existing data needs no upgrade. Backups
validate email details when present. The activities CSV export includes source, from, to,
original sender and the original message.

## Local AI suggestions in "Add email"

Implements the PDF's "Use local AI to read an email" step as an **optional assistant** on step 1 of
Add email. Setup, settings and limitations: `SETUP-LOCAL-AI.md`. Measured results: below.

Measured on 14 synthetic emails (incl. forwarded, missing details, ambiguous companies and three
with hidden AI instructions): **151/154 checks correct (98.1%)**, nothing taken from injected
instructions, typical answer 17 s (first 24 s) on an Apple M4 / 16 GB. It also works with internet
access blocked. Full table: `SETUP-LOCAL-AI.md`.

| PDF / request | How it's met |
| --- | --- |
| Local model, no cloud AI, no automatic cloud fallback | Ollama on 127.0.0.1 with `OLLAMA_NO_CLOUD=1`. The backend refuses non-local URLs and cloud models. If unavailable, an error is shown and the form stays manual. |
| Extract company, contact, project need, project type, academic term, missing information | Also proposes contact email/job title, a short project title, and whether the email is forwarded (with its marker quoted). |
| Validated structured output | Ollama JSON-schema output with length limits, then `validateExtraction` in the backend **and** again in the browser. |
| Supporting excerpts | Every proposed value is shown with the email line it comes from. Names, emails, company, job title and year must appear word for word. Project type and term must be named in the email. Summaries must cite a real passage. |
| Leave unknown blank | The prompt forbids guessing, and validation blanks anything unsupported (with the reason). No company from domains, no year from "next January". |
| Email text is data, not instructions | Email delimited in the prompt. The system prompt says never to follow it. A separate detector finds instruction-like lines, shows them to Lauren, and blanks any value taken from them. |
| Correct every field | Every suggestion is an editable box with its own "Use" tick. Applying fills the normal form fields, which stay editable. |
| Never save or merge without confirmation | AI only fills the form. Choosing/creating records, the duplicate check and "Confirm and save" are unchanged. The saved email records which fields came from AI (`email.aiAssist`). |
| Unavailable model / malformed response / timeout | Clear messages for: Ollama not running, model not downloaded, cloud model refused, timeout (default 120 s), answer cut off, invalid JSON / wrong shape, server errors. A Cancel button while it runs. |
| Separate GitHub Pages demo mode | `VITE_DEMO_MODE=true` in the Pages build: the panel says "Not available in the online demo" and no AI request is made. |
| PDF: AI summaries, reply drafts | Built later as relationship briefs and conversation prep (below). |

## Relationship briefs and conversation prep

From the PDF's "Use AI to summarize the relationship" and "Conversation prep" sections and the clickable
prototype's company brief and prep screens. Code: `src/ai/brief.ts` (prompt, schema, validation),
`src/lib/briefSources.ts` (numbered sources, freshness), `pages/PrepPage.tsx`, `pages/BriefPage.tsx`,
backend `POST /local-ai/brief`. Setup, results and limitations: `SETUP-LOCAL-AI.md`.

| Request | How it's met |
| --- | --- |
| Select company, contact, application and communications | Prep page pickers. The application's communications (or the 6 most recent) are pre-ticked. Records + open follow-ups are added automatically, and the exact source list is shown. |
| Summary, commitments, outstanding questions | "Recorded facts". Each statement cites S-numbered records with verbatim quotes, verified in backend and browser. Untraceable statements are removed with the reason. |
| Suggested next steps, objective, script, talking points, follow-up email | "AI suggestions", in a separate labelled card. Editable, Copy buttons, autosaved with the brief. Nothing is sent. |
| Link facts to sources | Each quote links to the company/contact/application page, the email page, or follow-ups. |
| Separate facts from suggestions | Separate cards, badges ("From your records" / "Review before use"), and a "Not found in the selected records" list. |
| No inferred approval or commitments | Prompt rules + validation: commitments need commitment wording in the quote. Approval/agreement words need approval wording in the quote. Suggestions claiming agreement without a record are removed. |
| Generation time; outdated when sources change | Brief stores generatedAt, model, duration and each source's `updatedAt`. Edited or deleted sources → "may be outdated" (brief page and company card). Newer communications are noted separately. |
| Next steps → tasks only after confirmation | Tick → edit wording → required due date → confirmation dialog → one all-or-nothing write that also records the task ids on the brief. |
| Preserve original communications | Sources are read-only copies. Generating, editing drafts and creating tasks don't change activities (tested). Injected lines are redacted only in the model's copy. |

Saved briefs are an optional `briefs` list in the database (no schema bump; older data and backups
without it load as empty). JSON backups include briefs. A brief's links may point to records
deleted later; it's then shown as outdated.

## Campaign tracking

From Lauren's "Campaigns" section: outreach for **all EL project types**, for (1) inviting new partners
to a project or event, (2) renewing past partners, (3) surveying after projects (partners and EIRs).
"The statuses above in Opportunities would be used for campaigns as well."
Code: `pages/CampaignsPage.tsx`, `pages/CampaignDetailPage.tsx`, `components/campaigns.tsx`,
`lib/campaigns.ts`.

| Request | How it's met |
| --- | --- |
| Campaigns for invitations, renewals, surveys | Purpose: Project invitation / Partner renewal / Survey (with Lauren's description as a hint). Prototype-only campaign state: Planning / Active / Closed. |
| Link to project types, terms, contacts | Multi-select project types (the 15 application types), term + year, participants = contacts. |
| Participant status separate from company status and application stage | Each participant has their own status and status history, stored only in that campaign. Tested: changing it leaves company statuses, application stages and other campaigns untouched. |
| Lauren's campaign statuses | The 10 Opportunity stages, exactly as written (her document says campaigns reuse them). |
| Exclude Do Not Contact | DNC contacts can't be ticked in "Add participants" (the reason is shown). The data layer refuses them anyway. If a participant later becomes DNC: red banner, can't record outreach for them, left out of the participant export (the toast says how many), and their template preview can't be copied. |
| Editable templates | Subject + message with `{{firstName}} {{lastName}} {{companyName}} {{term}} {{projectTypes}}`, filled per person for **Copy**. Unknown values stay blank. |
| Manual recording of outreach | "Record outreach": choose participants, type, date, subject, notes, and an optional "also set their status to…". This creates one activity per person (linked to contact, company and campaign; placeholders filled per person) and the status changes in one all-or-nothing write. |
| No sending, no sequences | No email is sent and nothing claims to be. The page says so, and the test confirms no request leaves the computer. |

**Not built:** scheduled sequences, sending, open/click tracking, uploading email lists into a
campaign (Lauren's "upload emails"). Participants come from existing contacts, which can be imported
by CSV.

## Project feedback and flags

From the PDF's "Record project outcomes and student feedback". Code: `components/feedback.tsx`;
shown on application pages, company profiles, and in the new-application form.

| Request | How it's met |
| --- | --- |
| Record feedback and outcomes against an application and company | "Record feedback" on an application: from (corporate partner, student team, EIR, EL office, other), given by, date (blank if unknown), original text, project outcome, notes. Stored with `applicationId`, `companyId` and the project's name and term. |
| Preserve original text | Required on entry, shown read-only afterwards. The data layer ignores any change to it. Edits to other fields are kept in an edit history. |
| Manual flags | Positive feedback / Needs review before future collaboration / Do not reuse, each with an optional reason and the date it was set (kept when other fields are edited). |
| Project and date behind each flag | Every flag is shown with the project name (linked if it still exists) and "flagged <date>": on the company profile and in the new-application form. |
| Visible when creating another application | Choosing a company in "Add application" shows its flags immediately. |
| Never decides automatically | The text says flags are information only and the decision is Lauren's. Applications can always be created (tested). Nothing filters, hides or blocks companies by flag. |

Deleting an application keeps its feedback (the project name is kept). A company with feedback can't
be deleted, so flags aren't lost.

**Data:** campaigns and feedback are optional lists (like briefs). Existing saved data and older
backups load without an upgrade and show none. Backups validate them (feedback must point to an
existing company and keep its original text). Outreach activities carry an optional `campaignId`.

## Not in this phase (from the Word document)

Listed for completeness. The prototype doesn't implement or claim these:

- Salesforce configuration of any kind (Record Type, permissions, sharing model, sandbox)
- Sending outreach emails or running email sequences (campaign *tracking* is built; see above)
- Outlook email logging, and any live integration
- Login, multi-user access (Lauren mentions up to 7 team members), per-record sharing
- Phase 2: linking partners to courses and student teams

## Open questions for Lauren

1. Should contacts use the same project-type list as companies (with "Ivey" in the names and including Guest Speaker)?
2. Which Source wording is correct for referrals: "from Corporate partners, Alumni or Faculty", or "Alumni/Faculty/Student"?
3. Is "Not an Ivey Alumnus" a wanted option, and should EMBA be in the CSV template?
4. Should company Project Participation be multi-select (as the CSV implies) rather than a single picklist (as the doc table says)?
5. Should Contact Status be added to the contacts import template?
6. Do "awaiting review" (Application submitted or Meeting completed) and "approaching deadline" (within 14 days, before Team Confirmed) match how she works?
7. Should application project types use the "MBA/HBA Ivey Field Project" spelling like the account list, or "MBA/HBA Field Project" as in the Opportunity list?
