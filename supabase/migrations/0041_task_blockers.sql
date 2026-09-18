-- Task Blockers
-- Run this once in Supabase Dashboard → SQL Editor, after 0001-0040.
--
-- A blocker answers "why can't this task move forward?". It is deliberately
-- not a paused task (paused = "I stopped on purpose", blocked = "something is
-- preventing me") and not a Goal dependency (0023: a derived edge between two
-- tasks). Shared workspaces only -- a personal workspace has nobody to be
-- waiting on.
--
--   * workspace_tasks.status gains 'blocked'. A task is 'blocked' exactly while
--     it has an ACTIVE task_blockers row; the two only ever change together,
--     inside the RPCs below (the timer guard from 0035 keeps every other write
--     path away from `status`).
--   * Blocking a running task stops its timer: the open time entry is closed
--     and folded into actual_seconds, so blocked time is never focused time.
--   * Resolving moves Blocked -> Queued and NEVER starts anything -- whoever
--     resolves may not be the assignee, and must not start their timer.
--   * Who may resolve is derived on every call from the CURRENT assignee and
--     the blocker's active mentions, never stored: the assignee, or a member
--     explicitly mentioned in the active blocker. The workspace owner gets no
--     bypass; a previous assignee loses the right on reassignment; a removed
--     member's mentions are deactivated (and the member check below would
--     refuse them anyway).
--   * Only the current assignee creates or edits a blocker, because creating
--     one stops the assignee's timer (the timer belongs to the assignee alone,
--     0035).
--   * One active blocker per task; every earlier blocker stays as history.
--   * Client writes go through the three RPCs only (no insert/update/delete
--     grant), so the rules above cannot be bypassed with a raw API call.
--   * Mentions are stored by user_id. The reason text is free text; nothing
--     here ever parses it or treats a display name as identity.
--
-- Notification/activity naming: 'task_blocked' / 'task_unblocked' already mean
-- "blocked by an incomplete Goal dependency" (0023), so blockers use their own
-- task_blocker_* family instead of reusing those.

-- ── status ──────────────────────────────────────────────────────────────────
alter table public.workspace_tasks drop constraint if exists workspace_tasks_status_check;
alter table public.workspace_tasks add constraint workspace_tasks_status_check
  check (status in ('queued', 'working', 'paused', 'blocked', 'completed', 'skipped'));

