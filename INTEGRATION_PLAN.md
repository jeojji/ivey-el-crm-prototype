# Integration plan (discovery only)

**Status, 2026-10-24: nothing in this document is built or connected.** The prototype has no email,
Calendly, Salesforce or note-taking connection, and it must not show one as live. This is a plan for the
team, Lauren and Ivey IT to agree on before any connection work starts. The import improvements
(proposed company links and editing before import) were finished first, as requested.

Out of scope for the current build: institution-wide sharing, multi-user access and Ivey-hosted deployment.

## What was reviewed

- The team's *Possible Workflow* proposal (PDF). Paste emails first; "The system will not automatically
  read Lauren's Outlook inbox". Live Outlook, email forwarding, Salesforce and multi-user access are future
  roadmap items. "Confirm the exact AI note-taking product, available access and a practical refresh method
  before committing to live automation", and "label each connection as live, imported or simulated".
- Lauren's *Salesforce CRM Setup Request* (Word). It asks whether Salesforce is integrated with Outlook so
  emails can be logged automatically, and it describes email sequences for campaigns.
- The team's clickable prototype (HTML). It shows sample bookings and meeting notes and states that
  "Salesforce, email, Calendly and meeting-note connections are not live".
- Current public documentation for Microsoft Graph (Outlook mail), Calendly (bookings and Notetaker), and the
  main meeting-note products. The sources are listed at the end.

**Note-taking product: Calendly's built-in Notetaker** (confirmed by the project owner on 2026-10-24; the reference
files didn't name it). Sections 4 and 5 are therefore one Calendly connection: bookings plus their recaps.

## 1. What every connection needs first

**The prototype can't receive data from a connection today.** Data lives in the browser's localStorage, and a
background process can't write there. Every connection below therefore depends on the separate migration
already proposed in DEMO.md: a SQLite file behind a small local server, swapped in through
`src/data/index.ts`. The screens don't change, because they only use the `DataRepository` interface.

**One intake pipeline for every source.** This extends what "Add email" already does by hand:

1. **Receive.** A local connector process fetches new items. It runs outside the browser, like the existing
   local-AI backend, and listens only on 127.0.0.1.
2. **Preserve the original.** The raw item (email `.eml`, booking JSON, recap or transcript) is stored read-only.
   It's kept with its source system, the source's own IDs, the source timestamps, the time it was fetched,
   and a content hash. Nothing later overwrites it.
3. **Extract proposed details.** The local AI suggests fields, with evidence quotes, exactly as "Add email" does
   now. Unknown means blank. Suggested follow-ups are only suggestions.
4. **Resolve matches.** The same rules as Add email and import apply. Only an exact email address (or exact
   company name) is preselected, similar ones are suggested, and nothing is merged automatically.
5. **Human review.** Items wait in a review queue, the "Needs attention" area on Home. Clearly matched items can
   be shown as ready, but are still saved only when Lauren confirms them.
6. **Save linked records.** Use one all-or-nothing `saveBatch`, as Add email does today. Follow-up tasks are
   created only from the confirm dialog.

**Proposed data additions** (not built). These are optional fields, so no schema bump is needed:
- `activity.source` gains values such as `'graph-mail'`, `'calendly'`, `'notetaker'` (today: `'manual'`, `'email-intake'`).
- `activity.sourceRef`: `{ system, externalId, threadId?, receivedAt, fetchedAt, contentHash, rawFile }`.
- `activity.meetingStatus` for bookings: `scheduled | canceled | rescheduled`, plus `replacedBy` / `replaces` ids.
- An `inbox` collection of received items waiting for review, each with its proposals and match status.
- On Home, the "data freshness" line the workflow proposal asks for: last successful fetch per source, and failures.

**Polling or webhooks?**

| | Local polling process | Webhook backend |
| --- | --- | --- |
| What it is | Lauren's computer asks the service for changes every few minutes | The service calls a URL when something changes |
| Needs a public, internet-reachable HTTPS address | No | **Yes** |
| Works when the computer is off or asleep | No. It catches up when it wakes (delta/"since" queries) | Yes, but it needs an always-on server to receive the calls |
| Fits the single-computer plan | Yes | No: it is the "shared server phase" (hosting, authentication, an owner) |

