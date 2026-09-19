-- Task Fixes: Nullable Planned Time, Strict Completion Permissions & Reopen Function
-- Run this once in Supabase Dashboard → SQL Editor, after 0001-0043.

-- 1. Make planned_seconds optional (nullable) on workspace_tasks
alter table public.workspace_tasks alter column planned_seconds drop not null;
alter table public.workspace_tasks alter column planned_seconds set default null;

-- 2. Update timer / completion controller rule:
-- An assigned task is controlled ONLY by its assignee.
-- An unassigned task (p_assigned_to is null) in any workspace can be controlled by any member of that workspace.
create or replace function public.is_workspace_task_timer_controller(
  p_workspace_id uuid, p_assigned_to uuid, p_user_id uuid
)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    p_user_id is not null
    and exists (
      select 1 from public.workspace_members
      where workspace_id = p_workspace_id and user_id = p_user_id
    )
    and (
      p_assigned_to = p_user_id
      or p_assigned_to is null
    ),
    false
  );
$$;

grant execute on function public.is_workspace_task_timer_controller(uuid, uuid, uuid) to authenticated;

-- 3. Enforce completion permissions regardless of task status
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

  -- Only the assigned member (or member on an unassigned task) may complete/skip it
  perform public.assert_workspace_task_timer_controller(v_workspace_id, v_assigned_to, v_user_id);
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
    set status = case when p_skip then 'skipped' else 'completed' end,
        started_at = null,
        actual_seconds = actual_seconds + v_duration,
        completed_at = now()
    where id = p_task_id
    returning * into v_result;

  insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata)
    values (p_task_id, v_workspace_id, v_goal_id, v_user_id,
      case when p_skip then 'skipped' else 'completed' end,
      jsonb_build_object('title', v_result.title));

  -- Unblock dependent tasks if this was in a Goal
  if v_goal_id is not null then
    for v_dep in
      select td.blocked_task_id, wt.title, wt.workspace_id
      from public.task_dependencies td
      join public.workspace_tasks wt on wt.id = td.blocked_task_id
      where td.blocking_task_id = p_task_id
    loop
      if not exists (
        select 1
        from public.task_dependencies td2
        join public.workspace_tasks bt on bt.id = td2.blocking_task_id
        where td2.blocked_task_id = v_dep.blocked_task_id
          and bt.status not in ('completed', 'skipped')
      ) then
        insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata)
          values (v_dep.blocked_task_id, v_dep.workspace_id, v_goal_id, v_user_id, 'task_unblocked',
            jsonb_build_object('title', v_dep.title));
      end if;
    end loop;
  end if;

  return v_result;
end;
$$;

grant execute on function public.complete_workspace_task(uuid, boolean) to authenticated;

-- 4. Reopen a completed or skipped task (moves back to queued without starting timer)
create or replace function public.reopen_workspace_task(p_task_id uuid)
returns public.workspace_tasks
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_goal_id uuid;
  v_assigned_to uuid;
  v_status text;
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
  perform set_config('ontask.timer_write', 'on', true);

  update public.workspace_tasks
    set status = 'queued',
        started_at = null,
        completed_at = null
    where id = p_task_id
    returning * into v_result;

  insert into public.task_events (task_id, workspace_id, goal_id, actor_id, event_type, metadata)
    values (p_task_id, v_workspace_id, v_goal_id, v_user_id, 'reopened',
      jsonb_build_object('title', v_result.title));

  return v_result;
end;
$$;

grant execute on function public.reopen_workspace_task(uuid) to authenticated;

-- 5. Fix auto_complete_workspace_task to safely handle nullable planned_seconds:
-- A task with no planned time (planned_seconds is null) is NEVER auto-completed.
create or replace function public.auto_complete_workspace_task(
  p_task_id uuid,
  p_expected_started_at timestamptz
)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.workspace_tasks%rowtype;
  v_result public.workspace_tasks%rowtype;
  v_same_run boolean;
  v_worked numeric;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_task from public.workspace_tasks where id = p_task_id for update;
  if not found then
    return jsonb_build_object('outcome', 'not_found', 'task', null);
  end if;

  if v_task.status <> 'working' then
    return jsonb_build_object('outcome', 'not_running', 'task', to_jsonb(v_task));
  end if;

  v_same_run :=
    (v_task.started_at is null and p_expected_started_at is null)
    or (
      v_task.started_at is not null
      and p_expected_started_at is not null
      and abs(extract(epoch from (v_task.started_at - p_expected_started_at))) <= 0.001
    );
  if not v_same_run then
    return jsonb_build_object('outcome', 'different_run', 'task', to_jsonb(v_task));
  end if;

  -- Time worked so far: what was booked before this run, plus this run so far,
  -- on the database's clock (not the browser's, which may be minutes off).
  v_worked := v_task.actual_seconds
    + case
        when v_task.started_at is null then 0
        else greatest(0, extract(epoch from (now() - v_task.started_at)))
      end;

  -- A task with no planned time, or whose worked time has not reached planned_seconds, is NOT due.
  if v_task.planned_seconds is null or v_worked < v_task.planned_seconds then
    return jsonb_build_object('outcome', 'not_due', 'task', to_jsonb(v_task));
  end if;

  -- Only the timer's own controller completes it, as for every timer action.
  perform public.assert_workspace_task_timer_controller(
    v_task.workspace_id, v_task.assigned_to, v_user_id
  );

  select * into v_result from public.complete_workspace_task(p_task_id, false);
  return jsonb_build_object('outcome', 'completed', 'task', to_jsonb(v_result));
end;
$$;

revoke all on function public.auto_complete_workspace_task(uuid, timestamptz)
  from public, anon;
grant execute on function public.auto_complete_workspace_task(uuid, timestamptz)
  to authenticated;