-- ── task_blockers ───────────────────────────────────────────────────────────
create table public.task_blockers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.workspace_tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  status text not null default 'active' check (status in ('active', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  constraint task_blockers_resolution_consistent check (
    (status = 'active' and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

-- At most one active blocker per task; the rest of a task's blockers are its
-- history and are never overwritten.
create unique index task_blockers_one_active_per_task
  on public.task_blockers (task_id) where status = 'active';
create index task_blockers_workspace_active_idx
  on public.task_blockers (workspace_id) where status = 'active';
create index task_blockers_task_created_idx
  on public.task_blockers (task_id, created_at desc);
-- The Daily Report asks "which blockers overlapped this window?".
create index task_blockers_workspace_created_idx
  on public.task_blockers (workspace_id, created_at desc);

create trigger trg_task_blockers_updated_at
  before update on public.task_blockers
  for each row execute function public.set_updated_at();

-- ── task_blocker_mentions ───────────────────────────────────────────────────
-- workspace_id is denormalised only so RLS and the realtime filter can use it
-- (a realtime filter can only name a column of the table itself); the RPCs are
-- the sole writers and always copy it from the blocker. A mention is removed
-- by stamping removed_at rather than deleting the row, so who was ever asked
-- to help survives for history and the Daily Report.
create table public.task_blocker_mentions (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.task_blockers(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles(id) on delete set null
);

create unique index task_blocker_mentions_one_active
  on public.task_blocker_mentions (blocker_id, mentioned_user_id) where removed_at is null;
create index task_blocker_mentions_blocker_idx
  on public.task_blocker_mentions (blocker_id);
create index task_blocker_mentions_workspace_idx
  on public.task_blocker_mentions (workspace_id);
create index task_blocker_mentions_user_active_idx
  on public.task_blocker_mentions (mentioned_user_id) where removed_at is null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Every workspace member can SEE a blocker (visibility and permission are
-- separate concerns); nobody can write one directly.
alter table public.task_blockers enable row level security;
alter table public.task_blocker_mentions enable row level security;

create policy "task_blockers_select_member" on public.task_blockers
  for select using (public.is_workspace_member(workspace_id));
create policy "task_blocker_mentions_select_member" on public.task_blocker_mentions
  for select using (public.is_workspace_member(workspace_id));

revoke all on public.task_blockers from public, anon, authenticated;
revoke all on public.task_blocker_mentions from public, anon, authenticated;
grant select on public.task_blockers to authenticated;
grant select on public.task_blocker_mentions to authenticated;

alter publication supabase_realtime add table public.task_blockers;
alter publication supabase_realtime add table public.task_blocker_mentions;

-- ── the resolve rule ────────────────────────────────────────────────────────
-- current_user == current task assignee  OR  an active mention on this blocker,
-- and in both cases a CURRENT member of the workspace. Internal only (not
-- granted to clients): the RPCs are what enforce it, and src/lib/tasks/
-- blockerPermissions.ts mirrors it so the UI can hide what would be refused.
-- Keep the two in step.
create or replace function public.can_resolve_task_blocker(p_blocker_id uuid, p_user_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    p_user_id is not null
    and exists (
      select 1
      from public.task_blockers b
      join public.workspace_tasks t on t.id = b.task_id
      where b.id = p_blocker_id
        and b.status = 'active'
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = b.workspace_id and wm.user_id = p_user_id
        )
        and (
          t.assigned_to = p_user_id
          or exists (
            select 1 from public.task_blocker_mentions m
            where m.blocker_id = b.id
              and m.mentioned_user_id = p_user_id
              and m.removed_at is null
          )
        )
    ),
    false
  );
$$;

revoke all on function public.can_resolve_task_blocker(uuid, uuid) from public, anon, authenticated;

-- ── activity + notification types ───────────────────────────────────────────
alter table public.task_events drop constraint if exists task_events_event_type_check;
alter table public.task_events add constraint task_events_event_type_check check (
  event_type in (
    'created', 'edited', 'deleted',
    'assigned', 'reassigned', 'unassigned',
    'started', 'paused', 'resumed', 'completed', 'skipped', 'reopened',
    'progress_changed', 'parent_changed', 'reordered',
    'member_invited', 'invitation_accepted', 'invitation_rejected',
    'invitation_cancelled', 'member_joined', 'member_removed',
    'goal_created', 'goal_updated', 'goal_completed', 'goal_archived',
    'goal_task_created', 'goal_subtask_created',
    'dependency_added', 'dependency_removed', 'task_blocked', 'task_unblocked',
    'note_added', 'note_updated', 'note_deleted',
    'resource_uploaded', 'resource_updated', 'resource_deleted',
    'task_blocker_added', 'task_blocker_updated', 'task_blocker_mention',
    'task_blocker_resolved'
  )
);

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check check (
  notification_type in (
    'assigned', 'reassigned', 'completed', 'reopened', 'task_unblocked',
    'goal_completed', 'invitation_accepted', 'invitation_rejected',
    'member_joined', 'member_removed', 'note_added', 'daily_report_ready',
    'timer_stopped', 'blocker_mention', 'blocker_resolved'
  )
);

-- One notification per (event, recipient) for the two new types, so a repeated
-- delivery of the same event can never notify anybody twice.
create unique index notifications_blocker_event_user_uniq
  on public.notifications (event_id, user_id, notification_type)
  where event_id is not null
    and notification_type in ('blocker_mention', 'blocker_resolved');

-- ── notification dispatch ───────────────────────────────────────────────────
-- 0036's function plus two branches:
--   task_blocker_mention  -> the mentioned member, never the actor. Emitted once
--                            per newly added mention (never for a text edit).
--   task_blocker_resolved -> the task's current assignee, and only when someone
--                            ELSE resolved it: that is the one person who has to
--                            act next (start it again), and an assignee who
--                            resolved their own blocker needs no notification.
--                            Members who were mentioned are not pinged again --
--                            they already have the mention, which now opens onto
--                            a resolved blocker.
create or replace function public.notify_from_task_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_recipient uuid;
  v_task_title text;
  v_actor_name text;
begin
  if new.event_type in ('assigned', 'reassigned') then
    v_recipient := nullif(new.metadata->>'to_user_id', '')::uuid;
    if v_recipient is not null and v_recipient <> new.actor_id then
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, new.goal_id, new.event_type, 'task', new.task_id,
        'You were assigned a task', coalesce(new.metadata->>'title', 'A task'), new.actor_id);
    end if;

  elsif new.event_type = 'task_unblocked' then
    select assigned_to, title into v_recipient, v_task_title from public.workspace_tasks where id = new.task_id;
    if v_recipient is not null and v_recipient <> new.actor_id then
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, new.goal_id, 'task_unblocked', 'task', new.task_id,
        'A task you''re assigned to is now ready', coalesce(v_task_title, 'A task'), new.actor_id);
    end if;

  elsif new.event_type = 'note_added' then
    select assigned_to, title into v_recipient, v_task_title from public.workspace_tasks where id = new.task_id;
    if v_recipient is not null and v_recipient <> new.actor_id then
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, new.goal_id, 'note_added', 'task', new.task_id,
        'New note on a task you''re assigned to', coalesce(v_task_title, 'A task'), new.actor_id);
    end if;

  elsif new.event_type = 'completed' then
    select created_by, title into v_recipient, v_task_title from public.workspace_tasks where id = new.task_id;
    if v_recipient is not null and v_recipient <> new.actor_id then
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, new.goal_id, 'completed', 'task', new.task_id,
        'A task you created was completed', coalesce(v_task_title, 'A task'), new.actor_id);
    end if;

  elsif new.event_type = 'reopened' then
    select created_by, title into v_recipient, v_task_title from public.workspace_tasks where id = new.task_id;
    if v_recipient is not null and v_recipient <> new.actor_id then
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, new.goal_id, 'reopened', 'task', new.task_id,
        'A task you created was reopened', coalesce(v_task_title, 'A task'), new.actor_id);
    end if;

  elsif new.event_type = 'goal_completed' then
    insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
    select wm.user_id, new.workspace_id, new.id, new.goal_id, 'goal_completed', 'goal', new.goal_id,
      'A goal was completed', coalesce(new.metadata->>'name', 'A goal'), new.actor_id
    from public.workspace_members wm
    where wm.workspace_id = new.workspace_id and wm.user_id <> new.actor_id;

  elsif new.event_type = 'invitation_accepted' then
    select invited_by into v_recipient from public.workspace_invitations
      where workspace_id = new.workspace_id
        and lower(invited_email) = lower(new.metadata->>'invited_email')
      order by created_at desc limit 1;
    if v_recipient is not null and v_recipient <> new.actor_id then
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, null, 'invitation_accepted', 'workspace', null,
        'Your invitation was accepted', new.metadata->>'invited_email', new.actor_id);
    end if;

  elsif new.event_type = 'invitation_rejected' then
    select invited_by into v_recipient from public.workspace_invitations
      where workspace_id = new.workspace_id
        and lower(invited_email) = lower(new.metadata->>'invited_email')
      order by created_at desc limit 1;
    if v_recipient is not null and v_recipient <> new.actor_id then
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, null, 'invitation_rejected', 'workspace', null,
        'Your invitation was declined', new.metadata->>'invited_email', new.actor_id);
    end if;

  elsif new.event_type = 'member_joined' then
    insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
    select wm.user_id, new.workspace_id, new.id, null, 'member_joined', 'workspace', null,
      'Someone joined the workspace', new.metadata->>'display_name', new.actor_id
    from public.workspace_members wm
    where wm.workspace_id = new.workspace_id and wm.user_id <> new.actor_id;

  elsif new.event_type = 'member_removed' then
    insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
    select wm.user_id, new.workspace_id, new.id, null, 'member_removed', 'workspace', null,
      'A member left the workspace', new.metadata->>'removed_display_name', new.actor_id
    from public.workspace_members wm
    where wm.workspace_id = new.workspace_id and wm.user_id <> new.actor_id;

  -- The owner stopped someone else's running timer (emergency_stop_workspace_task,
  -- 0035). The recipient is the person whose timer it was, never the owner who
  -- did it.
  elsif new.event_type = 'paused' and new.metadata->>'reason' = 'emergency_stop' then
    v_recipient := nullif(new.metadata->>'stopped_user_id', '')::uuid;
    if v_recipient is not null and v_recipient <> new.actor_id then
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, new.goal_id, 'timer_stopped', 'task', new.task_id,
        'The workspace owner stopped your timer', coalesce(new.metadata->>'title', 'A task'), new.actor_id);
    end if;

  -- Someone was asked, by name, to help unblock a task. Title carries who asked
  -- (the notification list is otherwise anonymous); the body is the task and the
  -- reason, one per line.
  elsif new.event_type = 'task_blocker_mention' then
    v_recipient := nullif(new.metadata->>'mentioned_user_id', '')::uuid;
    if v_recipient is not null
       and v_recipient <> new.actor_id
       and public.is_workspace_member(new.workspace_id, v_recipient) then
      select coalesce(nullif(btrim(full_name), ''), email, 'Someone') into v_actor_name
        from public.profiles where id = new.actor_id;
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, new.goal_id, 'blocker_mention', 'task', new.task_id,
        coalesce(v_actor_name, 'Someone') || ' mentioned you in a blocker',
        coalesce(new.metadata->>'title', 'A task') || E'\n' || coalesce(new.metadata->>'reason', ''),
        new.actor_id)
      on conflict do nothing;
    end if;

  elsif new.event_type = 'task_blocker_resolved' then
    v_recipient := nullif(new.metadata->>'assignee_id', '')::uuid;
    if v_recipient is not null
       and v_recipient <> new.actor_id
       and public.is_workspace_member(new.workspace_id, v_recipient) then
      select coalesce(nullif(btrim(full_name), ''), email, 'Someone') into v_actor_name
        from public.profiles where id = new.actor_id;
      insert into public.notifications (user_id, workspace_id, event_id, goal_id, notification_type, entity_type, entity_id, title, body, actor_id)
      values (v_recipient, new.workspace_id, new.id, new.goal_id, 'blocker_resolved', 'task', new.task_id,
        coalesce(v_actor_name, 'Someone') || ' resolved a blocker on your task',
        coalesce(new.metadata->>'title', 'A task') || E'\n'
          || coalesce(nullif(new.metadata->>'resolution_note', ''), 'Ready to start again.'),
        new.actor_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- ── never leave a blocker nobody can resolve ────────────────────────────────
-- The assignee can always resolve, so the blocker is only ever stranded if the
-- task has no assignee AND no mention left. Refuse to unassign a blocked task;
-- reassigning it to someone else is always fine (and is how ownership moves).
create or replace function public.guard_blocked_task_unassign()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if old.status = 'blocked' and new.assigned_to is null then
    raise exception 'resolve the blocker before unassigning this task'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_workspace_tasks_guard_blocked_unassign on public.workspace_tasks;
create trigger trg_workspace_tasks_guard_blocked_unassign
  before update of assigned_to on public.workspace_tasks
  for each row
  when (old.assigned_to is not null and new.assigned_to is null)
  execute function public.guard_blocked_task_unassign();

-- A member who leaves (or is removed) can no longer be asked to help: their
-- mentions on ACTIVE blockers are deactivated, so rejoining later doesn't
-- silently hand the right back. Resolved blockers keep their mentions as history.
create or replace function public.deactivate_blocker_mentions_on_member_removed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.task_blocker_mentions m
    set removed_at = now(), removed_by = auth.uid()
    where m.workspace_id = old.workspace_id
      and m.mentioned_user_id = old.user_id
      and m.removed_at is null
      and exists (
        select 1 from public.task_blockers b
        where b.id = m.blocker_id and b.status = 'active'
      );
  return old;
end;
$$;

drop trigger if exists trg_workspace_members_deactivate_blocker_mentions on public.workspace_members;
create trigger trg_workspace_members_deactivate_blocker_mentions
  after delete on public.workspace_members
  for each row execute function public.deactivate_blocker_mentions_on_member_removed();

-- ── block ───────────────────────────────────────────────────────────────────
-- p_blocker_id lets the client mint the id up front so its optimistic row and
-- the realtime event for the real row are the same row; it also makes a retried
-- request idempotent instead of failing on the primary key.
create or replace function public.block_workspace_task(
  p_task_id uuid,
  p_reason text,
  p_mentioned_user_ids uuid[] default '{}',
  p_blocker_id uuid default gen_random_uuid()
)
returns public.task_blockers
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_blocker_id uuid := coalesce(p_blocker_id, gen_random_uuid());
  v_task public.workspace_tasks%rowtype;
  v_blocker public.task_blockers%rowtype;
  v_entry public.task_time_entries%rowtype;
  v_duration int;
  v_total int := 0;
  v_was_working boolean;
  v_parent_title text;
  v_mentioned uuid[];
  v_mentioned_json jsonb := '[]'::jsonb;
  v_mid uuid;
  v_mname text;
  v_item jsonb;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- A retry of a request that already went through.
  select * into v_blocker from public.task_blockers
    where id = v_blocker_id and task_id = p_task_id and created_by = v_user_id;
  if found then
    return v_blocker;
  end if;

  if v_reason = '' then
    raise exception 'say what is blocking this task';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'the reason is too long (500 characters at most)';
  end if;

  select * into v_task from public.workspace_tasks where id = p_task_id for update;
  -- A non-member gets the same answer as a task that doesn't exist.
  if v_task.id is null or not public.is_workspace_member(v_task.workspace_id, v_user_id) then
    raise exception 'task not found';
  end if;
  if public.is_personal_workspace(v_task.workspace_id) then
    raise exception 'blockers are only available in shared workspaces';
  end if;
  if v_task.assigned_to is distinct from v_user_id then
    raise exception 'only the member this task is assigned to can block it'
      using errcode = '42501';
  end if;
  if v_task.status = 'blocked' then
    raise exception 'this task is already blocked' using errcode = '55000';
  end if;
  if v_task.status not in ('queued', 'working', 'paused') then
    raise exception 'a finished task cannot be blocked' using errcode = '55000';
  end if;
  if exists (select 1 from public.workspace_tasks where parent_task_id = p_task_id) then
    raise exception 'a task that groups subtasks cannot be blocked -- block one of its subtasks instead';
  end if;

  -- Distinct, without the caller (the assignee can already resolve), and only
  -- people who are in the workspace right now.
  select coalesce(array_agg(distinct u), '{}'::uuid[]) into v_mentioned
    from unnest(coalesce(p_mentioned_user_ids, '{}'::uuid[])) as u
    where u is not null and u <> v_user_id;
  if coalesce(array_length(v_mentioned, 1), 0) > 10 then
    raise exception 'mention at most 10 members';
  end if;
  foreach v_mid in array v_mentioned loop
    if not public.is_workspace_member(v_task.workspace_id, v_mid) then
      raise exception 'only current workspace members can be mentioned';
    end if;
  end loop;

  -- Stop the clock. Time already recorded is kept; nothing from here on is
  -- focused time.
  v_was_working := v_task.status = 'working';
  perform set_config('ontask.timer_write', 'on', true);
  for v_entry in
    select * from public.task_time_entries
    where task_id = p_task_id and task_kind = 'workspace' and ended_at is null
    for update
  loop
    v_duration := greatest(0, extract(epoch from (now() - v_entry.started_at))::int);
    update public.task_time_entries
      set ended_at = now(), duration_seconds = v_duration
      where id = v_entry.id;
    v_total := v_total + v_duration;
  end loop;

  update public.workspace_tasks
    set status = 'blocked',
        started_at = null,
        actual_seconds = actual_seconds + v_total
    where id = p_task_id
    returning * into v_task;

  insert into public.task_blockers (id, task_id, workspace_id, created_by, reason)
    values (v_blocker_id, p_task_id, v_task.workspace_id, v_user_id, v_reason)
    returning * into v_blocker;

  foreach v_mid in array v_mentioned loop
    insert into public.task_blocker_mentions (blocker_id, workspace_id, mentioned_user_id, added_by)
      values (v_blocker.id, v_task.workspace_id, v_mid, v_user_id);
    select coalesce(nullif(btrim(full_name), ''), email, 'A member') into v_mname
      from public.profiles where id = v_mid;
    v_mentioned_json := v_mentioned_json
      || jsonb_build_object('user_id', v_mid, 'name', coalesce(v_mname, 'A member'));
  end loop;

  if v_task.parent_task_id is not null then
    select title into v_parent_title from public.workspace_tasks where id = v_task.parent_task_id;
  end if;

  -- clock_timestamp() (not now()) so the blocker line sorts before the mention
  -- lines that belong to it -- everything here shares one transaction.
  insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata, created_at)
    values (p_task_id, v_task.workspace_id, v_task.goal_id, v_user_id, 'task_blocker_added',
      jsonb_build_object(
        'title', v_task.title,
        'parent_title', v_parent_title,
        'blocker_id', v_blocker.id,
        'reason', v_reason,
        'mentioned', v_mentioned_json,
        'stopped_timer', v_was_working
      ),
      clock_timestamp());

  for v_item in select * from jsonb_array_elements(v_mentioned_json) loop
    insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata, created_at)
      values (p_task_id, v_task.workspace_id, v_task.goal_id, v_user_id, 'task_blocker_mention',
        jsonb_build_object(
          'title', v_task.title,
          'parent_title', v_parent_title,
          'blocker_id', v_blocker.id,
          'reason', v_reason,
          'mentioned_user_id', v_item->>'user_id',
          'mentioned_name', v_item->>'name'
        ),
        clock_timestamp());
  end loop;

  return v_blocker;