**Recommendation for the current phase: local polling only.** Webhooks belong to a later, IT-approved server phase.

**Credentials.** Access tokens and client secrets are never put in browser code, in this repository, or in
GitHub Actions for the public demo. A local connector would keep them in the macOS Keychain, or in an
environment file outside the project folder that Git ignores. It should use the narrowest permission
available and log no message content. Each connection is labelled on screen as live, imported or simulated.

## 2. Forwarded application-form emails

**What the app supports now.**
- In **Add email**, paste an email, mark it as forwarded, and enter the original sender.
- Local AI suggests the company, contact, project, type, term and missing information, each with evidence.
- Matches are resolved, an exact address is preselected, and duplicates are checked by a content fingerprint.
- The email, any new contact or company, and a new application are saved together after confirmation.

**Not supported yet:**
- receiving emails automatically
- keeping the raw `.eml` file
- extracting suggested follow-ups from an email

**Proposed flow:** receive → preserve original → extract proposed details → resolve matches → human review →
save linked records.
- Form notifications go to one dedicated mailbox, for example a shared "EL intake" mailbox, either directly or
  by a forwarding rule.
- The connector reads only that mailbox.
- The original message is downloaded as MIME (`.eml`) and kept read-only. The form's own submission ID, if the
  email contains one, is recorded as well.
- The AI may propose a new application at **"Application submitted"** only.
  - **It never moves an application to "Project Approved" or any later stage.** Stage changes stay manual.
  - Approval wording in an email is shown as a quote for Lauren to act on.
- Suggested follow-ups (for example "ask for expected deliverables") appear as tickable suggestions with
  editable wording and due dates. They become tasks only after confirmation, as in conversation prep today.

**Access and permissions (for Ivey IT).**
- A Microsoft Entra app registration with the Microsoft Graph **Mail.Read** permission, which needs admin consent.
  Mail.ReadBasic is too little, because the body is needed.
- Scope the app to the single intake mailbox with Exchange Online **RBAC for Applications**. This replaces the
  older Application Access Policies, so the app cannot read any other mailbox.
- Alternative: delegated Mail.Read while Lauren is signed in. It's simpler, but it can read her whole mailbox,
  so a dedicated mailbox is preferred.
- If the form tool (not yet identified) offers an export or API, reading the structured submission directly is
  more reliable than parsing emails. Confirm which form product is used.

**Polling or webhook.**
- Polling: Graph **delta query** on the intake folder returns only new or changed messages since the last run.
  It needs no public address.
- Webhook: a Graph change-notification subscription needs a public HTTPS `notificationUrl` and regular renewal,
  so it belongs to the server phase.

**Matching and duplicates.**
- Store the Graph message `id` and the `internetMessageId`. The same message is never imported twice, even if it
  is fetched again or also pasted by hand.
- Keep the existing content fingerprint for manual pastes.
- The partner is the original sender or the form's contact field, never the forwarder (the existing rule).
- Exact email match → contact. Company → the same exact/similar rules as import. Uncertain → review queue.

**Preserving originals.**
- Keep the raw MIME file, plus `sentDateTime`, `receivedDateTime` and the time it was fetched.
- Lauren's notes stay separate from the original (the existing rule), and corrections go into the edit history.

**What can be demonstrated with synthetic data now.**
- Paste the fictional `public/demo/demo-application-email.txt` into Add email (already in the demo script).
- After the database migration: an "Import email file (.eml)" action for fictional `.eml` files. It would be
  labelled *Imported file*, not *Live*, and would exercise steps 2–6 with no mailbox access.

**Not yet verified.**
- Which form product is used, and what its notifications look like.
- Whether forwarding keeps the original headers.
- Whether Ivey IT will approve an app registration, a dedicated mailbox and RBAC scoping.
- Retention rules for stored copies.

## 3. Outgoing email captured through BCC

**What the app supports now.** Add email with direction *Sent by the EL office*: the first address in "To" is
used to find the partner contact. It's manual only.

