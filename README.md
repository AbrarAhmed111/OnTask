<div align="center">

# OnTask

**A focused work timer that grew into a shared workspace for teams.**

Plan meaningful work, track actual focused time, collaborate with teammates
in real time, and get an AI-written recap of what everyone got done.

Built by **[Abrar Ahmed](https://www.abrarahmed.pro)**

</div>

---

OnTask started as an intentionally simple personal timer: open the
dashboard, add today's work, start one task, pause when needed, keep
moving. It's grown from there into two cooperating services — this Next.js
app and a companion AI microservice ([`ontask-llm`](ontask-llm)) — that add
authenticated accounts, shared team workspaces with live presence and
activity tracking, and a daily AI-generated narrative of a workspace's work,
without giving up the original single-dashboard simplicity for solo use.

## Core Concepts

OnTask keeps three measurements separate:

- **Daily focus target**: how much focused work you want to complete today.
- **Actual work time**: the time recorded by active task timers. Paused time
  does not count.
- **Long-term goal progress**: a percentage that you update manually for an
  optional larger goal.

Working for two hours does not automatically change goal progress. For example,
you can work on a course for two hours and manually update its overall progress
from 60% to 70%.

## Features

### Personal Dashboard

- Add tasks with a planned duration, optionally nested as subtasks under a
  parent task.
- Start, pause, and resume one task at a time.
- Finish a task early when the planned duration is not needed.
- Automatically mark a task complete when its planned duration is reached.
- See actual work for each task and total focused work for the day.
- Edit task names, durations, goal details, and goal percentages.
- Attach an optional long-term goal to a task and track its percentage
  independently from tracked time.
- Desktop notifications and a completion sound when a task finishes.
- Works immediately as a guest (data kept in the browser) — no account
  required to try it.

### Accounts & Sign-in

- Email/password accounts and Google Sign-In (One Tap), via Supabase Auth.
- Password reset flow.
- Guest → account migration: tasks created before signing in are carried
  over into the new account instead of being lost.

### Shared Workspaces

- Create workspaces with a name, description, timezone, and accent color.
- Invite teammates by email, with pending/accepted/rejected/expired/cancelled
  invitation states and an email notification for the invite itself.
- Owner and member roles per workspace.
- Hierarchical workspace tasks (parent tasks with subtasks), each with a
  planned duration, an assignee, and an optional linked goal.
- Shared timers sync in real time via Supabase Realtime — teammates see a
  task move between queued, working, paused, completed, and skipped as it
  happens.
- Live presence: a status dot on each member's avatar shows who currently
  has the workspace open, with a brief animation on the moment someone comes
  online or goes offline.
- Activity feed logging task creation, edits, progress changes,
  (re)assignment, and completion across the workspace.

### Automatic Daily Report

- Every workspace automatically gets a **Daily Report at a configured time of
  day (12:00 PM by default) in its own configured timezone**, covering the
  exact previous rolling 24 hours (not a calendar day) — no one has to click
  "Generate," and OnTask doesn't need to be open. The owner can change both
  the timezone and the report time per workspace at any time (workspace
  settings). A Supabase `pg_cron` job ticks every 5 minutes, finds workspaces
  whose configured local time has arrived, and calls the Next.js app
  server-side to build and save the report; a secondary "Regenerate" action
  stays available to any workspace member for the current report.
- Generation is structured-first: the app aggregates the window's task
  events into a factual snapshot, hands it to the separate
  [`ontask-llm`](ontask-llm) service, and validates the returned narrative
  against that snapshot before saving it — so the AI can narrate the window
  but can't invent facts.
- Idempotent by construction: a database uniqueness constraint on
  `(workspace_id, report_end)` plus an atomic claim means the scheduler can
  run concurrently with itself without ever producing duplicate reports; a
  failed generation is retried automatically on the next tick.
- `ontask-llm` is a stateless FastAPI service with a multi-provider LLM
  gateway (Gemini, Groq, OpenAI, Mistral, Cerebras via LangChain) with
  automatic failover and a deterministic non-AI fallback if every provider
  is unavailable.

### Settings

Open the settings icon in the header to configure:

- Daily focus target in hours and minutes.
- Completion sound when a task reaches its target.
- Whether the next pending task starts automatically after completion.
- Reset of all locally stored tasks and settings.

## What OnTask Does Not Include

OnTask is not intended to become a general productivity suite. It does not
include:

- Calendars or scheduling
- Pomodoro sessions
- Habit tracking or streaks
- Productivity scores or analytics dashboards
- Kanban boards or general project management
- Public/social features beyond invited workspace members

## Technology

**App (this repo)**

- Next.js 15 App Router, React 18, TypeScript
- Tailwind CSS, Lucide React / React Icons
- Redux Toolkit + React Redux for client-side workspace cache/state
- Supabase (Postgres, Auth, Realtime, Row Level Security) for accounts,
  workspaces, tasks, presence, and activity
- Nodemailer for workspace invitation emails
- Browser `localStorage` for the guest/personal dashboard

**AI microservice ([`ontask-llm`](ontask-llm), separate service)**

- Python, FastAPI, LangChain
- Multi-provider LLM gateway with automatic failover between providers

The personal dashboard is local-first and works without any backend
configured. Signing in, workspaces, and the Daily Report require a
configured Supabase project (and, for the Daily Report specifically, a
running `ontask-llm` instance plus the scheduler env vars above).

## Project Structure

```text
src/
├── app/
│   ├── page.tsx                    # Personal dashboard
│   ├── workspaces/                 # Workspace list + per-workspace pages
│   └── api/
│       ├── workspace-invitations/  # Invitation email delivery
│       ├── workspace-summaries/    # Manual "Regenerate" route (secondary to the scheduler)
│       └── cron/daily-reports/     # Automatic Daily Report scheduler entry point (pg_cron -> here)
├── components/
│   ├── auth/                       # Sign-in/sign-up, Google One Tap, migration
│   ├── dashboard/                  # Personal task cards, list, empty state
│   ├── goals/                      # Goal progress UI
│   ├── layout/                     # Header, footer, workspace shell
│   ├── settings/                   # Settings modal
│   ├── tasks/                      # Task forms and modals
│   ├── ui/                         # Shared primitives (Button, Modal, ...)
│   └── workspaces/                 # Workspace cards, members, tasks, activity, Daily Report
├── hooks/                          # useAuth, useTasks, useTimer, useWorkspace*, ...
├── lib/
│   ├── auth/, email/, redux/, supabase/, tasks/
│   ├── notifications.ts, storage.ts, time.ts, dailyReportWindow.ts
│   └── workspaceThemes.ts
└── types/
    ├── index.ts
    └── workspace.ts

ontask-llm/        # Companion AI microservice (its own README, deployed separately)
supabase/          # SQL migrations for auth, workspaces, tasks, presence, activity, Daily Report
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create a `.env` file with at least:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=
ONTASK_LLM_SERVICE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

The personal dashboard runs with none of these set. Supabase variables are
required for sign-in and workspaces; the `SMTP_*` variables are required to
send workspace invitation emails; `ONTASK_LLM_SERVICE_URL` should point at a
running [`ontask-llm`](ontask-llm) instance to enable the automatic Daily
Report. `SUPABASE_SERVICE_ROLE_KEY` (from your Supabase project's API
settings — **server-only, never expose it to the browser**) and
`CRON_SECRET` (any random string you generate) are required for the
automatic scheduler (`/api/cron/daily-reports`); without them the Daily
Report feature falls back to being unavailable rather than insecure.

Apply the SQL migrations in [`supabase/migrations`](supabase/migrations) to
your Supabase project before using auth, workspaces, or the Daily Report —
including [`0018_automatic_daily_reports.sql`](supabase/migrations/0018_automatic_daily_reports.sql),
which also schedules the `pg_cron` job that drives the automatic scheduler.
After applying it (and deploying the app), set the job's target once:

```sql
update public.app_cron_config
set target_url = 'https://<your-deployed-app>/api/cron/daily-reports',
    cron_secret = '<the CRON_SECRET value above>';
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run start     # Serve the production build
npm run lint      # Run ESLint with the repository configuration
npm run format    # Format project files with Prettier
```

## Local Data

The guest/personal dashboard stores its data in the browser:

- `ontask-tasks-v2`: today's tasks, timer state, and goal associations.
- `ontask-settings-v1`: daily target and notification preferences.

Use **Settings → Reset local data** to remove both keys and return to the
initial empty state. Signed-in users' personal and workspace data instead
lives in Supabase, guarded by Row Level Security.

## Philosophy

> Work when you are ready. Focus on one thing. Track the work you actually do.
> Keep moving toward the bigger goal.

## Status

OnTask is under active development.

## License

OnTask is released under the [MIT License](LICENSE).

## Author

OnTask is designed and built by **[Abrar Ahmed](https://www.abrarahmed.pro)**.