end;
$$;

revoke all on function public.block_workspace_task(uuid, text, uuid[], uuid) from public, anon;
grant execute on function public.block_workspace_task(uuid, text, uuid[], uuid) to authenticated;

-- ── edit ────────────────────────────────────────────────────────────────────
-- A null argument means "leave that part alone". Only the reason or the mention
-- set actually changing produces an event; only a NEWLY added member is
-- notified, so fixing a typo notifies nobody. Removing a mention takes the right
-- to resolve away and sends nothing.
create or replace function public.update_task_blocker(
  p_blocker_id uuid,
  p_reason text default null,
  p_mentioned_user_ids uuid[] default null
)
returns public.task_blockers
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_blocker public.task_blockers%rowtype;
  v_task public.workspace_tasks%rowtype;
  v_new_reason text;
  v_reason_changed boolean := false;
  v_current uuid[];
  v_wanted uuid[];
  v_added uuid[] := '{}'::uuid[];
  v_removed uuid[] := '{}'::uuid[];
  v_added_json jsonb := '[]'::jsonb;
  v_removed_json jsonb := '[]'::jsonb;
  v_parent_title text;
  v_mid uuid;
  v_mname text;
  v_item jsonb;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_blocker from public.task_blockers where id = p_blocker_id for update;
  if v_blocker.id is null then
    raise exception 'blocker not found';
  end if;
  select * into v_task from public.workspace_tasks where id = v_blocker.task_id for update;
  if v_task.id is null or not public.is_workspace_member(v_task.workspace_id, v_user_id) then
    raise exception 'blocker not found';
  end if;
  if v_blocker.status <> 'active' then
    raise exception 'this blocker has already been resolved' using errcode = '55000';
  end if;
  if v_task.assigned_to is distinct from v_user_id then
    raise exception 'only the member this task is assigned to can edit its blocker'
      using errcode = '42501';
  end if;

  v_new_reason := v_blocker.reason;
  if p_reason is not null then
    v_new_reason := btrim(p_reason);
    if v_new_reason = '' then
      raise exception 'say what is blocking this task';
    end if;
    if char_length(v_new_reason) > 500 then
      raise exception 'the reason is too long (500 characters at most)';
    end if;
    v_reason_changed := v_new_reason is distinct from v_blocker.reason;
  end if;

  select coalesce(array_agg(mentioned_user_id), '{}'::uuid[]) into v_current
    from public.task_blocker_mentions
    where blocker_id = p_blocker_id and removed_at is null;

  if p_mentioned_user_ids is not null then
    select coalesce(array_agg(distinct u), '{}'::uuid[]) into v_wanted
      from unnest(p_mentioned_user_ids) as u
      where u is not null and u <> v_user_id;
    if coalesce(array_length(v_wanted, 1), 0) > 10 then
      raise exception 'mention at most 10 members';
    end if;
    select coalesce(array_agg(u), '{}'::uuid[]) into v_added
      from unnest(v_wanted) as u where not (u = any (v_current));
    select coalesce(array_agg(u), '{}'::uuid[]) into v_removed
      from unnest(v_current) as u where not (u = any (v_wanted));
    foreach v_mid in array v_added loop
      if not public.is_workspace_member(v_task.workspace_id, v_mid) then
        raise exception 'only current workspace members can be mentioned';
      end if;
    end loop;
  end if;

  if not v_reason_changed
     and coalesce(array_length(v_added, 1), 0) = 0
     and coalesce(array_length(v_removed, 1), 0) = 0 then
    return v_blocker;
  end if;

  if v_reason_changed then
    update public.task_blockers set reason = v_new_reason
      where id = p_blocker_id returning * into v_blocker;
  end if;

  foreach v_mid in array v_removed loop
    update public.task_blocker_mentions
      set removed_at = now(), removed_by = v_user_id
      where blocker_id = p_blocker_id and mentioned_user_id = v_mid and removed_at is null;
    select coalesce(nullif(btrim(full_name), ''), email, 'A member') into v_mname
      from public.profiles where id = v_mid;
    v_removed_json := v_removed_json
      || jsonb_build_object('user_id', v_mid, 'name', coalesce(v_mname, 'A member'));
  end loop;

  foreach v_mid in array v_added loop
    insert into public.task_blocker_mentions (blocker_id, workspace_id, mentioned_user_id, added_by)
      values (p_blocker_id, v_task.workspace_id, v_mid, v_user_id);
    select coalesce(nullif(btrim(full_name), ''), email, 'A member') into v_mname
      from public.profiles where id = v_mid;
    v_added_json := v_added_json
      || jsonb_build_object('user_id', v_mid, 'name', coalesce(v_mname, 'A member'));
  end loop;

  if v_task.parent_task_id is not null then
    select title into v_parent_title from public.workspace_tasks where id = v_task.parent_task_id;
  end if;

  insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata, created_at)
    values (v_task.id, v_task.workspace_id, v_task.goal_id, v_user_id, 'task_blocker_updated',
      jsonb_build_object(
        'title', v_task.title,
        'parent_title', v_parent_title,
        'blocker_id', p_blocker_id,
        'reason', v_blocker.reason,
        'reason_changed', v_reason_changed,
        'added', v_added_json,
        'removed', v_removed_json
      ),
      clock_timestamp());

  for v_item in select * from jsonb_array_elements(v_added_json) loop
    insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata, created_at)
      values (v_task.id, v_task.workspace_id, v_task.goal_id, v_user_id, 'task_blocker_mention',
        jsonb_build_object(
          'title', v_task.title,
          'parent_title', v_parent_title,
          'blocker_id', p_blocker_id,
          'reason', v_blocker.reason,
          'mentioned_user_id', v_item->>'user_id',
          'mentioned_name', v_item->>'name'
        ),
        clock_timestamp());
  end loop;

  return v_blocker;
