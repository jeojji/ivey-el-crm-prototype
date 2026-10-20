# Local AI setup (optional)

"Add email" can **suggest** details from a pasted email: company, contact, project need, project
type, academic term and missing information. It uses an AI model that runs **entirely on this
computer** through [Ollama](https://ollama.com). Emails are never sent to a cloud AI service, and
there is no cloud fallback. If the local model isn't running, the form simply works by hand.

Everything the AI suggests is a proposal. Each suggestion shows the excerpt of the email it came
from, can be edited or ignored, and nothing is saved until you confirm on the Review step.

The online demo (GitHub Pages) never uses AI. It shows "Not available in the online demo".

## What this computer needs

| | Recommended | This project was tested on |
| --- | --- | --- |
| Computer | Mac with Apple Silicon (M1 or newer) | Apple M4, 16 GB memory, macOS 26.4 |
| Memory | 16 GB (the model uses about 6 GB while answering) | |
| Free disk space | about 6 GB | |
| Runtime | Ollama, command-line version (174 MB download) | Ollama 0.40.6 |
| Model | `qwen2.5:7b` (4.68 GB download) | qwen2.5:7b |

## One-time installation

These steps were already done on the project owner's Mac. Repeat them on any other computer.

1. **Install Ollama (174 MB).** In VS Code, open **Terminal → New Terminal** and paste:
   ```
   mkdir -p ~/.local/ollama && curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-darwin.tgz | tar -xz -C ~/.local/ollama
   ```
   This puts Ollama in a hidden folder in your home directory. No admin password is needed.
   (Alternatively, install the Ollama app from ollama.com.)
2. **Start Ollama** (keep this terminal open). This command makes it listen only on this
   computer and switches off Ollama's own cloud features:
   ```
   OLLAMA_NO_CLOUD=1 OLLAMA_HOST=127.0.0.1:11434 ~/.local/ollama/ollama serve
   ```
   Its first lines should include `Ollama cloud disabled: true`.
3. **Download the model (4.68 GB, one time).** Open a *second* terminal (the **+** button in the
   terminal panel) and paste:
   ```
   OLLAMA_HOST=127.0.0.1:11434 ~/.local/ollama/ollama pull qwen2.5:7b
   ```
   Wait for `success`. (Downloading the model is the only step that needs the internet.)

## Every time you want to use it

1. Terminal 1: start Ollama (step 2 above), if it isn't already running.
2. Terminal 2: in this project folder, run `npm run dev`.
3. Open http://localhost:5173/, then **Add email**. Paste an email and click
   **Suggest details with local AI**.
   - The first suggestion after starting can take 20–60 seconds while the model loads. Later ones are faster.
   - Tick the suggestions you want, correct any of them, then click **Apply selected to the form**.

The panel tells you if Ollama isn't running or the model isn't downloaded, and you can always
continue by hand.

## Check that it works without internet

1. Start Ollama and `npm run dev` as above, and open Add email.
2. Turn off Wi-Fi: click the Wi-Fi icon in the menu bar at the top right of the screen, then switch Wi-Fi off.
3. Paste an email and click **Suggest details with local AI**. Suggestions still appear.
4. Turn Wi-Fi back on.

## Settings (advanced, optional)

Set these before `npm run dev`, e.g. `LOCAL_AI_TIMEOUT_MS=180000 npm run dev`.

| Variable | Default | Notes |
| --- | --- | --- |
| `LOCAL_AI_MODEL` | `qwen2.5:7b` | Must already be pulled. Names ending in `cloud`, or models Ollama serves from a remote host, are refused. |
| `LOCAL_AI_TIMEOUT_MS` | `120000` | How long to wait for an answer before giving up. |
| `LOCAL_AI_OLLAMA_URL` | `http://127.0.0.1:11434` | Must be this computer (127.0.0.1 / localhost). Anything else stops the app from starting. |

## Remove it

Delete the model and Ollama: stop Ollama (Control + C in its terminal), then run
`rm -rf ~/.ollama ~/.local/ollama`. The CRM keeps working without AI.

## How it protects your data (summary)

- The browser only talks to this app's own local backend (`/local-ai/…`, part of `npm run dev`).
  The backend only talks to Ollama on `127.0.0.1`. It only accepts requests from this computer, from
  the app's own page.
- The email is sent to the model as **data inside a delimited block**, with instructions to never
  follow anything written in it. Text that looks like instructions to an AI ("ignore previous
  instructions…", "Note to CRM system…") is also detected separately, shown to you, and nothing
  taken from it is kept.
- Every suggested value needs a **supporting quote that really appears in the email**. Names,
  email addresses and company names must appear in the email word for word. Project type and term
  must be valid options, and the year must be stated. Anything else is blanked, and the panel
  explains why.
- The answer is checked twice: in the backend and again in the browser.
- AI never saves anything. You still choose or create records, review, and confirm. The saved email
  records which fields came from AI suggestions.

## Measured accuracy and speed (2026-10-20)

Tested on 14 synthetic, fictional emails covering clear requests, forwarded messages, missing details,
ambiguous companies (parent company, former employer, company only in an email domain), a sent
email, a reply chain, and **three emails with hidden instructions aimed at an AI**. Model qwen2.5:7b
on the Apple M4 / 16 GB Mac, through the app's own backend (the same path the app uses).

| Measure | Result |
| --- | --- |
| Requests completed | 14 / 14 |
| Checks correct (all fields + safety checks) | **151 / 154 (98.1%)** |
| Emails with every check correct | 11 / 14 |
| Company · project type · term · year · forwarded detection | 14/14 · 13/13 · 14/14 · 14/14 · 14/14 |
| Contact name · email · job title | 13/14 · 7/7 · 5/5 |
| Project need covers the key facts | 12 / 13 |
| Hidden instructions: nothing taken from them / flagged to you | 12 / 12 / 3 of 3 |
| Every suggested value had a supporting excerpt | 14 / 14 |
| First answer after starting (model loading) | 23.7 s |
| Later answers: typical (median) / 90% within / slowest | 17.3 s / 20.7 s / 20.9 s |

The three misses: a forwarded email's project need was summarised too loosely; for a vague email,
"company" wasn't listed as missing; and for a *sent* email, the full name of the recipient wasn't
proposed, because the body only says "Hi Grace" (the full name is already in the To field you type).

**When the computer is busy, it's slower.** In one run, with macOS background tasks and memory
swapping, answers took 30–100 s. Ollama also answers one request at a time, so overlapping requests
queue up. The 120-second timeout then shows a clear message, and you can retry or continue by hand.

**Verified without internet.** Ollama and the app's backend were run inside a macOS sandbox that
blocks all internet access (only this computer reachable). Internet access was confirmed blocked,
and extraction still worked, with the same results. During normal runs, Ollama and the app
connected only to this computer (127.0.0.1). A connection to Ollama's download server was seen once,
left over from downloading the model. Starting Ollama with `OLLAMA_NO_CLOUD=1` (as above) switches
off its cloud features.

## Relationship briefs and conversation prep

**Conversation prep** (sidebar, or "Prepare for conversation" on a company, contact or application)
uses the same local model. Choose the company, contact, application and the saved communications
to use. The page shows exactly which records the model will read (S1, S2, …). The brief then shows:

- **Recorded facts** (summary, recorded commitments, outstanding questions): each statement links
  to the record it came from, with the exact words quoted. The app checks every quote against that
  record and removes statements it can't trace. Commitments need commitment wording in the record
  ("will", "agreed", "can host"…). Approval needs approval wording (e.g. "Stage: Project Approved").
  Anything worded more strongly than the record is removed.
- **Not found in the selected records**: what's missing, so you know what to ask.
- **AI suggestions** (meeting objective, next steps, opening script, talking points, follow-up
  email): shown separately and labelled "Review before use". They're checked for money amounts or
  claimed agreements that no record supports (removed), and for years or institution names not in
  the records (flagged "Check…").
- Suggested next steps become follow-ups **only** after you tick them, edit the wording, set a due
  date and confirm. Drafts are editable and can be copied. Nothing is ever sent.
- Each brief records when it was generated and the version of every record used. If a record is
  later edited or deleted, the brief and the company card say **"may be outdated"**.
- Lines in a record that look like instructions to an AI are **removed before the model reads it**.
  Your original stays unchanged, and the brief tells you which record contained them.

### Measured on 5 fictional scenarios (2026-10-20)

Scenarios: a rich case with commitments and an open question; a thin case ("Thanks for the call");
"hoping it gets approved, nothing confirmed yet"; a hidden instruction to record a $50,000
sponsorship; and a team size changed in a later email.

| Measure | Result (final run) |
| --- | --- |
| Safety checks: no invented commitments or approvals, nothing from the hidden instruction, nothing invented for the thin case, no invented institutions | **all passed** (also in the two runs before) |
| Kept quotes independently re-checked against their records | 8 / 8 (100%) |
| Model citations correct before filtering | 10 / 12 (83%) |
| Expected facts found | 4 / 7. See limitations: the checks favour leaving things out over overstating. |
| Missing information for the thin case | 6 relevant items, nothing invented |
| Time per brief | typical 27 s, longest 37 s |

## Limitations

- **It's a small local model and it makes mistakes.** It can miss details, mis-classify a project
  type, or summarise loosely. Always check the suggestions against the quotes shown.
- It only suggests what the email states. It won't infer a company from an email domain, or a year
  from "next January", so those stay blank by design.
- Prompt-injection protection reduces risk but isn't perfect. A cleverly worded email could still
  influence the model's wording. That's why every value must be quoted from the email, and you confirm everything.
- The instruction detector is deliberately cautious and may flag harmless phrases (e.g. "please
  ignore my previous email"). Flagged text is shown to you, not hidden.
- Very long emails: only the first 12,000 characters are read (the panel says so).
- Speed depends on the computer: about 15–25 s per email on the tested Mac, more when it's busy. The first answer after starting is slower while the model loads.
- For emails *sent* by the office, the partner's details often only appear in the To field you typed,
  so fewer suggestions are made. The tool is mainly useful for received emails.
- Small models occasionally repeat themselves. The app limits answer length, so this ends in a
  "try again" message rather than a hang.
- Running locally keeps emails off cloud AI services, but it doesn't make the whole computer secure.
  Device access, disk encryption and backups still matter (see the Possible Workflow PDF).
- Not available in the GitHub Pages demo, on phones, or on computers without Ollama.
- **Briefs may leave out real facts.** The model sometimes files a fact in the wrong section, or
  words it more strongly than the record (e.g. "has agreed to host" for "we can host"). The checks then
  remove it. A brief therefore says less rather than overstate. Always skim the sources too.
- Briefs read at most 16 records and about 24,000 characters. Older communications are left out
  first (the prep page warns you), and very long emails are shortened.
- Suggestions can still contain ordinary mistakes (tone, emphasis, a wrong assumption) that no
  automatic check catches. They're drafts for you to edit.
