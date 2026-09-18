-- Allow one active timer per user in each workspace.
-- Run this once in Supabase Dashboard -> SQL Editor, after 0039.
--
-- A user's Personal Workspace and shared workspaces are independent timer
-- contexts. Starting a task still pauses the user's other task in that same
-- workspace, but it no longer stops timers in other workspaces.

drop index if exists public.task_time_entries_one_open_per_user;

create unique index task_time_entries_one_open_per_workspace
  on public.task_time_entries (user_id, workspace_id)
  where ended_at is null and workspace_id is not null;

-- Keep legacy personal_tasks timers safe while older clients still use them.
create unique index task_time_entries_one_open_legacy_personal
  on public.task_time_entries (user_id)
  where ended_at is null and workspace_id is null;

-- Legacy personal-task timers must not stop a workspace timer. These rows have
-- no workspace_id because they predate Personal Workspace migration 0028.
create or replace function public.start_personal_task(p_task_id uuid)
returns public.personal_tasks
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_open_entry public.task_time_entries%rowtype;
  v_duration int;
  v_result public.personal_tasks%rowtype;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;

  select * into v_open_entry from public.task_time_entries
    where user_id = v_user_id
      and task_kind = 'personal'
      and workspace_id is null
      and ended_at is null
    for update;

  if found then
    v_duration := greatest(0, extract(epoch from (now() - v_open_entry.started_at))::int);
    update public.task_time_entries
      set ended_at = now(), duration_seconds = v_duration
      where id = v_open_entry.id;
    update public.personal_tasks
      set actual_seconds = actual_seconds + v_duration,
          status = case when id = p_task_id then status else 'paused' end,
          started_at = case when id = p_task_id then started_at else null end
      where id = v_open_entry.task_id;
  end if;

  insert into public.task_time_entries (task_id, task_kind, user_id, started_at)
    values (p_task_id, 'personal', v_user_id, now());

  update public.personal_tasks
    set status = 'working', started_at = now()
    where id = p_task_id and user_id = v_user_id
    returning * into v_result;

  if not found then raise exception 'task not found'; end if;
  return v_result;
end;
$$;

-- Rebuild the workspace start function with the workspace-scoped close.
create or replace function public.start_workspace_task(p_task_id uuid)
returns public.workspace_tasks
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_goal_id uuid;
  v_assigned_to uuid;
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

  select workspace_id, goal_id, assigned_to into v_workspace_id, v_goal_id, v_assigned_to
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

grant execute on function public.start_personal_task(uuid) to authenticated;
grant execute on function public.start_workspace_task(uuid) to authenticated;