**Proposed flow.**
- Lauren adds a dedicated capture address, for example a shared "EL log" mailbox, in **BCC** on emails she
  wants logged.
- The capture mailbox receives a copy. The connector:
  1. treats a message whose From is Lauren's address as outgoing;
  2. matches the To/Cc addresses to contacts;
  3. preserves the original;
  4. proposes links;
  5. queues it for review.
- The BCC address does not appear to the recipients.
- Only emails Lauren chooses to BCC are captured, which limits collection to what she intends to log.
- Alternative: read Lauren's **Sent Items** folder with delegated Mail.Read. No BCC is needed, but that means
  access to her whole mailbox and the risk of collecting unrelated mail. Not recommended for the first version.

**Access and permissions.** The same as section 2: Mail.Read scoped to the capture mailbox with RBAC for
Applications, plus admin consent. Ivey IT must confirm that BCC to the mailbox isn't blocked or rewritten by
transport rules.

**Polling or webhook.** A local delta-query poll of the capture mailbox. No public address is needed.

**Matching and duplicates.**
- `internetMessageId` is shared by Lauren's sent copy and the BCC copy, so the same email is logged once even
  if both routes, or a manual paste, are used.
- Several recipients: link the primary matched contact and list the others.
- Unknown recipients go to the review queue, never to an automatically created contact.
- A Do Not Contact recipient raises a visible warning, using the existing flag.

**Preserving originals.** Keep the raw MIME file, `sentDateTime`, the time it was fetched, and the source IDs.
The message is stored as sent, and never edited.

**Synthetic demonstration.**
- Now: paste a fictional sent email into Add email.
- After the migration: import fictional `.eml` files labelled *Imported file*.

**Not yet verified.**
- Exchange transport and journaling rules at Ivey.
- Whether internal-only emails should be excluded.
- How replies are captured. A partner's reply arrives in Lauren's inbox, not the capture mailbox, unless it is
  forwarded or section 2's mailbox is also used.

## 4. Calendly bookings, cancellations and rescheduling

**What the app supports now.**
- **Add → Schedule meeting** records a future meeting, which shows under Upcoming meetings.
- **Add meeting notes** records what happened.
- There is no booking status (canceled or rescheduled) and no Calendly ID.

**What Calendly's API provides (checked 2026-10-24).**
- Webhook subscriptions are available on **Standard, Professional, Teams and Enterprise** plans.
- The events are `invitee.created` and `invitee.canceled`, scoped to a user or an organization.
- A **reschedule fires both**:
  - `invitee.canceled` for the old event, with `rescheduled: true`;
  - `invitee.created` for the new event.
- The new invitee's `old_invitee` points to the original invitee. The link is on the invitee, not the event.
  The scheduled-events list returns both events with no event-level link.
- Authentication is a Personal Access Token or OAuth.
- Polling alternative: list scheduled events (and their invitees) since the last check. This needs no public address.

**The booking API does not provide AI meeting notes.** Calendly's notes come from a **separate Notetaker API**
(released 2026-07-22): `/meeting_recaps`, with `summary_md`, `action_items_md`, `discussion_md` and a transcript.
- It needs the `meeting_recaps:read` scope and a paid plan.
- Its webhooks are `meeting_recap.created/updated/deleted`.
- A recap carries a nullable `event` reference to the scheduled event.

Lauren uses Calendly Notetaker, so this is the meeting-notes source (section 5).

**Proposed flow.**
- Booking created → a proposed *scheduled* meeting:
  - linked by the invitee's exact email to a contact;
  - linked to the company through the contact;
  - linked to an application only if a booking question names it and Lauren confirms.
- Canceled (`rescheduled: false`) → the meeting is marked *canceled*. It stays in the history but leaves
  Upcoming meetings. Nothing is deleted.
- Rescheduled → the old meeting is marked *rescheduled* and linked to the new one through `old_invitee`.
  Lauren's agenda notes are carried over only if she confirms.
- Bookings from unknown emails go to the review queue. They never create contacts automatically.