end;
$$;

revoke all on function public.update_task_blocker(uuid, text, uuid[]) from public, anon;
grant execute on function public.update_task_blocker(uuid, text, uuid[]) to authenticated;

-- ── resolve ─────────────────────────────────────────────────────────────────
-- Blocked -> Queued. The original reason is left exactly as written; the
-- optional note is stored beside it. Nothing is started: the assignee starts the
-- task again themselves.
create or replace function public.resolve_task_blocker(
  p_blocker_id uuid,
  p_note text default null
)
returns public.task_blockers
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_blocker public.task_blockers%rowtype;
  v_task public.workspace_tasks%rowtype;
  v_parent_title text;
  v_mentioned jsonb;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'the note is too long (500 characters at most)';
  end if;

  select * into v_blocker from public.task_blockers where id = p_blocker_id for update;
  if v_blocker.id is null then
    raise exception 'blocker not found';
  end if;
  select * into v_task from public.workspace_tasks where id = v_blocker.task_id for update;
  if v_task.id is null or not public.is_workspace_member(v_task.workspace_id, v_user_id) then
    raise exception 'blocker not found';
  end if;

  if v_blocker.status <> 'active' then
    raise exception 'this blocker has already been resolved' using errcode = '55000';
  end if;
  if not public.can_resolve_task_blocker(p_blocker_id, v_user_id) then
    raise exception 'only the member this task is assigned to, or a member mentioned in the blocker, can resolve it'
      using errcode = '42501';
  end if;

  update public.task_blockers
    set status = 'resolved',
        resolved_at = now(),
        resolved_by = v_user_id,
        resolution_note = v_note
    where id = p_blocker_id
    returning * into v_blocker;

  -- Back to the queue, timer stopped, nothing started.
  perform set_config('ontask.timer_write', 'on', true);
  update public.workspace_tasks
    set status = 'queued', started_at = null
    where id = v_task.id and status = 'blocked';

  if v_task.parent_task_id is not null then
    select title into v_parent_title from public.workspace_tasks where id = v_task.parent_task_id;
  end if;
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'user_id', m.mentioned_user_id,
      'name', coalesce(nullif(btrim(p.full_name), ''), p.email, 'A member')
    ) order by m.created_at),
    '[]'::jsonb
  ) into v_mentioned
  from public.task_blocker_mentions m
  join public.profiles p on p.id = m.mentioned_user_id
  where m.blocker_id = p_blocker_id and m.removed_at is null;

  insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata, created_at)
    values (v_task.id, v_task.workspace_id, v_task.goal_id, v_user_id, 'task_blocker_resolved',
      jsonb_build_object(
        'title', v_task.title,
        'parent_title', v_parent_title,
        'blocker_id', p_blocker_id,
        'reason', v_blocker.reason,
        'resolution_note', v_note,
        'blocker_created_by', v_blocker.created_by,
        'assignee_id', v_task.assigned_to,
        'mentioned', v_mentioned
      ),
      clock_timestamp());

  return v_blocker;
