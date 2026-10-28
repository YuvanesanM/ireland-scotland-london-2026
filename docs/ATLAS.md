# ATLAS — how it fits together

A static site (`index.html` + `atlas/`) served by GitHub Pages at travel.ryst.in.
There is no build step, no server code and no environment variables in this repo.

## Files

| File | What it does |
|---|---|
| `index.html` | Trip dashboards (itinerary day cards, hotels, flights, kid tips) and the Google sign-in gate |
| `atlas/atlas.js` | App shell: router, globe, overview, documents, wallet, passports, Supabase sync |
| `atlas/engine.js` | **ATLAS Intelligence** — pure functions (no DOM): insights, booking calendar, reminder presets, grounded answers, time-zone maths |
| `atlas/atlas.css` | ATLAS design system |
| `tests/engine.test.js` | Unit tests for the engine — `npm test` (Node 18+, no dependencies) |

## External services

| Service | Used for | Configuration |
|---|---|---|
| Google Identity Services | Sign-in; only the two family accounts are allowed | OAuth client `717827758789-…` (Google Cloud Console) |
| Supabase project **Studio RYST** (`rtkshjedyaqwwmfcaufk`, ap-south-1 / Mumbai) | Private data in the `atlas` schema + private bucket `atlas-docs` | Authentication → Google provider enabled with the client ID above · Data API → `atlas` in *Exposed schemas* |
| Wikimedia Commons | Destination photos (self-hosted copies in `img/`, credited in the app) | — |

The browser holds only the Supabase **publishable** key; every table is protected
by row-level security (`atlas.is_member()` = the signed-in Google email is in
`atlas.allowed_users`). Anonymous requests are refused at the schema.

## Data model (`atlas` schema)

- `trips` — dates, intended party (`adults`, `children`)
- `trip_stops` — destinations with dates and IANA time zone (`tz`)
- `booking_items` — one row per flight / hotel / ticket / document:
  `kind` (type), `done` + `needs_review` (status), `opens_on` + `opens_time` + `opens_before`
  (reservation window and the vendor rule it comes from; `rule = 'reco'` marks an ATLAS
  estimate), `cancel_by`, `url`, `adults` / `children` (party on the booking),
  `reference`, `trip_id` + `stop_seq` (trip and destination), `verified_at` / `verified_by`
- `travellers` — passports (family only, read-only from the browser)
- `attachments` + storage bucket `atlas-docs` — confirmation files
- `reminders` — reminders created in the app

Members can only change: `done`, `needs_review`, `reference`, `verified_at`,
attachments and reminders. Everything else is edited in the Supabase table editor.

## ATLAS Intelligence

`engine.js` builds insights from the real data and never modifies it. Each insight
has a priority (urgent / upcoming / confirmed) and a provenance label:
**Verified** (confirmation or booking marked done), **Vendor rule** (published
release rule, not re-checked), **Estimate** (ATLAS's buffer), **ATLAS check**
(computed validation). Checks include occupancy vs. family, hotel coverage of every
night, itinerary coverage of every day, activities outside their destination
dates, release dates that disagree with their own rule, open / upcoming windows,
cancellation deadlines, documents and passports.

"Ask ATLAS" answers five questions deterministically from the same data and lists
what it can't determine. No AI model is connected.

## Reminders — what is and isn't connected

Today a reminder is (1) saved in `atlas.reminders` and (2) downloaded as a calendar
file (`.ics`) whose alarm the phone/computer calendar delivers. ATLAS does **not**
send notifications itself.

To add email or push delivery later:
1. A Supabase Edge Function that selects `atlas.reminders` where
   `status = 'scheduled' and remind_at <= now()` and sends them (e.g. email via
   Resend, or Web Push), then sets `status = 'delivered'`, `delivered_at = now()`.
2. A schedule for it (Supabase Cron / `pg_cron`, every 5–15 minutes).
3. Secrets for the sender (e.g. `RESEND_API_KEY` or VAPID keys) stored as
   Edge Function secrets — never in this repo.
The `channel` column (`calendar` / `email` / `push`) is already in place.