**Access and permissions.**
- The plan Lauren's Calendly account is on: webhooks need Standard or higher; polling with the API is still
  possible otherwise.
- A Personal Access Token, or an OAuth app, created by the account owner and kept in the Keychain.
- If Ivey uses a Calendly organization, the admin decides user vs organization scope.

**Polling or webhook.** Polling the scheduled-events endpoint locally works now. Webhooks need a public HTTPS
endpoint (server phase).

**Matching and duplicates.**
- Store the Calendly **event URI** and **invitee URI** on the meeting.
- The same invitee URI is never imported twice.
- Reschedules are chained through `old_invitee`.
- A manually scheduled meeting at the same time with the same contact is flagged as a possible duplicate,
  not merged.

**Preserving originals.** Keep the raw booking JSON with Calendly's timestamps (created, start and end in UTC,
canceled at), the cancellation reason if provided, and the fetch time.

**Synthetic demonstration.** Fictional booking, cancel and reschedule payloads (written from the documented
payload shapes) as test fixtures for the matching and status logic. In the app, at most an "Import booking
file" labelled *Simulated sample*, never a "Connected" badge.

**Not yet verified.**
- Lauren's Calendly plan and whether she belongs to an Ivey organization.
- Rate limits.
- Which booking questions exist.
- Whether Ivey permits API tokens for Calendly.

## 5. Meeting notes: Calendly Notetaker

**Confirmed product: Calendly's built-in Notetaker.** It records Zoom, Google Meet and Microsoft Teams calls and
produces a recap: summary, action items, discussion notes and a transcript.

**What the app supports now.** Paste a recap into **Add meeting notes**. It becomes the meeting's details,
and conversation prep can use it with source quotes. Nothing is fetched from Calendly.

**What the Notetaker API provides (checked 2026-10-24).**
- Endpoints: `GET /meeting_recaps` (filters: event, user, organization, attendee, start-time range),
  `GET /meeting_recaps/{uuid}`, `GET /meeting_recaps/{uuid}/transcript`.
- A recap has `summary_md`, `action_items_md` and `discussion_md`, attendees (name, email, host), start and end
  times, `created_at` and `updated_at`, a `status` (Available / Processing / Unavailable), and a nullable `event`
  that references the Calendly scheduled event.
- Recaps also exist for meetings that weren't booked through Calendly. Those have no `event` link.
- It needs the `meeting_recaps:read` scope and a paid Calendly plan.
- Webhooks: `meeting_recap.created`, `meeting_recap.updated` (only when the highlights change) and
  `meeting_recap.deleted`.
- The app only needs to read. `meeting_recaps:write` (edit or delete recaps) is never requested.

**Proposed flow.**
- The recap is stored as a **source document attached to the meeting**, word for word, separate from Lauren's own notes.
  - It keeps the recap URI, its status, Calendly's timestamps and the time it was fetched.
  - The transcript is fetched only if Lauren wants it kept, because it includes other people's speech.
- A recap is linked to its meeting by the `event` reference, matched against the Calendly event URI that the
  booking connection (section 4) stored on that meeting. That is a hard link, not a guess.
- A recap with no `event` (an external meeting) is matched by attendee emails and time window, then sent to
  the review queue.
- The recap's action items become **suggested** follow-ups, with editable wording and due dates. They become
  tasks only after Lauren confirms. Commitments count as recorded only when quoted (the existing brief rule).
- An updated recap becomes a new version, keeping the earlier one.
- A recap deleted in Calendly is marked as deleted at the source. The copy Lauren already confirmed stays,
  unless she deletes it herself.
- A recap still *Processing* is checked again later. It's never saved half-finished.

**Access and permissions.**
- The same Calendly connection as section 4, with the extra `meeting_recaps:read` permission.
- Lauren's plan must be a paid one.
- Ivey's rules on meeting recording, consent and transcript retention apply.

**Polling or webhook.** Locally poll `GET /meeting_recaps` for recaps since the last check (no public address).
Notetaker webhooks would need the server phase.

**Duplicates.** The recap URI is the key: the same recap is never imported twice, and updates add versions.