end;
$$;

revoke all on function public.resolve_task_blocker(uuid, text) from public, anon;
grant execute on function public.resolve_task_blocker(uuid, text) to authenticated;

-- ── timer functions: a blocked task is not startable, pausable or finishable ─
-- 0040's start_workspace_task / 0035's pause and complete, each with one extra
-- check after the permission check. A blocked task leaves the state only through
-- resolve_task_blocker; without these a direct RPC call could move it to
-- working/paused/completed while its blocker was still active.
create or replace function public.start_workspace_task(p_task_id uuid)
returns public.workspace_tasks
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_goal_id uuid;
  v_assigned_to uuid;
  v_status text;
  v_open_entry public.task_time_entries%rowtype;
  v_duration int;
  v_result public.workspace_tasks%rowtype;
  v_parent_title text;
  v_was_worked_before boolean;
  v_blocked boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select workspace_id, goal_id, assigned_to, status
    into v_workspace_id, v_goal_id, v_assigned_to, v_status
    from public.workspace_tasks where id = p_task_id;
  if v_workspace_id is null then
    raise exception 'task not found';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_workspace_id and user_id = v_user_id
  ) then
    raise exception 'not a member of this workspace';
  end if;

  perform public.assert_workspace_task_timer_controller(v_workspace_id, v_assigned_to, v_user_id);
  if v_status = 'blocked' then
    raise exception 'this task is blocked -- resolve its blocker before starting it'
      using errcode = '55000';
  end if;
  perform set_config('ontask.timer_write', 'on', true);

  if v_goal_id is not null then
    select exists (
      select 1
      from public.task_dependencies td
      join public.workspace_tasks bt on bt.id = td.blocking_task_id
      where td.blocked_task_id = p_task_id
        and bt.status not in ('completed', 'skipped')
    ) into v_blocked;
    if v_blocked then
      raise exception 'this task is blocked by an incomplete dependency';
    end if;
  end if;

  select (actual_seconds > 0) into v_was_worked_before
    from public.workspace_tasks where id = p_task_id;

  select * into v_open_entry from public.task_time_entries
    where user_id = v_user_id
      and workspace_id = v_workspace_id
      and ended_at is null
    for update;

  if found then
    v_duration := greatest(0, extract(epoch from (now() - v_open_entry.started_at))::int);
    update public.task_time_entries
      set ended_at = now(), duration_seconds = v_duration
      where id = v_open_entry.id;

    if v_open_entry.task_kind = 'personal' then
      update public.personal_tasks
        set actual_seconds = actual_seconds + v_duration,
            status = case when id = p_task_id then status else 'paused' end,
            started_at = case when id = p_task_id then started_at else null end
        where id = v_open_entry.task_id;
    else
      update public.workspace_tasks
        set actual_seconds = actual_seconds + v_duration,
            status = case when id = p_task_id then status else 'paused' end,
            started_at = case when id = p_task_id then started_at else null end
        where id = v_open_entry.task_id;
    end if;
  end if;

  insert into public.task_time_entries (task_id, task_kind, workspace_id, user_id, started_at)
    values (p_task_id, 'workspace', v_workspace_id, v_user_id, now());

  update public.workspace_tasks
    set status = 'working', started_at = now()
    where id = p_task_id
      and public.is_workspace_task_timer_controller(workspace_id, assigned_to, v_user_id)
    returning * into v_result;

  if not found then
    raise exception 'only the member this task is assigned to can control its timer'
      using errcode = '42501';
  end if;

  if v_result.parent_task_id is not null then
    select title into v_parent_title from public.workspace_tasks
      where id = v_result.parent_task_id;
  end if;

  insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata)
    values (p_task_id, v_workspace_id, v_goal_id, v_user_id,
      case when v_was_worked_before then 'resumed' else 'started' end,
      jsonb_build_object('title', v_result.title, 'parent_title', v_parent_title));

  return v_result;
