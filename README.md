# EL Relationship Workspace (prototype)

An interactive prototype for Ivey Experiential Learning: one place for company and contact
relationships, activity history and follow-ups. **Fictional data only. No real integrations.**
Data is saved in your browser's local storage.

**Just want to look?** Open the online demo: https://jeojji.github.io/ivey-el-crm-prototype/
(no installation; the local-AI features are switched off there).

## Run it on your computer
1. Install Node.js (the LTS version, 20 or newer) from https://nodejs.org, and Git from https://git-scm.com (one-time).
2. Get the code, in either of these ways:
   - **To work on it (recommended):** in VS Code, open the Terminal (menu **Terminal → New Terminal**) and type
     `git clone https://github.com/jeojji/ivey-el-crm-prototype.git`, then `cd ivey-el-crm-prototype`.
   - **Just to try it:** on the GitHub page, click the green **Code** button → **Download ZIP**, unzip it,
     and open the folder in VS Code (**File → Open Folder…**).
3. In the VS Code Terminal, type `npm install` and press Enter (first time only, takes a minute).
4. Type `npm run dev` and press Enter.
5. Open http://localhost:5173/ in your browser. It starts with fictional sample data.

To stop the app, click in the terminal and press `Control + C`.

Each person's data lives in their own browser, so nothing you add is seen by teammates. To reset, use
**Reset demo data…** at the bottom of the sidebar. To try importing, download the fictional demo files from
**Import & export**.

## Working on it together

- **Never use real people's data.** Only fictional data (`.example` email addresses, `555-01xx` phone numbers).
  Lauren's real files are deliberately **not** in this repository and must never be added.
- **Every push to `main` immediately updates the public demo site.** So work on a branch and merge through a
  pull request:
  1. Get the latest version: `git checkout main`, then `git pull`.
  2. Start a branch for your change: `git checkout -b your-name/short-description`.
  3. Make and test your change (`npm run dev`), then check it builds: `npm run build`.
  4. Save and upload it: `git add -A`, `git commit -m "What you changed"`, `git push -u origin your-name/short-description`.
  5. On GitHub, click **Compare & pull request**, describe the change, and ask a teammate to review before merging.
- To push branches, you need to be added as a collaborator on the repository (ask Sally / `jeojji`).
- `CLAUDE.md` has the project rules, the data model and how the code is organized. Read it before changing
  imports, the AI features or how data is stored. `REQUIREMENTS.md` explains how Lauren's fields map to the app.
- The optional local AI (`SETUP-LOCAL-AI.md`) was set up and tested on a Mac. Everything else works on
  Mac and Windows.

## Showing it to someone

See `DEMO.md`. It has a 10-minute demo script, the two ways to run it (public GitHub Pages demo or
local installation with local AI), fictional demo files to import, and the remaining
dependencies for Lauren and Ivey IT.

**Prototype only.** Data is kept in one browser's local storage. It isn't shared, it isn't stored
securely, and it isn't connected to Salesforce, Outlook, Calendly or any cloud AI.

## Optional: local AI suggestions in "Add email"

See `SETUP-LOCAL-AI.md`. It runs a model on this computer with Ollama, never a cloud AI. The app
works fully without it.

## Integrations

None are connected. `INTEGRATION_PLAN.md` describes how email, Calendly and meeting-note connections could
work later, what access they would need, and what is still unverified.
