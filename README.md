# Wits CSD — Events & Engagement Platform

A production-grade events, registration and student-engagement platform for the **Centre for Student Development (CSD)** at the University of the Witwatersrand.

It handles the full lifecycle of an event: publishing it, letting students register, generating a personalised QR-coded attendee badge and emailing it, running QR check-in on the day, collecting anonymous feedback, gathering pledges, streaming a live reflections wall, and producing analytical PDF reports for administrators.

What makes it interesting is not just the feature set but **how it is built**: a cache-first Next.js front end, Supabase as the system of record, and a dedicated Redis-backed worker process that keeps CPU-heavy PDF generation off the web event loop so the site stays fast when thousands of people arrive at once.

---

## Table of contents

1. [Feature overview](#feature-overview)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [Request lifecycle](#request-lifecycle)
5. [Data model](#data-model)
6. [Authentication & roles](#authentication--roles)
7. [Event lifecycle & visibility](#event-lifecycle--visibility)
8. [Registration & the attendee badge pipeline](#registration--the-attendee-badge-pipeline)
9. [Pledges](#pledges)
10. [Reflections wall (polling) + Present view](#reflections-wall-polling--present-view)
11. [Announcements & Web Push](#announcements--web-push)
12. [Feedback (anonymous)](#feedback-anonymous)
13. [Attendance, QR check-in & the support team portal](#attendance-qr-check-in--the-support-team-portal)
14. [Speakers, programme & featured moments](#speakers-programme--featured-moments)
15. [Reports](#reports)
16. [Caching & performance strategy](#caching--performance-strategy)
17. [Progressive Web App](#progressive-web-app)
18. [Design system](#design-system)
19. [Repository structure](#repository-structure)
20. [Environment variables](#environment-variables)
21. [Local development](#local-development)
22. [Database setup & migrations](#database-setup--migrations)
23. [Deployment](#deployment)
24. [Operations & monitoring](#operations--monitoring)
25. [Troubleshooting](#troubleshooting)
26. [Security notes](#security-notes)

---

## Feature overview

### For attendees (students, staff, guests)
- **Email OTP sign-in** — no passwords. Enter your email, receive a one-time code, done.
- **Frictionless onboarding** — a short, animated, question-by-question profile builder. Students also answer **place of residence** and (if they live in a Wits residence) which one; gender includes Male / Female / Non-binary / Other. Guests and guest speakers skip the academic section.
- **Browse events** — a searchable explorer, a featured event, and an "upcoming" strip. A site-wide **top banner** advertises the latest event with a live countdown and a Register link (it hides automatically once you've registered).
- **Rich event pages** — a full-bleed **cover hero** with a deep-blue overlay carrying the title, theme, dates and venue; a **side-notch menu** (About · Programme · Speakers · Featured) that opens animated full-colour panels; a **featured moments** slider; speakers with inline "Read more"; and a login-locked agenda.
- **One-tap registration** — choose Student / Staff / Guest / Guest Speaker; a personalised QR **attendee badge** PDF is generated and emailed, and is re-downloadable from your dashboard.
- **Actions** — once registered, quick access to Reflections, Pledge and Feedback (a compact Actions row on mobile).
- **Pledges** — take a pledge and receive an official PDF certificate by email.
- **Anonymous feedback** — a clean, multi-step flow; responses are not linked to any individual.
- **Reflections wall** — a sticky-note wall kept fresh by **near-real-time polling**; your own note appears instantly.
- **Announcement notifications** — opt in to **browser push** and receive admin announcements as real notifications, even when the tab is closed.
- **Install as an app** — a Progressive Web App (PWA) with a dedicated app shell (dashboard-first, bottom navigation).

### For the support team (formerly "volunteers")
- **Support Team Portal** — a focused, mobile-first portal with two tools: **Scanner** and **History**.
- **QR check-in** — open the camera, point it at an attendee's badge, and check them in. The scanner validates that the person is registered and confirmed, and **prevents duplicate check-ins on the same day**.
- **History** — a personal log of every check-in the team member has performed.

### For administrators
- **Admin dashboard** with a deep-blue sidebar and role-based access.
- **Event editor** with ten tabs plus a **More → Featured** option: Information, About, Programme, Speakers, Media, Registrations, Attendance, Feedback, Announcements, Preferences, Featured.
- **Visibility & feature toggles** per event (`has_information`, `has_about`, `has_programme`, `has_speakers`, `has_media`, `has_pledges`, `has_reflections`, `has_feedback`, `has_featured`, `has_side_notch`) — turn any section on or off and the public page adapts on the next refresh.
- **People management** — search users, view details, and change roles (User / Support Team / Admin).
- **Programme builder** — multi-day agenda with drag-and-drop ordering, block types, times and speaker assignment.
- **Speaker management** — drag-and-drop speaker order (`speaker_order`) with image upload and cropping.
- **Featured moments** — CRUD with image upload/cropping, shown as a public slider.
- **Announcements** — publish short updates scoped to an event and **broadcast a Web Push notification** to subscribers in one click.
- **Attendance analytics** — split by day (derived from actual check-in dates), with pagination, search, faculty filtering, and gender/position/faculty/year charts.
- **Reports** — generate a full PDF event report (registrations, attendance, feedback) and email it.
- **Reflections** — moderation, plus a **Present** projector view (real-time, view-only) with the event title/description.
- **Tags** — QR/feedback tag utilities.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | **Next.js 16** (App Router, React 19, `output: "standalone"`) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS v4**, `tw-animate-css` |
| UI primitives | **Radix UI**, shadcn-style components, `lucide-react` icons |
| Animation | **Framer Motion** |
| Database / Auth / Storage | **Supabase** (Postgres + RLS, GoTrue auth, Storage) |
| Auth UX | Email OTP (`signInWithOtp`), no passwords |
| Job queue | **BullMQ** on **Redis 7** (self-hosted) |
| PDF generation | **pdf-lib** + **qrcode** |
| Email delivery | **Plunk** (`next-api.useplunk.com`) |
| Web Push | **web-push** (VAPID) + service worker |
| Charts | **Recharts** |
| Forms & validation | **react-hook-form** + **zod** |
| Notifications | **sonner** (in-app toasts) + **Web Push** |
| Runtime | **Node.js 22** in Docker, behind **nginx** |
| Icons/CDN (optional) | **Cloudflare** |

---

## Architecture

The system runs as **multiple containers built from a single Docker image** and communicates over Redis and Supabase.

```
                              ┌──────────────────────────────────────────┐
   Attendee / Admin /         │            Cloudflare (optional)          │
   Support Team browser  ───► │   TLS · WAF · rate limiting · edge cache  │
                              └─────────────────────┬────────────────────┘
                                                    │
                                          ┌─────────▼─────────┐
                                          │   nginx (TLS)     │
                                          │  reverse proxy    │
                                          └─────────┬─────────┘
                                                    │
                          ┌─────────────────────────┴─────────────────────────┐
                          ▼                                                   ▼
                ┌───────────────────┐                              (same image)
                │  web (Next.js)    │ ◄── cpuset core 0
                │  SSR · API · RSC  │
                └─────────┬─────────┘
                          │  enqueue jobs only (no PDF/email here)
                          ▼
                ┌───────────────────┐
                │  redis (BullMQ)   │  durable queue (AOF persistence)
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │  worker           │ ◄── cpuset core 1
                │  pdf-lib · Plunk  │
                │  Storage uploads  │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────────────────────────────┐
                │              Supabase                     │
                │  Postgres + RLS · Auth · Storage          │
                └───────────────────────────────────────────┘
```

Key architectural decisions:

- **One image, many roles.** The `web` and `worker` containers are built from the same source tree and image; only the start command differs. The worker reuses the exact same `lib/pdf/*` and `lib/email/*` modules — templates are never duplicated.
- **CPU affinity.** Docker `cpuset` pins the web process to core 0 and the worker to core 1, so a burst of PDF generation never stalls server-side rendering.
- **Queue, not `after()`.** API routes hand work to Redis and return immediately. BullMQ retries transient failures (e.g. a rate-limited email) with exponential backoff.
- **Cache-first reads.** Public pages are static / ISR and cached; only genuinely per-user or realtime pages are dynamic.

---

## Request lifecycle

### A page view (public content)
1. nginx (and optionally Cloudflare) serves cached HTML if available.
2. On a cache miss, Next serves a **statically generated / ISR** page — no Supabase round-trip.
3. Public data is fetched through a **cookie-less anonymous client** wrapped in `unstable_cache` with a tag (`events`) and a short revalidate window (30–60s).
4. Admin edits call a server action that `revalidateTag("events", "max")`, refreshing the cached copy.

### A registration (the heavy path)
1. `POST /api/registration` authenticates the user and upserts the `registrations` row — fast, DB-only.
2. It **enqueues** a `registrations` job (`{ registrationId, data }`) into Redis and returns `{ ok: true }` immediately.
3. The **worker** picks up the job, generates the PDF badge with `pdf-lib` + a QR code, uploads it to Supabase Storage, sends the email via Plunk, and writes the badge URL back to the registration row.
4. If Redis is unreachable, the route falls back to Next's `after()` so the feature never hard-fails — it just runs inline on the web process.

### A check-in (QR scan)
1. The support-team member opens the scanner; `getUserMedia` streams the camera into a canvas.
2. `jsQR` decodes the badge QR (which contains the attendee's user id).
3. The scanner loads the profile and the event registration, confirming the registration is `CONFIRMED`.
4. On confirm, it checks for an existing `attendance` record **in the current calendar day**. If one exists, it shows "already checked in today". Otherwise it inserts the attendance row.

---

## Data model

All data lives in Supabase Postgres, protected by Row Level Security. Core tables:

| Table | Purpose | Notable columns |
| --- | --- | --- |
| `profiles` | One row per user, created by an auth trigger | `role`, `position`, `onboarding`, academic fields, `place_of_residence`, `university_res` |
| `events` | Event records | `status`, `mode`, `has_*` visibility flags (incl. `has_featured`, `has_side_notch`), cover/featured images |
| `registrations` | A user's registration for an event | `attendee_id`, `event_id`, `position`, `status`, `attendee_tag_url` |
| `event_program_blocks` | Agenda sessions | `day_number`, `display_order`, `start_time`, `end_time`, `type` |
| `event_program_block_speakers` | Join table: block ↔ speaker | — |
| `speakers` | Speaker profiles | `event_id`, `speaker_order`, `avatar_url`, `bio` |
| `event_gallery_images` | Event media | `display_order`, `object_key` |
| `event_featured` | Featured "moments" (slider) | `event_id`, `title`, `description`, `image_url` |
| `announcements` | Per-event updates | `event_id`, `text` |
| `push_subscriptions` | Web Push subscriptions | `user_id` (nullable), `endpoint` (unique), `keys` (jsonb) |
| `reflections` | Reflections wall posts | `event_id`, `user_id`, `content` |
| `pledges` | Pledges + certificate URL | `user_id`, `event_id`, `pledge_text`, `pledge_document_url` |
| `attendance` | Check-in records | `event_id`, `attendee_id`, `volunteer_id`, `created_at` |
| `feedback` | Anonymous feedback | `event_id`, `rating`, `comment`, `attendee_id` (nullable) |

Enumerations (`lib/types.ts`):
- `UserRole`: `user` · `volunteer` · `admin` *(the `volunteer` value is displayed as "Support Team")*
- `UserPosition`: `STUDENT` · `STAFF` · `GUEST` · `GUEST_SPEAKER`
- `EventMode`: `ONLINE` · `IN_PERSON`
- `EventStatus`: `OPEN` · `CLOSED` · `ENDED`
- `RegistrationStatus`: `CONFIRMED` · `CANCELLED`
- `ProgramBlockType`: keynote, panel discussion, workshop, networking, break, entertainment, Q&A, other

---

## Authentication & roles

Authentication is **passwordless email OTP**, handled entirely by Supabase GoTrue:

1. `AuthGateway` collects an email and calls `supabase.auth.signInWithOtp({ shouldCreateUser: true })`.
2. An `OtpInput` collects the 6-digit code and verifies it.
3. New users are funnelled into `OnboardingFlow`, a step-based animated form.
4. A database trigger (`handle_new_user`) creates the matching `profiles` row defensively.

Sessions are cookie-based via `@supabase/ssr`, with:
- `lib/supabase/server.ts` — cookie-bound server client.
- `lib/supabase/client.ts` — browser client.
- `lib/supabase/anon.ts` — **cookie-less** client for cacheable public reads.
- `lib/supabase/admin.ts` — service-role client (bypasses RLS) used by the worker, the inline delivery fallback, and the push subscribe/send routes. Never bundled to the client.
- `lib/supabase/proxy.ts` — session refresh + route guards (Next 16 middleware, invoked from `proxy.ts`).

### Roles & route protection

| Role | Landing page | Access |
| --- | --- | --- |
| `user` | `/user` | Public site + personal dashboard |
| `volunteer` ("Support Team") | `/volunteer` | Public site + Support Team Portal |
| `admin` | `/admin` | Everything, including the admin dashboard |

Guards in `lib/supabase/proxy.ts` redirect unauthenticated users to `/login`, block non-admins from `/admin`, keep admins out of the user dashboard, and route users to `/onboarding` until onboarding is complete. Role labels are centralised in `lib/roles.ts`, which maps the internal `volunteer` value to the display string **"Support Team"**.

---

## Event lifecycle & visibility

An event is created by an admin and moves through `OPEN → CLOSED → ENDED`. Its `status` drives the public registration button:

- `OPEN` — normal "Register" button.
- `CLOSED` — disabled, red "Closed".
- `ENDED` — disabled, red "Ended".

Each event exposes granular **visibility flags** that shape the public page without code changes. Turning a flag off hides the corresponding section and disables its gated pages (pledges/feedback/reflections redirect to `/`):

`has_information`, `has_about`, `has_programme`, `has_speakers`, `has_media`, `has_pledges`, `has_reflections`, `has_feedback`, `has_featured`, `has_side_notch`.

Feature/visibility changes call `revalidateEvents()` (`revalidateTag("events", { expire: 0 })`) so the public page reflects them on the next refresh with no stale window.

---

## Registration & the attendee badge pipeline

The registration flow is deliberately split into a **fast write** and an **async generation**:

1. **Write (web process).** `POST /api/registration` validates the session, upserts the registration (`onConflict: attendee_id,event_id`), and records the attendee's position.
2. **Enqueue (web process).** A BullMQ job is added to the `registrations` queue with the registration id and the data needed for the badge.
3. **Generate + deliver (worker process).**
   - `generateAttendeeBadge()` builds a 420×640pt PDF: a gold-and-navy banner, the event title, the attendee name, a swallowtail position ribbon, a QR code (the attendee id), event details and the Wits CSD footer with the SLC logo.
   - The PDF is base64-encoded and sent through Plunk as an attachment.
   - The PDF is uploaded to `event_images/attendee-tags/{eventId}/…` and the public URL is stored on the registration as `attendee_tag_url` so the attendee can re-download it from their dashboard.

Because generation happens on a **pinned, separate core** and via a **durable queue**, a burst of registrations degrades into a short, orderly queue instead of blocking the site. Failed deliveries throw and are retried with exponential backoff (up to six attempts).

---

## Pledges

Attendees can take a pledge on the public pledge page (`/pledges/[eventId]`).

- `POST /api/pledges` stores the pledge and enqueues a `pledges` job.
- The worker renders an official **pledge certificate PDF** (`generatePledgeLetter`): a navy header with a gold swallowtail ribbon titled "[Name]'s Pledge", the pledge text, and a signed-at timestamp.
- The certificate is uploaded to Storage, linked from the pledge row, and emailed.
- Admins can browse all pledges and download the certificates.

---

## Reflections wall (polling) + Present view

`/reflections` is a **sticky-note wall**. It intentionally uses **incremental polling every 15s** rather than websockets, so it scales to any audience without hitting Supabase's concurrent-connection ceiling. The poster's own note is added optimistically and appears instantly; other people's new notes arrive within ~15s. The wall is public and names come from the linked profile.

### Present (projector) view
`/present/[eventId]` is an **admin-only, full-screen** view for projecting the wall: a deep-blue background with the event title and description. It is the app's **only Realtime connection** (`postgres_changes` scoped to the event), so new notes appear live — and it is **view-only** (no input). Open it from **Admin → Reflections → [event] → Present**; it includes a browser **Fullscreen** toggle.

*Operational note:* keeping Realtime only on the single presenter connection is deliberate — the public wall uses polling so thousands of viewers don't each hold a websocket.

---

## Announcements & Web Push

Admins publish announcements per event from the **Announcements** tab. Posting one:

1. Stores the announcement (shown via the event page's announcements button, read **uncached** so it's always the latest).
2. **Broadcasts a Web Push notification** to everyone who has opted in.

Implementation:
- `lib/push.ts` signs and sends via **web-push** (VAPID) to every row in `push_subscriptions`, pruning dead endpoints (HTTP 404/410).
- `POST /api/push/subscribe` saves a subscription (anonymous or signed-in).
- `POST /api/push/send` is **admin-only**; it looks up the event title and sends a notification **titled with that event**, which opens the event page when tapped.
- `public/sw.js` handles the `push` and `notificationclick` events.
- `components/notifications/NotificationPrompt.tsx` is the opt-in card.

Notification icons: `icon` = `/icons/notification.png` (the crest, shown when the notification is expanded) and `badge` = `/icons/badge.png` (a monochrome, transparent-background crest for the Android status bar — a square white image there renders as a white block).

*Caveats:* users must grant notification permission; **iOS** requires the installed PWA (iOS 16.4+); and VAPID keys (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` at build, `VAPID_PRIVATE_KEY` at runtime) plus `SUPABASE_SERVICE_ROLE_KEY` must be set for sending to work.

---

## Feedback (anonymous)

`/feedback/[eventId]` is a standalone, full-screen flow with three steps and a thank-you state:

1. **Welcome** → 2. **Star rating** → 3. **Comment** → **Thank you**.

It is genuinely anonymous: `attendee_id` is stored as `null`, so feedback can never be tied back to a person. A "Back to event" link returns the user to the event page. The admin Feedback tab aggregates ratings and comments.

---

## Attendance, QR check-in & the support team portal

The **Support Team Portal** (`/volunteer`) is intentionally minimal — **Scanner** and **History**, split 50/50.

### Check-in validation
A scan resolves the badge QR to a user id, then:
- Confirms a `CONFIRMED` registration exists (otherwise "No registration found").
- Checks the `attendance` table for a record **within the current calendar day**.
- If found → **"already checked in today"** (per-day duplicate prevention).
- Otherwise → inserts the attendance row and confirms.

### Admin attendance analytics
The admin Attendance tab derives its **day tabs from the actual check-in dates** present in the data — not from the event's date range. If records exist on Oct 10, 11 and 12, it shows Day 1, Day 2, Day 3; if only Oct 10, it shows just Day 1. Selecting a day filters the list, the stat cards, all four charts, and pagination (25 per page).

---

## Speakers, programme & featured moments

### Programme
- Multi-day, grouped by `day_number`; drag-and-drop ordering (times swap with the position); typed blocks with rich descriptions and per-block speakers.
- On the public page each block is a distinct deep-blue card with a gold number, a one-line truncated description, a speaker avatar stack and a **Read more** button. The full agenda is **login-gated**, and the side-notch **Programme** panel mirrors it (locked until sign-in).

### Speakers
- `speaker_order` drives display order everywhere — the admin list (drag-and-drop) and the public event page stay in sync.
- Each speaker shows a photo, name (bold), gold title and bio; long bios have an inline **Read more** (text is justified). No modal.

### Featured moments
- Per-event highlights (`event_featured`) shown on the public page as a **slider** (static when there's only one). Each has a title, description and an image uploaded with an in-app **cropper**. Controlled by the `has_featured` flag.

### Side-notch menu
- When `has_side_notch` is on, fixed notches (deep blue / dark gold) open animated full-colour panels for About, Programme, Speakers and Featured. On desktop they default to open with an info-icon toggle; on mobile an info button collapses/expands them.

---

## Reports

Admins can generate an event report from the admin dashboard:
- `POST /api/reports` (admin-only) enqueues a `reports` job.
- The worker aggregates registrations, attendance and feedback and renders a multi-section PDF (`generateEventReport`).
- The report is emailed to the requested address from `reports@witscsd.co.za`.

---

## Caching & performance strategy

Everything below is designed so heavy load degrades gracefully rather than falling over.

- **Static / ISR public pages.** The home page, events list, about and contact are statically generated with revalidate windows (60s / 1h) and served without touching Node's render path or Supabase.
- **Cookie-less data reads.** Public data uses `lib/supabase/anon.ts` wrapped in `unstable_cache` (tagged `events`). This is what lets public pages be cached at all — the shared site layout no longer reads the session (the navbar resolves auth client-side).
- **Event detail: cached content, dynamic actions.** The event record, programme, speakers and featured moments are cached (anon + `unstable_cache`), while the per-user registration state, Register button and Actions row stay dynamic (`force-dynamic`). **Announcements are read uncached** so every refresh shows the latest.
- **Polling over websockets.** The public reflections wall uses incremental 15s polling; the app's only Realtime connection is the admin Present view.
- **On-demand invalidation.** Admin edits, preference/visibility toggles and status changes call `revalidateEvents()` → `revalidateTag("events", { expire: 0 })`, so the next request re-fetches fresh data with **no stale window**.
- **Offloaded CPU.** PDF + QR generation runs in the worker container, pinned to a dedicated CPU core.
- **Durable queue with retries.** Redis (AOF) persists jobs across restarts; BullMQ retries transient failures with exponential backoff. `enqueue()` has a 1.5s timeout and falls back to inline `after()` delivery (using the service-role client when available).
- **HTTP caching.** nginx serves `/_next/static/*` with immutable caching and proxies the rest; Cloudflare can cache the ISR HTML at the edge (with a bypass rule for `/admin`, `/user`, `/api` and auth routes).
- **Skeleton loaders + load tests.** `loading.tsx` files give instant perceived performance, and `load-tests/authenticated.js` (k6) validates the authenticated path.

The practical result: heavy read traffic is absorbed by the cache/CDN, and heavy write traffic (registrations, pledges, reports) is absorbed by the queue and a second CPU core.

---

## Progressive Web App

The platform is installable as a PWA, and behaves like an app when installed:

- `app/manifest.ts` — name, `standalone` display, theme `#003366`, and icons.
- `public/icons/*` — 192/512 standard icons, a 512 maskable icon, an Apple touch icon, a **notification icon** and a monochrome **badge** (for Android status-bar notifications).
- `public/sw.js` — a pass-through service worker that also handles **Web Push** (`push` / `notificationclick`); it does no caching, so nothing goes stale.
- `components/pwa/InstallAppButton.tsx` — a floating **"Install app"** pill that captures `beforeinstallprompt` early (via an inline script), shows platform-appropriate instructions as a fallback, and hides when already installed / on `/admin`.
- **App shell** (`components/pwa/PwaChrome.tsx` + the `data-pwa` Tailwind variant): when running installed, the site renders a **dashboard-first** app experience — a top profile bar, a bottom nav (Events / Dashboard), `/` redirects to `/app` (which routes to `/user` or `/login` server-side), and a themed auth screen. In a normal browser the site is completely unchanged.
- **Web Push** (`web-push`, VAPID): visitors opt in to announcement notifications via `NotificationPrompt`; admins broadcast from the Announcements tab.

---

## Design system

A flat, modern, Google-inspired visual language.

- **Deep blue** `#003366` — primary brand colour.
- **Gold** `#d9b45b` — accents, highlights, countdowns.
- **Dark gold** `#C59B27` — theme labels, speaker titles.
- **Poppins** for UI, **Roboto Mono** for numerics; loaded via `next/font`.
- Radix-based, shadcn-style components in `components/ui/` (button, card, dialog, select, tabs, sidebar, badge, etc.).
- Framer Motion for page and step transitions.
- Fully responsive, with careful mobile handling (no horizontal scroll; fluid grids and stacked layouts).

---

## Repository structure

```
app/
  (auth)/            login, register, onboarding (passwordless flow)
  (site)/            public site: home, events, about, contact, user dashboard
  admin/             admin dashboard: dashboard, people, events, reports,
                     reflections, pledges, speakers, tags, support team
  api/               registration · pledges · reports · push (subscribe/send) · health
  app/               PWA entry (server auth check → /user or /login)
  present/[eventId]  admin-only realtime projector view
  feedback/[eventId] anonymous feedback flow
  pledges/[eventId]  pledge flow
  reflections/       reflections wall (polling)
  volunteer/         support team portal
  manifest.ts        PWA manifest
  layout.tsx         root layout (fonts, metadata, notifications, PWA)
components/
  admin/             event editor + every admin tab, dialogs, uploaders, present view
  auth/              OTP gateway + input
  dashboard/         user profile + my events
  events/            event cards, cover hero, side-notch tabs, programme,
                     speakers, featured slider, register button, countdown
  feedback/          feedback flow
  home/              hero, featured event, core units, upcoming events
  layout/            navbar, footer, page hero, top event banner
  notifications/     web push opt-in prompt
  pledges/           pledge flow
  pwa/               install button + app chrome
  reflections/       polling board
  ui/                design-system primitives
  volunteer/         portal, scanner, history
lib/
  supabase/          server · client · anon · admin · proxy · env
  queue/             BullMQ queues + enqueue helper
  email/             registration · pledge · report delivery
  pdf/               attendee badge · pledge letter · event report
  push.ts            Web Push (web-push) sender
  data.ts            data access (cacheable public reads + user reads)
  auth.ts            current-user helper
  roles.ts           role display labels
  types.ts           all domain types
  program.ts         programme block types & labels
  profile-options.ts faculty / year / gender / residence options
  rich-text.ts       HTML sanitisation & helpers
  storage.ts         image upload helpers
  utils.ts           formatting, initials, etc.
worker/index.ts      BullMQ consumer (pdf-lib + Plunk + Storage)
proxy.ts             Next 16 middleware entrypoint (session + guards)
deploy/nginx/        production nginx site config
load-tests/          k6 authenticated load test
supabase/fixes/      idempotent SQL migrations to run in Supabase
scripts/             icon generator
Dockerfile           multi-stage: deps → builder → runner (web) → worker
docker-compose.yml   web · worker · redis
```

---

## Environment variables

Create a `.env` in the project root (and on the server). See `.env.example`.

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | build + runtime | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes* | build + runtime | Public anon key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes* | build + runtime | Newer publishable key (alternative to anon) |
| `SUPABASE_URL` | No | runtime | Falls back to `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (worker) | **server only** | Service-role key for the worker; never expose |
| `REDIS_URL` | Yes | runtime | `redis://redis:6379` inside compose |
| `PLUNK_SECRET_KEY` | Yes | server only | Sends all transactional email |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes (for push) | build + runtime | VAPID public key (inlined into the client bundle) |
| `VAPID_PRIVATE_KEY` | Yes (for push) | **server only** | VAPID private key that signs Web Push |
| `VAPID_SUBJECT` | No | server only | `mailto:` contact for VAPID (defaults to `registrations@witscsd.co.za`) |
| `NEXT_PUBLIC_PLUNK_PUBLIC_KEY` | No | client | Optional |

\* Provide either the publishable key or the anon key. `NEXT_PUBLIC_*` values are inlined at build time, so they must be present when the Docker image is built.

Transactional email senders:
- `Wits CSD <registrations@witscsd.co.za>` — registrations and pledges
- `Wits CSD <reports@witscsd.co.za>` — event reports

---

## Local development

```bash
npm install
cp .env.example .env         # fill in Supabase + Plunk (Redis optional locally)
npm run dev                  # http://localhost:3000
```

Running the worker locally (optional):

```bash
# needs a local Redis, e.g. docker run -p 6379:6379 redis:7-alpine
REDIS_URL=redis://localhost:6379 npx tsx worker/index.ts
```

Without `REDIS_URL`, the app automatically falls back to inline `after()` delivery, so everything still works for development.

Useful scripts:

```bash
npm run dev       # dev server
npm run build     # production build
npm run lint      # eslint
npm start         # run the production build
npx tsc --noEmit  # typecheck
npx next typegen  # regenerate route types after adding routes
node scripts/generate-icons.mjs   # regenerate PWA icons from the crest
```

> This project is **Next.js 16**. Some APIs and conventions differ from earlier versions; consult `node_modules/next/dist/docs/` when in doubt.

---

## Database setup & migrations

All schema changes, RLS policies and enum additions live as **idempotent SQL scripts** in `supabase/fixes/`. Run them in the Supabase SQL editor (each is safe to re-run):

- `2025_fix_handle_new_user.sql` — defensive `auth.users` trigger that creates the `profiles` row.
- `announcements.sql` — announcements schema + RLS.
- `attendance_multiple_checkins.sql` — drops the old unique constraint so multi-day check-ins are allowed, adds a lookup index.
- `attendee_tag_url.sql` — `registrations.attendee_tag_url` + badge storage policy.
- `event_images_storage.sql` — the public `event_images` bucket and its policies (with folder-scoped restrictions).
- `event_featured.sql` — Featured moments table + RLS.
- `feedback_anonymous.sql` — allows `feedback.attendee_id` to be null.
- `pledges.sql` — pledges table, RLS and document storage policy.
- `program_day_number.sql` — programme `day_number` column + index.
- `promote_admin.sql` — promote a user to `admin` by email.
- `push_subscriptions.sql` — Web Push subscriptions table + RLS.
- `reflections.sql` — reflections RLS + Realtime (used by the admin Present view).
- `rsvp_position.sql` — position column and the `GUEST_SPEAKER` enum value.
- `speakers_event_id.sql` — speaker → event foreign key + index.
- `verify_storage.sql` — storage health checks.

> **Manually added columns** (add via the Supabase table editor or SQL): `events.has_featured`, `events.has_side_notch`, `profiles.place_of_residence`, `profiles.university_res`.

Storage uses a single `event_images` bucket with folder scoping: `attendee-tags/`, `pledges/`, `speakers/` and `events/{id}/featured/`.

---

## Deployment

The stack is deployed with Docker Compose behind nginx on a VPS.

### 1. Build & run

```bash
cd /var/www/wits-csd
cp .env.example .env    # fill in all values
docker compose up -d --build
docker compose ps       # web (healthy), worker, redis
curl -s http://127.0.0.1:3000/api/health
```

`docker-compose.yml` defines three services:
- **web** — Next.js standalone server, published only on `127.0.0.1:3000`, pinned to CPU 0.
- **worker** — the BullMQ consumer, pinned to CPU 1.
- **redis** — Redis 7 with AOF persistence and a healthcheck.

Both `web` and `worker` are built from the same `Dockerfile` (different targets/commands).

### 2. nginx

Install the provided site config and obtain a certificate:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
sudo cp deploy/nginx/events.witscsd.co.za.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/events.witscsd.co.za.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d events.witscsd.co.za
sudo systemctl reload nginx
```

The config redirects HTTP to HTTPS, enables HTTP/2, gzip, immutable caching for `/_next/static/*`, and proxies everything else to the web container. It also sets **enlarged proxy header buffers**:

```nginx
proxy_buffer_size        32k;
proxy_buffers            8 32k;
proxy_busy_buffers_size  64k;
large_client_header_buffers 4 32k;
client_header_buffer_size 16k;
```

Without these, Next's large response headers (Supabase auth cookies + font-preload `Link` headers) overflow nginx's default buffer and produce intermittent `502 upstream sent too big header` errors. Apply them to whichever `server` block serves your domain, then `sudo nginx -t && sudo systemctl reload nginx`.

### 3. DNS & firewall

- Point an `A` record (e.g. `events`) at the VPS IP.
- Allow `22`, `80`, `443` (`ufw allow 22,80,443/tcp`).

### 4. Optional: Cloudflare

Proxy the domain through Cloudflare for TLS, HTTP/3, Brotli, WAF, rate limiting and edge caching of the ISR pages. Add a cache-bypass rule for `/api`, `/admin`, `/user`, `/login`, `/register`, `/onboarding`.

### 5. Redeploy

```bash
git pull && docker compose up -d --build
```

Or, from a dev machine whose SSH key is in the VPS's `authorized_keys`, push to `main` and run:

```bash
npm run deploy    # bash scripts/deploy.sh — pulls origin/main on the VPS, rebuilds, health-checks
```

---

## Operations & monitoring

Things worth watching on event day:

- **Cloudflare**: cache hit ratio, origin requests, 4xx/5xx.
- **VPS**: CPU per core, RAM, container restarts.
- **Redis queues**:
  ```bash
  docker compose exec redis redis-cli llen bull:registrations:wait
  docker compose exec redis redis-cli zcard bull:registrations:delayed
  docker compose exec redis redis-cli llen bull:registrations:failed
  ```
- **Worker logs**: `docker compose logs -f worker`.
- **Supabase**: DB CPU, connections, Realtime connections, slow queries.

If **failed** jobs climb during a burst, it is almost always the email provider (Plunk) rate-limiting — raise the plan or lower worker concurrency so you stay under the limit.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Worker: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" | The service-role key isn't in the worker's environment. Verify with `docker compose exec worker env \| grep SUPABASE` and recreate: `docker compose up -d --force-recreate worker`. Watch for typos in the variable name. |
| Emails not arriving | Check `docker compose logs worker`, the Redis `failed` list, and the Plunk rate limit. |
| Registration succeeds but no badge | Queue/worker issue — confirm `conveo-worker` is up. If Redis is down, delivery falls back to the web process. |
| Push notification not received | The admin toast reports the reason: "Push is not configured" → add the VAPID keys and rebuild; "requires SUPABASE_SERVICE_ROLE_KEY" → add it to the web container; "No push subscribers" → the subscription didn't persist (check `push_subscriptions`). If you regenerated the VAPID keys, existing subscriptions are invalid — re-enable notifications. |
| Android status-bar shows a white block | The notification `badge` must be a monochrome, transparent-background image (`/icons/badge.png`). A square white icon is tinted fully white by Android. |
| Intermittent `502 ... upstream sent too big header` | Next's response headers exceed nginx's default buffer. Add the enlarged `proxy_buffer_size`/`proxy_buffers`/`large_client_header_buffers` directives (see Deployment → nginx). |
| Reflections wall not updating instantly | By design — the public wall polls every 15s; only the admin **Present** view is realtime. |
| Public pages showing stale content | Should not happen after admin edits (invalidation uses `expire: 0`); otherwise check the ISR window (30–60s). |
| Redis "Memory overcommit" warning | `echo 'vm.overcommit_memory = 1' \| sudo tee -a /etc/sysctl.conf && sudo sysctl vm.overcommit_memory=1` |
| Install prompt never appears | Requires HTTPS and a registered service worker; check `sw.js` is served and the manifest is valid. Firefox / desktop Safari have no install prompt by design. |
| `speaker_order` appears at the end | Speakers with a `null` order sort last; drag them in the admin to assign explicit order. |

---

## Security notes

- **Service-role key is server-only.** It lives in `.env` and is used exclusively by the worker; it is never bundled into client code.
- **Row Level Security** is enabled across tables; public reads are intentional, and writes are scoped by policy.
- **Anonymous feedback** stores no attendee link.
- **HTML sanitisation** (`lib/rich-text.ts`) strips scripts, event handlers and `javascript:` URLs before any rich text is rendered.
- **Image optimizer** remote patterns are restricted to the Supabase and project hosts (no wildcard), preventing SSRF/abuse.
- **Rate limiting** at the edge (Cloudflare) and optional in-app guards protect the mutating API routes.
- **Route guards** in the middleware enforce role separation between the public site, the user dashboard, the support portal and the admin area.

---

Built for the Centre for Student Development, University of the Witwatersrand.