**Synthetic demonstration.**
- Now: paste a fictional recap into Add meeting notes.
- After the database migration: import a fictional recap file, written from the documented fields and labelled
  *Imported file* or *Simulated sample*, never *Connected*.

**Not yet verified.**
- Lauren's Calendly plan.
- Whether her recaps are in a personal account or an Ivey organization.
- Whether Ivey allows API tokens for Calendly.
- Rate limits.
- How often recaps come with no `event` link.
- How Calendly's recap sharing settings interact with API access.

## 6. Summary

| Connection | Access needed | Polling (local) | Webhook (server) | Duplicate key | Synthetic demo now | Main blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Application-form emails | Mail.Read on one intake mailbox (admin consent, RBAC scoped) | Graph delta | Graph subscriptions | internetMessageId, form ID | Paste demo email | IT approval; form product |
| Outgoing via BCC | Mail.Read on one capture mailbox | Graph delta | Graph subscriptions | internetMessageId | Paste a sent email | IT approval; transport rules |
| Calendly bookings | Calendly token (account owner) | Scheduled events list | Standard plan or higher + public URL | Event and invitee URIs | None yet: proposal only | Plan; token approval |
| Calendly Notetaker recaps | Same token + `meeting_recaps:read`, paid plan | `GET /meeting_recaps` | Notetaker webhooks + public URL | Recap URI (linked by event URI) | Paste a recap | Plan; token approval; recording rules |

## 7. Suggested order

1. ✅ Import usability: proposed company links and editing before import (done 2026-10-24).
2. Local database migration (SQLite behind a local server). Needed before anything can arrive in the background.
3. Inbox and review queue, with **file import** of fictional `.eml`, booking JSON and summary files.
   This proves preservation, matching, duplicate checks and review with no external access.
4. Application-form mailbox polling, after Ivey IT approves the app registration and mailbox scope.
5. Calendly polling (bookings, then Notetaker recaps linked by event), after the plan and token are confirmed.
6. Transcripts, only if Lauren wants them kept and Ivey's retention rules allow it.
7. Webhooks and shared access only in a later server phase, with hosting, authentication and an owner.

## 8. Decisions needed

**From Lauren:**
- Which application form tool is used.
- Whether she is willing to BCC a capture address.
- Her Calendly plan and organization (Notetaker's API needs a paid plan), and whether transcripts should be kept or only recaps.
- Whether bookings should go to the review queue or straight to the timeline when the match is exact.

**From Ivey IT:**
- Approval for an Entra app registration with Mail.Read scoped by RBAC for Applications to dedicated mailboxes.
- Creating those mailboxes.
- Rules for storing raw emails, transcripts and tokens on one computer: Keychain, disk encryption, backups.
- Recording consent and retention for Calendly Notetaker recaps and transcripts.

**From the team:** the read/write boundary with Salesforce, which is still undecided (see CLAUDE.md).

## Sources (checked 2026-10-24)

- Calendly: [Webhooks overview](https://calendly.com/help/webhooks-overview) ·
  [Webhook payloads for rescheduled events](https://developer.calendly.com/docs/api-guides/see-how-webhook-payloads-change-when-invitees-reschedule-events) ·
  [Community: rescheduled events in the API](https://community.calendly.com/api-webhook-help-61/calendly-api-returns-duplicate-events-for-rescheduled-events-2191) ·
  [Release notes 2026-07-22 (Notetaker API)](https://developer.calendly.com/release-notes/2026/7/22) ·
  [Get Recap](https://developer.calendly.com/api-docs/calendly-api/notetaker/get-meeting-recaps-uuid-recap) ·
  [Notetaker overview](https://calendly.com/help/notetaker-overview)
- Microsoft: [Outlook change notifications](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview) ·
  [mailFolder delta](https://learn.microsoft.com/en-us/graph/api/mailfolder-delta) ·
  [Change notifications API](https://learn.microsoft.com/graph/api/resources/webhooks) ·
  [RBAC for Applications in Exchange Online](https://learn.microsoft.com/Exchange/permissions-exo/application-rbac)
