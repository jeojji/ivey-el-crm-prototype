# Requirements reconciliation

How Lauren Starr's requested fields map onto this prototype's data model, and where the
source files disagree.

**Sources** (kept in `reference/`, which is git-ignored and never published):

| Source | Role |
| --- | --- |
| `Salesforce CRM Setup Request.docx` (Lauren Starr, May 2026). Paragraphs and both field tables read. | **Primary.** Option lists and field types follow this document. |
| `SF_Import_Accounts.csv` (14 columns) | Import template. Its column names are supported as **import aliases**. |
| `SF_Import_Contacts.csv` (17 columns) | Import template. Its column names are supported as **import aliases**. |

> The request referred to `SF_Import_Accounts(1).csv` and `SF_Import_Contacts(1).csv`. The files
> provided are named without "(1)". These are assumed to be the same files.

Both CSVs begin with an **instructions row** (row 2), e.g. `Values: High | Medium | Low`. It is a
template guide, not a record. A future CSV import must skip it.

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

## Not in this phase (from the Word document)

Listed for completeness. The prototype doesn't implement or claim these:

- Salesforce configuration of any kind (Record Type, permissions, sharing model, sandbox)
- Opportunities and the 10-stage engagement pipeline (Identifying → Deferred), with Project
  Type, Academic Term, Stage, Primary Contact, Close Date, Program
- Outreach campaigns and email sequences
- Outlook email logging, and any live integration
- Login, multi-user access (Lauren mentions up to 7 team members), per-record sharing
- Phase 2: linking partners to courses and student teams

## Open questions for Lauren

1. Should contacts use the same project-type list as companies (with "Ivey" in the names and including Guest Speaker)?
2. Which Source wording is correct for referrals: "from Corporate partners, Alumni or Faculty", or "Alumni/Faculty/Student"?
3. Is "Not an Ivey Alumnus" a wanted option, and should EMBA be in the CSV template?
4. Should company Project Participation be multi-select (as the CSV implies) rather than a single picklist (as the doc table says)?
5. Should Contact Status be added to the contacts import template?