end;
$$;

grant execute on function public.start_workspace_task(uuid) to authenticated;

create or replace function public.pause_workspace_task(p_task_id uuid)
returns public.workspace_tasks
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_goal_id uuid;
  v_assigned_to uuid;
  v_status text;
  v_open_entry public.task_time_entries%rowtype;
  v_duration int := 0;
  v_result public.workspace_tasks%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select workspace_id, goal_id, assigned_to, status
    into v_workspace_id, v_goal_id, v_assigned_to, v_status
    from public.workspace_tasks where id = p_task_id for update;
  if v_workspace_id is null then
    raise exception 'task not found';
  end if;

  perform public.assert_workspace_task_timer_controller(v_workspace_id, v_assigned_to, v_user_id);
  if v_status = 'blocked' then
    raise exception 'this task is blocked -- resolve its blocker instead of pausing it'
      using errcode = '55000';
  end if;
  perform set_config('ontask.timer_write', 'on', true);

  select * into v_open_entry from public.task_time_entries
    where user_id = v_user_id and task_id = p_task_id and task_kind = 'workspace'
      and ended_at is null for update;

  if found then
    v_duration := greatest(0, extract(epoch from (now() - v_open_entry.started_at))::int);
    update public.task_time_entries
      set ended_at = now(), duration_seconds = v_duration
      where id = v_open_entry.id;
  end if;

  update public.workspace_tasks
    set actual_seconds = actual_seconds + v_duration,
        status = 'paused', started_at = null
    where id = p_task_id
    returning * into v_result;

  if not found then
    raise exception 'task not found';
  end if;

  insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata)
    values (p_task_id, v_workspace_id, v_goal_id, v_user_id, 'paused',
      jsonb_build_object('title', v_result.title));

  return v_result;
end;
$$;

grant execute on function public.pause_workspace_task(uuid) to authenticated;

create or replace function public.complete_workspace_task(
  p_task_id uuid, p_skip boolean default false
)
returns public.workspace_tasks
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_goal_id uuid;
  v_assigned_to uuid;
  v_status text;
  v_open_entry public.task_time_entries%rowtype;
  v_duration int := 0;
  v_result public.workspace_tasks%rowtype;
  v_dep record;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select workspace_id, goal_id, assigned_to, status
    into v_workspace_id, v_goal_id, v_assigned_to, v_status
    from public.workspace_tasks where id = p_task_id for update;
  if v_workspace_id is null then
    raise exception 'task not found';
  end if;

  if v_status = 'blocked' then
    raise exception 'this task is blocked -- resolve its blocker before finishing it'
      using errcode = '55000';
  end if;
  if v_status = 'working' then
    perform public.assert_workspace_task_timer_controller(v_workspace_id, v_assigned_to, v_user_id);
  end if;
  perform set_config('ontask.timer_write', 'on', true);

  select * into v_open_entry from public.task_time_entries
    where user_id = v_user_id and task_id = p_task_id and task_kind = 'workspace'
      and ended_at is null for update;

  if found then
    v_duration := greatest(0, extract(epoch from (now() - v_open_entry.started_at))::int);
    update public.task_time_entries
      set ended_at = now(), duration_seconds = v_duration
      where id = v_open_entry.id;
  end if;

  update public.workspace_tasks
    set actual_seconds = actual_seconds + v_duration,
        status = case when p_skip then 'skipped' else 'completed' end,
        started_at = null,
        completed_at = now()
    where id = p_task_id
    returning * into v_result;

  if not found then
    raise exception 'task not found';
  end if;

  insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata)
    values (p_task_id, v_workspace_id, v_goal_id, v_user_id,
      case when p_skip then 'skipped' else 'completed' end,
      jsonb_build_object('title', v_result.title));

  if v_goal_id is not null then
    for v_dep in
      select wt.id as task_id, wt.title
      from public.task_dependencies td
      join public.workspace_tasks wt on wt.id = td.blocked_task_id
      where td.blocking_task_id = p_task_id
        and not exists (
          select 1
          from public.task_dependencies td2
          join public.workspace_tasks bt2 on bt2.id = td2.blocking_task_id
          where td2.blocked_task_id = wt.id
            and bt2.id <> p_task_id
            and bt2.status not in ('completed', 'skipped')
        )
    loop
      insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata)
        values (v_dep.task_id, v_workspace_id, v_goal_id, v_user_id, 'task_unblocked',
          jsonb_build_object(
            'title', v_dep.title,
            'unblocked_by_task_id', p_task_id,
            'unblocked_by_title', v_result.title
          ));
    end loop;
  end if;

  return v_result;
end;
$$;

grant execute on function public.complete_workspace_task(uuid, boolean) to authenticated;

