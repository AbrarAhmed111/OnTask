# OnTask

OnTask is a focused daily work timer for people who want to plan meaningful
work, track actual focused time, and manually record progress toward larger
goals.

It is intentionally simple: open the dashboard, add today’s work, start one
task, pause when needed, and keep moving.

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

### Daily Workflow

- Add tasks with a planned duration.
- Start, pause, and resume one task at a time.
- Finish a task early when the planned duration is not needed.
- Automatically mark a task complete when its planned duration is reached.
- See actual work for each task and total focused work for the day.
- Edit task names, durations, goal details, and goal percentages.
- Remove completed tasks when they are no longer needed.

### Goal Tracking

- Attach an optional long-term goal to a task.
- Set and update the goal’s percentage manually.
- View completed and remaining goal percentages independently from task time.

### Settings

Open the settings icon in the header to configure:

- Daily focus target in hours and minutes.
- Completion sound when a task reaches its target.
- Whether the next pending task starts automatically after completion.
- Reset of all locally stored tasks and settings.

### First Launch

On a new installation, OnTask starts with an empty task list. The empty state
guides you to add your first task and build the day’s workflow yourself.

## What OnTask Does Not Include

OnTask is not intended to become a general productivity suite. It does not
include:

- Daily history or analytics dashboards
- Calendars or scheduling
- Pomodoro sessions
- Habit tracking or streaks
- Productivity scores
- Kanban boards or project management
- Teams, sharing, or social features
- AI productivity assistance

## Technology

- Next.js 15 App Router
- React 18
- TypeScript
- Tailwind CSS
- Lucide React icons
- Browser `localStorage` for task and settings persistence

The dashboard is local-first. Supabase infrastructure remains available in the
repository for optional authenticated routes, but the public OnTask dashboard
does not require Supabase credentials to run locally.

## Project Structure

```text
src/
├── app/
│   └── page.tsx
├── components/
│   ├── dashboard/
│   ├── goals/
│   ├── layout/
│   ├── settings/
│   ├── tasks/
│   └── ui/
├── hooks/
│   ├── useSettings.ts
│   ├── useTasks.ts
│   └── useTimer.ts
├── lib/
│   ├── notifications.ts
│   ├── storage.ts
│   └── time.ts
└── types/
    └── index.ts
```

## Getting Started

Install dependencies:

```bash
npm install
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

OnTask stores its dashboard data in the browser:

- `ontask-tasks-v2`: today’s tasks, timer state, and goal associations.
- `ontask-settings-v1`: daily target and notification preferences.

Use **Settings → Reset local data** to remove both keys and return to the
initial empty state.

## Philosophy

> Work when you are ready. Focus on one thing. Track the work you actually do.
> Keep moving toward the bigger goal.

## Status

OnTask is under active development. The current implementation focuses on the
single-dashboard daily workflow and local persistence.

## License

OnTask is released under the [MIT License](LICENSE).
