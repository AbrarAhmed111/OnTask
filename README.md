# OnTask

**A simple open-source daily work timer for focused work and long-term goal tracking.**

OnTask was built for a personal need.

I wanted a simple tool that could help me structure my workday around **actual focused work time**, rather than fixed clock-based schedules. I looked at existing productivity and time-tracking apps, but many of them were subscription-based, included features I didn't need, or didn't support the workflow I had in mind.

So I decided to build my own.

## Why OnTask?

OnTask is designed around a simple idea:

> **Decide what you need to work on, work for the amount of time you planned, and keep moving toward your larger goals.**

The app separates three things:

* **Daily Target** — how much focused work you want to complete today.
* **Actual Work Time** — the time you actually spend working.
* **Goal Progress** — how much of the larger project, course, or goal you have completed.

These are intentionally kept separate.

For example, you might spend **2 hours** working on an LLM course today, while your overall course progress goes from **60% → 70%**. The app does not try to calculate your goal progress from the time you spent. You decide the percentage yourself.

## Features

### Daily Work Workflow

* Set a daily focused-work target.
* Create tasks for the day.
* Assign a specific amount of work time to each task.
* Start, pause, and resume tasks.
* Track actual time spent working.
* Complete tasks when their planned time is reached.
* Continue working beyond the planned duration when needed.
* Finish a task early when you are done for the day.

### Long-Term Goal Tracking

* Link tasks to larger goals.
* Track overall goal completion separately from daily work time.
* Manually update goal progress.
* See completed and remaining percentage.
* Preserve goal progress across different days.

### Daily Planning

* Create a default daily workflow.
* Automatically start a new day from your template.
* Reorder tasks based on priority.
* Add, edit, skip, or remove tasks.
* Adjust today's plan without changing your long-term goals.

### Work History

* Keep a lightweight history of previous workdays.
* See total focused time completed each day.
* View the tasks worked on during previous days.

## Example Workflow

A typical day might look like:

| Task                  | Daily Target |
| --------------------- | -----------: |
| Project Development   |           3h |
| Interview Preparation |       2h 30m |
| LLM Course            |           2h |
| Portfolio / GitHub    |          30m |
| **Total**             |       **8h** |

The goal isn't to work according to a specific clock schedule.

Instead, OnTask tracks **8 hours of actual focused work**.

You can start whenever you're ready, pause whenever you need a break, and continue later.

## What OnTask Is Not

OnTask intentionally avoids becoming a full productivity suite.

It does not try to be:

* A project management platform
* A Kanban board
* A calendar
* A Pomodoro timer
* A habit tracker
* A team management tool
* An analytics-heavy productivity platform
* An AI productivity assistant

The goal is to keep the experience focused and simple.

## Tech Stack

> Technical details will be added as the project develops.

* Next.js
* TypeScript
* Tailwind CSS
* React
* Local Storage

## Project Status

OnTask is currently under development.

The initial version focuses on the core workflow:

1. Create your daily tasks.
2. Set how much time you want to spend on each task.
3. Start working.
4. Pause and resume whenever needed.
5. Track your actual focused work.
6. Update your long-term goal progress.
7. Complete your daily target.

More information about the architecture and implementation will be added as development progresses.

## Philosophy

OnTask follows a simple principle:

**Work when you're ready. Focus on one thing. Track the work you actually do. Keep moving toward the bigger goal.**

No unnecessary complexity.

No forced schedule.

Just stay **OnTask**.

## Open Source

OnTask is open source and built primarily for personal use, but anyone is welcome to use, modify, and contribute to it.

## License

> License information will be added here.
