-- Manual verification for migration 0040.
-- Run in a scratch/staging project after migrations 0001-0040.
-- This verifies one active timer per user per workspace, rather than one
-- active timer globally across all workspaces.

do $$
declare
  v_user uuid := gen_random_uuid();
  v_ws_one uuid;
  v_ws_two uuid;
  v_task_one uuid;
  v_task_one_again uuid;
  v_task_two uuid;
  v_status_one text;
  v_status_one_again text;
  v_status_two text;
  v_open int;
begin
  insert into auth.users (id, email)
    values (v_user, 'workspace-scope-timer.test@example.com');

  insert into public.workspaces (name, owner_id, timezone)
    values ('Timer Scope One', v_user, 'UTC')
    returning id into v_ws_one;
  insert into public.workspaces (name, owner_id, timezone)
    values ('Timer Scope Two', v_user, 'UTC')
    returning id into v_ws_two;

  insert into public.workspace_tasks
    (workspace_id, created_by, assigned_to, title, planned_seconds, position)
    values (v_ws_one, v_user, v_user, 'Workspace one task', 3600, 1000)
    returning id into v_task_one;
  insert into public.workspace_tasks
    (workspace_id, created_by, assigned_to, title, planned_seconds, position)
    values (v_ws_one, v_user, v_user, 'Workspace one replacement', 3600, 2000)
    returning id into v_task_one_again;
  insert into public.workspace_tasks
    (workspace_id, created_by, assigned_to, title, planned_seconds, position)
    values (v_ws_two, v_user, v_user, 'Workspace two task', 3600, 1000)
    returning id into v_task_two;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  perform public.start_workspace_task(v_task_one);
  perform public.start_workspace_task(v_task_two);

  select status into v_status_one from public.workspace_tasks where id = v_task_one;
  select status into v_status_two from public.workspace_tasks where id = v_task_two;
  select count(*) into v_open
    from public.task_time_entries
    where user_id = v_user and ended_at is null;

  if v_status_one <> 'working' or v_status_two <> 'working' or v_open <> 2 then
    raise exception
      'timers in separate workspaces did not remain open (%, %, open %)',
      v_status_one, v_status_two, v_open;
  end if;
  raise notice 'workspace timers can run independently';

  perform public.start_workspace_task(v_task_one_again);

  select status into v_status_one from public.workspace_tasks where id = v_task_one;
  select status into v_status_one_again from public.workspace_tasks where id = v_task_one_again;
  select status into v_status_two from public.workspace_tasks where id = v_task_two;
  select count(*) into v_open
    from public.task_time_entries
    where user_id = v_user and ended_at is null;

  if v_status_one <> 'paused'
     or v_status_one_again <> 'working'
     or v_status_two <> 'working'
     or v_open <> 2 then
    raise exception
      'starting a task did not stay scoped to its workspace (%, %, %, open %)',
      v_status_one, v_status_one_again, v_status_two, v_open;
  end if;
  raise notice 'starting another task pauses only the current workspace timer';
end;
$$;

delete from auth.users where email = 'workspace-scope-timer.test@example.com';
