# Demonstration guide

How to show the EL Relationship Workspace prototype, and what it does and does not do.

> **This is a prototype.** It is not production-ready, it is not a shared or secure system, and it
> is not connected to Salesforce, Outlook, Calendly or any cloud AI. Use **fictional data only**.

## Two ways to run it

| | 1. Public demo (GitHub Pages) | 2. Local installation with local AI |
| --- | --- | --- |
| Where | https://jeojji.github.io/ivey-el-crm-prototype/ | `npm run dev` on one Mac, at http://localhost:5173/ |
| Who it's for | Anyone with the link: quick look, no setup | The person running the full demo |
| Data | Fictional sample data in that browser | Fictional data in that browser |
| AI suggestions (Add email, briefs) | **Not available.** The panels say "Not available in the online demo". Everything else works, and details are typed by hand. | Available through Ollama + `qwen2.5:7b`, running only on this computer. No cloud AI and no cloud fallback. |
| Where data is saved | The visitor's own browser (localStorage) | This browser on this Mac (localStorage) |
| Shared between people? | No. Each visitor sees only their own copy. | No. |

**Both modes save data in the browser's localStorage.** Running the app locally does not give it a
database. See [Data storage limitation](#data-storage-limitation-and-proposed-migration) below.

The public site only updates when the project is pushed to GitHub. Right now the
public site still shows the version from 2026-10-19 (Lauren's fields), from before CSV import,
applications, Add email, briefs, campaigns and feedback were added.

## Setup

### Mode 1: public demo
1. Open https://jeojji.github.io/ivey-el-crm-prototype/ in Chrome, Edge or Safari.
2. To start clean, click **Reset demo data…** at the bottom of the sidebar, then
   **Start with an empty workspace** (or **Reset to fictional demo data**).

### Mode 2: local installation with local AI
One-time steps: install Node.js (see README.md), then Ollama and the 4.68 GB model (see
SETUP-LOCAL-AI.md, "One-time installation"). Then, before each demo:

1. In VS Code, open **Terminal → New Terminal** and start Ollama (leave it running):
   ```
   OLLAMA_NO_CLOUD=1 OLLAMA_HOST=127.0.0.1:11434 ~/.local/ollama/ollama serve
   ```
2. Click **+** in the terminal panel to open a second terminal, then type:
   ```
   npm run dev
   ```
3. Open http://localhost:5173/.
4. **Warm up the model:** run one practice "Suggest details with local AI" about 5 minutes before you
   present. The first request after Ollama starts takes longer while the model loads.
5. Click **Reset demo data…** (bottom of the sidebar) → **Start with an empty workspace** →
   **Delete everything**. (Download a backup first if the browser has anything you want to keep.)
6. Click **Import & export** and download the three **Fictional demo files** (two CSVs and one
   email text file), or use them straight from the project's `public/demo/` folder.

## Demo script (about 10 minutes)

All names, emails (`.example`) and phone numbers (555-01xx) are fictional.

| # | Do this | Point out |
| --- | --- | --- |
| 1 | **Import & export** → Import **Companies** → choose `demo-accounts.csv` → **Review import** → **Import 5…**. Then click **Import contacts next** → choose `demo-contacts.csv` → **Review import** → **Import 7…**. | The preview runs before anything is saved, Lauren's template headers are mapped automatically, every contact is matched to its company, and Owen Hart arrives flagged **Do Not Contact**. |
| 2 | **Add email** → paste the text of `demo-application-email.txt` into **Original message**. Fill in Subject and Date sent. | The original email is stored exactly as pasted and can't be edited later. |
| 3 | Click **Suggest details with local AI** (about 20 s). Untick anything you disagree with, then click **Apply selected to the form**. | **AI suggestion**: each item shows the words from the email it came from, and missing details are listed as missing instead of guessed. Nothing is saved yet. |
| 4 | **Continue** → the app matches Mira Castellanos and Aster Labs that you imported → **Continue** → choose **Create a new application** (pre-filled: MBA Ivey Field Project, Winter 2027), set Stage to *Application submitted* → **Review** → **Confirm and save**. | One confirmation saves the email, the links and the application together. No duplicate company or contact is created. |
| 5 | On the application page, click **Log activity** → Meeting, subject "Scoping meeting with Mira", a date 3 days from now → **Log meeting**. Open the **Dashboard**. | The meeting shows under **Upcoming meetings**. No calendar is connected: this only records it. |
| 6 | Back on the application, click the meeting's **Edit** (pencil) → set the date to today and add notes, e.g. "Mira will share anonymized trial-usage data by November 14. Still open: who signs the data agreement." → Save. | Recording what happened. The edit is kept in the meeting's history. |
| 7 | Click **Prepare for conversation** → keep the suggested records ticked → **Generate brief and conversation prep** (about 35 s). | Two clearly separated parts. **Recorded facts** each quote the record they came from, and anything that couldn't be traced is removed. **AI suggestions** (agenda, next steps, email draft) are labelled "Review before use". Nothing is sent. |
| 8 | Under **Suggested next steps**, tick one, edit the wording (e.g. "Ask Mira who signs the data agreement"), set a due date → **Create 1 follow-up** → confirm **Create follow-ups**. | No follow-up is created until you confirm the wording and due date. Then open **Follow-ups** and the **Dashboard**, which both show it. |
| 9 | On the application, click **Record feedback** → From *Corporate partner*, the feedback text, a **Project outcome** and the **Positive feedback** flag → Save. | The original feedback text can't be edited later. Flags are set by a person, never decided by the app. |
| 10 | Open **Companies → Aster Labs**, then **Contacts → Mira Castellanos**. | The same email, meeting, application, follow-up, brief and feedback appear consistently everywhere they belong. |
| 11 | Finish on **Prototype & data** → "What works where". | Shows what works, what is an AI suggestion, and what isn't connected. |

**In the public demo (Mode 1)**, steps 3 and 7 show "Not available in the online demo". Fill in the
email details by hand in step 3, and skip step 7 (create the follow-up from **Follow-ups → Add
follow-up** instead).

**If the AI is slow or not running**, the panel says so and you can continue by hand. The demo
never depends on it.

## What is working, what is AI, what isn't connected

| Category | What's in it |
| --- | --- |
| **Working (saved in this browser)** | Companies, contacts, activity history, follow-ups, applications with Lauren's 10 stages, Add email (manual), CSV import and export, JSON backup and restore, campaigns (tracking only), feedback and flags, dashboard, demo-data reset. |
| **AI suggestions (local computer only)** | Add email suggestions and relationship briefs. These are always proposals: each one shows its source, and nothing is saved, sent or created without your confirmation. |
| **Not connected / not built** | Salesforce, Outlook or any email account, Calendly, note-taking tools, cloud AI, sending emails or sequences, login, sharing between people. |

## Data storage limitation and proposed migration

In both modes, data lives in the **browser's localStorage** on one computer:
- It isn't shared. Other people, other browsers and other computers don't see it.
- It isn't secure storage. It isn't encrypted by the app, and anyone using that browser profile can read it.
- Clearing browser data deletes it. **Import & export → Download full backup** is the only safeguard.
- Browsers limit how much it can hold (usually around 5–10 MB), which is enough for a demo but not for years of email.

**Proposed next step (separate piece of work, not built):** move the local version to a local
database.
1. Add a small local server, which the dev server already has for local AI. It would keep the data in a
   **SQLite** file on the Mac.
2. Write a `SqliteRepository` that implements the existing `DataRepository` interface
   (`src/data/repository.ts`), and switch to it in `src/data/index.ts`. The screens don't change,
   because they only talk to that interface.
3. Move existing data in using the app's own JSON backup and restore.
4. Ivey IT would need to decide on disk encryption, backups and where the file may live. A
   local database still serves one person only. Sharing with the team would need a hosted
   database, login and IT approval, which is a different project.

## Remaining dependencies

### For Lauren
- Answer the **open questions** at the end of REQUIREMENTS.md (project-type lists, referral
  Source wording, "Not an Ivey Alumnus"/EMBA, single or multi-select participation, Contact Status
  in the import template, review/deadline rules on the dashboard, Field Project spelling).
- Confirm whether this should **complement Salesforce or replace some workflows** (still undecided).
- Confirm the **Salesforce role and permissions** she would need for any future link, and which
  Salesforce fields and records are the source of truth.
- Say which **email client** (Outlook), **scheduling tool** (Calendly) and **note-taking tool**
  any future integration would need to work with, and which ones are approved for student-partner
  data.
- Decide the rules for **real contact data**: who may see it, how long it's kept, and how Do Not
  Contact is honoured across systems.
- Confirm whether a licensed **email sequence** tool exists. The prototype only tracks campaigns.

### For Ivey IT
- **Security and privacy review** before any real data is used: local AI (Ollama, model source,
  `OLLAMA_NO_CLOUD`), browser storage, device encryption and backups.
- **Approval for local AI** on staff computers, including which models are allowed and the hardware
  (16 GB memory, about 6 GB disk).
- **Integration access**, if wanted later: a Salesforce API connected app or sandbox, Microsoft 365 /
  Outlook (Graph) permissions, and a Calendly account. None of these exist in the prototype.
- **Hosting, login and a shared database** if the team (up to 7 people) needs to share one
  workspace: single sign-on, access control, audit logs and backups.
- Whether a public GitHub Pages demo of fictional data is acceptable, or the demo should move to an
  Ivey-hosted location.

## What was verified (2026-10-20)
- The whole demo script above was run end to end in an automated browser with the real local model,
  and all 19 checks passed. Extraction took 19 s and the brief 36 s on an Apple M4 with 16 GB.
- The demo files import with 0 errors, 0 warnings and 0 flagged values, and they contain no
  values from Lauren's reference files.
- Regression checks, all passing: daily-use review 17, original workflow 10, real-template import 7,
  import screens 32, import/backup logic 59, applications 29, Add email 39, campaigns and feedback 27,
  AI failure handling 20, brief safety rules 32, AI in Add email 18 and briefs 19 (real model),
  online-demo mode 6. A crawl of 17 screens found no broken links and no console errors.
- `npm run build` passes. The online-demo build serves the demo files and never calls the local AI.
- No email address, phone number, full name, street address, company name or website from Lauren's
  reference files appears in the code, the build or the demo files.