-- ── Daily Report: deterministic blocker facts ───────────────────────────────
-- 0027's snapshot plus one top-level `blockers` array. Blocker EVENTS already
-- reach the report for free (the per-member event list only excludes membership
-- events), attributed to whoever did them; this adds the state the events can't
-- give: every blocker that overlapped the window, with its verbatim reason, who
-- was mentioned, who resolved it and when, and how long it was blocked INSIDE
-- the window. Everything comes from these tables -- the narrative service is
-- only ever handed these facts, never asked to produce them.
--
-- The window, not "now", decides what happened: a blocker resolved after
-- report_end is reported as still blocked at the end of the window, so
-- regenerating an old report later can't leak a future resolution into it.
-- status_end is deliberately left at its three values (completed / in_progress /
-- skipped): ontask-llm validates that enum, and a blocked task's story is
-- carried by `blockers` instead.
create or replace function public.generate_workspace_daily_snapshot(
  p_workspace_id uuid,
  p_report_start timestamptz,
  p_report_end timestamptz,
  p_timezone text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_workspace_name text;
  v_snapshot jsonb;
begin
  if auth.role() <> 'service_role' then
    if auth.uid() is null then
      raise exception 'not authenticated';
    end if;
    if not exists (
      select 1 from public.workspace_members
      where workspace_id = p_workspace_id and user_id = auth.uid()
    ) then
      raise exception 'not a member of this workspace';
    end if;
  end if;

  if p_report_end <= p_report_start then
    raise exception 'report_end must be after report_start';
  end if;

  select name into v_workspace_name
    from public.workspaces where id = p_workspace_id;
  if v_workspace_name is null then
    raise exception 'workspace not found';
  end if;

  with entries as (
    select
      te.user_id,
      te.task_id,
      greatest(te.started_at, p_report_start) as clamped_start,
      least(coalesce(te.ended_at, now()), p_report_end) as clamped_end
    from public.task_time_entries te
    where te.workspace_id = p_workspace_id
      and te.task_kind = 'workspace'
      and te.started_at < p_report_end
      and coalesce(te.ended_at, now()) > p_report_start
  ),
  seconds_per_user_task as (
    select
      user_id,
      task_id,
      round(sum(extract(epoch from (clamped_end - clamped_start))))::bigint as focused_seconds
    from entries
    where clamped_end > clamped_start
    group by user_id, task_id
  ),

  progress_events as (
    select
      te.actor_id as user_id,
      te.task_id,
      te.created_at,
      nullif(te.metadata ->> 'from', '')::int as from_value,
      nullif(te.metadata ->> 'to', '')::int as to_value
    from public.task_events te
    where te.workspace_id = p_workspace_id
      and te.event_type = 'progress_changed'
      and te.task_id is not null
      and te.created_at >= p_report_start and te.created_at < p_report_end
  ),
  progress_bounds as (
    select
      user_id,
      task_id,
      (array_agg(from_value order by created_at asc))[1] as progress_start,
      (array_agg(to_value order by created_at desc))[1] as progress_end
    from progress_events
    group by user_id, task_id
  ),

  task_touchpoints as (
    select user_id, task_id from seconds_per_user_task
    union
    select user_id, task_id from progress_bounds
  ),
  task_rows as (
    select
      tt.user_id,
      tt.task_id,
      coalesce(wt.title, del.title, 'Deleted task') as name,
      wt.parent_task_id,
      coalesce(parent.title, del.parent_title) as parent_title,
      wt.goal_id,
      g.name as goal_name,
      case
        when wt.status = 'completed' then 'completed'
        when wt.status = 'skipped' then 'skipped'
        else 'in_progress'
      end as status,
      coalesce(sput.focused_seconds, 0) as focused_seconds,
      pb.progress_start,
      pb.progress_end
    from task_touchpoints tt
    left join public.workspace_tasks wt on wt.id = tt.task_id
    left join public.workspace_tasks parent on parent.id = wt.parent_task_id
    left join public.goals g on g.id = wt.goal_id
    left join seconds_per_user_task sput on sput.user_id = tt.user_id and sput.task_id = tt.task_id
    left join progress_bounds pb on pb.user_id = tt.user_id and pb.task_id = tt.task_id
    left join lateral (
      select
        te.metadata ->> 'title' as title,
        te.metadata ->> 'parent_title' as parent_title
      from public.task_events te
      where te.task_id = tt.task_id and te.event_type = 'deleted'
      order by te.created_at desc
      limit 1
    ) del on true
  ),

  member_events_raw as (
    select
      te.actor_id as user_id,
      te.event_type as type,
      te.created_at as ts,
      te.task_id,
      coalesce(te.metadata ->> 'title', wt.title) as task_title,
      coalesce(te.metadata ->> 'parent_title', parent.title) as parent_title,
      te.metadata
    from public.task_events te
    left join public.workspace_tasks wt on wt.id = te.task_id
    left join public.workspace_tasks parent on parent.id = wt.parent_task_id
    where te.workspace_id = p_workspace_id
      and te.created_at >= p_report_start and te.created_at < p_report_end
      and te.event_type not in (
        'member_invited', 'invitation_accepted', 'invitation_rejected',
        'invitation_cancelled', 'member_joined', 'member_removed'
      )
  ),

  invitation_activity as (
    select
      wi.invited_by as user_id,
      'invitation_sent'::text as type,
      coalesce(wi.responded_at, wi.created_at) as ts,
      null::uuid as task_id,
      null::text as task_title,
      null::text as parent_title,
      jsonb_build_object('invited_email', wi.invited_email, 'status', wi.status) as metadata,
      wi.invited_email,
      wi.status,
      wi.responded_at,
      wi.invited_by
    from public.workspace_invitations wi
    where wi.workspace_id = p_workspace_id
      and (
        (wi.created_at >= p_report_start and wi.created_at < p_report_end)
        or (wi.responded_at is not null and wi.responded_at >= p_report_start and wi.responded_at < p_report_end)
      )
  ),

  member_events_combined as (
    select user_id, type, ts, task_id, task_title, parent_title, metadata
    from member_events_raw
    union all
    select user_id, type, ts, task_id, task_title, parent_title, metadata
    from invitation_activity
  ),
  member_events as (
    select
      user_id,
      jsonb_agg(
        jsonb_build_object(
          'type', type,
          'timestamp', ts,
          'task_id', task_id,
          'task_title', task_title,
          'parent_title', parent_title,
          'metadata', metadata
        )
        order by ts asc
      ) as events
    from member_events_combined
    group by user_id
  ),

  task_activity_by_member as (
    select
      user_id,
      jsonb_agg(
        jsonb_build_object(
          'task_id', task_id,
          'title', name,
          'parent_task_id', parent_task_id,
          'parent_title', parent_title,
          'goal_id', goal_id,
          'goal_name', goal_name,
          'focused_seconds', focused_seconds,
          'progress_start', progress_start,
          'progress_end', progress_end,
          'status_end', status
        )
        order by focused_seconds desc
      ) as task_activity
    from task_rows
    group by user_id
  ),

  all_member_ids as (
    select user_id from seconds_per_user_task
    union
    select user_id from member_events
    union
    select user_id from task_activity_by_member
  ),
  member_rows as (
    select
      am.user_id,
      coalesce(p.full_name, p.email, 'Member') as display_name,
      coalesce((select sum(focused_seconds) from seconds_per_user_task s where s.user_id = am.user_id), 0)::bigint
        as focused_seconds,
      coalesce(me.events, '[]'::jsonb) as events,
      coalesce(tam.task_activity, '[]'::jsonb) as task_activity
    from all_member_ids am
    join public.profiles p on p.id = am.user_id
    left join member_events me on me.user_id = am.user_id
    left join task_activity_by_member tam on tam.user_id = am.user_id
  ),

  invitations_that_day as (
    select
      wi.invited_email,
      wi.invited_by as invited_by_user_id,
      coalesce(p.full_name, p.email, 'Member') as invited_by_name,
      wi.status,
      wi.responded_at
    from public.workspace_invitations wi
    join public.profiles p on p.id = wi.invited_by
    where wi.workspace_id = p_workspace_id
      and (
        (wi.created_at >= p_report_start and wi.created_at < p_report_end)
        or (wi.responded_at is not null and wi.responded_at >= p_report_start and wi.responded_at < p_report_end)
      )
  ),
  members_joined_that_day as (
    select wm.user_id, coalesce(p.full_name, p.email, 'Member') as display_name
    from public.workspace_members wm
    join public.profiles p on p.id = wm.user_id
    where wm.workspace_id = p_workspace_id
      and wm.joined_at >= p_report_start and wm.joined_at < p_report_end
  ),
  members_removed_that_day as (
    select
      (te.metadata ->> 'removed_user_id')::uuid as user_id,
      coalesce(te.metadata ->> 'removed_display_name', 'Member') as display_name
    from public.task_events te
    where te.workspace_id = p_workspace_id
      and te.event_type = 'member_removed'
      and te.created_at >= p_report_start and te.created_at < p_report_end
  ),
  task_event_counts as (
    select
      count(*) filter (where event_type = 'created') as tasks_created,
      count(*) filter (where event_type = 'completed') as tasks_completed,
      count(*) filter (where event_type = 'skipped') as tasks_skipped,
      count(*) filter (where event_type = 'deleted') as tasks_deleted
    from public.task_events
    where workspace_id = p_workspace_id
      and created_at >= p_report_start and created_at < p_report_end
  ),

  blockers_in_window as (
    select
      b.id,
      b.task_id,
      wt.title as task_title,
      parent.title as parent_title,
      wt.goal_id,
      g.name as goal_name,
      b.reason,
      b.created_by,
      coalesce(nullif(btrim(cp.full_name), ''), cp.email, 'Member') as created_by_name,
      b.created_at,
      (b.resolved_at is not null and b.resolved_at < p_report_end) as resolved_in_window,
      b.resolved_at,
      b.resolved_by,
      coalesce(nullif(btrim(rp.full_name), ''), rp.email, 'Member') as resolved_by_name,
      b.resolution_note,
      round(extract(epoch from (
        least(coalesce(b.resolved_at, p_report_end), p_report_end)
        - greatest(b.created_at, p_report_start)
      )))::bigint as blocked_seconds
    from public.task_blockers b
    join public.workspace_tasks wt on wt.id = b.task_id
    left join public.workspace_tasks parent on parent.id = wt.parent_task_id
    left join public.goals g on g.id = wt.goal_id
    left join public.profiles cp on cp.id = b.created_by
    left join public.profiles rp on rp.id = b.resolved_by
    where b.workspace_id = p_workspace_id
      and b.created_at < p_report_end
      and (b.resolved_at is null or b.resolved_at > p_report_start)
  )

  select jsonb_build_object(
    'workspace_id', p_workspace_id,
    'workspace_name', v_workspace_name,
    'report_start', p_report_start,
    'report_end', p_report_end,
    'timezone', p_timezone,
    'total_focused_seconds', coalesce((select sum(focused_seconds) from member_rows), 0),
    'members', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'user_id', mr.user_id,
          'display_name', mr.display_name,
          'focused_seconds', mr.focused_seconds,
          'events', mr.events,
          'task_activity', mr.task_activity
        )
        order by mr.focused_seconds desc
      ) from member_rows mr),
      '[]'::jsonb
    ),
    'workspace_changes', jsonb_build_object(
      'invitations', coalesce(
        (select jsonb_agg(
          jsonb_build_object(
            'invited_email', i.invited_email,
            'invited_by_user_id', i.invited_by_user_id,
            'invited_by_name', i.invited_by_name,
            'status', i.status,
            'responded_at', i.responded_at
          )
        ) from invitations_that_day i),
        '[]'::jsonb
      ),
      'members_joined', coalesce(
        (select jsonb_agg(jsonb_build_object('user_id', j.user_id, 'display_name', j.display_name))
         from members_joined_that_day j),
        '[]'::jsonb
      ),
      'members_removed', coalesce(
        (select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'display_name', r.display_name))
         from members_removed_that_day r),
        '[]'::jsonb
      ),
      'tasks_created', (select coalesce(tasks_created, 0) from task_event_counts),
      'tasks_completed', (select coalesce(tasks_completed, 0) from task_event_counts),
      'tasks_skipped', (select coalesce(tasks_skipped, 0) from task_event_counts),
      'tasks_deleted', (select coalesce(tasks_deleted, 0) from task_event_counts)
    ),
    'blockers', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'blocker_id', bw.id,
          'task_id', bw.task_id,
          'task_title', bw.task_title,
          'parent_title', bw.parent_title,
          'goal_id', bw.goal_id,
          'goal_name', bw.goal_name,
          'reason', bw.reason,
          'blocked_by_user_id', bw.created_by,
          'blocked_by_name', bw.created_by_name,
          'blocked_at', bw.created_at,
          'mentioned', coalesce(
            (select jsonb_agg(
              jsonb_build_object(
                'user_id', m.mentioned_user_id,
                'display_name', coalesce(nullif(btrim(mp.full_name), ''), mp.email, 'Member')
              )
              order by m.created_at
            )
            from public.task_blocker_mentions m
            join public.profiles mp on mp.id = m.mentioned_user_id
            where m.blocker_id = bw.id and m.removed_at is null),
            '[]'::jsonb
          ),
          'resolved_at', case when bw.resolved_in_window then bw.resolved_at end,
          'resolved_by_user_id', case when bw.resolved_in_window then bw.resolved_by end,
          'resolved_by_name', case when bw.resolved_in_window then bw.resolved_by_name end,
          'resolution_note', case when bw.resolved_in_window then bw.resolution_note end,
          'still_blocked_at_report_end', not bw.resolved_in_window,
          'blocked_seconds', greatest(bw.blocked_seconds, 0)
        )
        order by bw.created_at asc
      ) from blockers_in_window bw),
      '[]'::jsonb
    )
  ) into v_snapshot;

  return v_snapshot;
end;
$$;
