# EL Relationship Workspace (prototype)

An interactive prototype for Ivey Experiential Learning: one place for company and contact
relationships, activity history and follow-ups. **Fictional data only. No real integrations.**
Data is saved in your browser's local storage.

## Run it on your computer
1. Install Node.js (LTS) from https://nodejs.org (one-time).
2. In VS Code, open the Terminal (menu **Terminal → New Terminal**).
3. Type `npm install` and press Enter (first time only).
4. Type `npm run dev` and press Enter.
5. Open http://localhost:5173/ in your browser.

To stop the app, click in the terminal and press `Control + C`.

See `CLAUDE.md` for the implementation plan and project rules.

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
