-- Phase 2 — Slack Integration Database & Security Schema
-- Creates workspace_slack_connections table with RLS and status RPC.

create table if not exists public.workspace_slack_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  slack_team_id text not null,
  slack_team_name text not null,
  bot_access_token text not null,
  bot_user_id text,
  channel_id text,
  channel_name text,
  connection_status text not null default 'connected' check (connection_status in ('connected', 'invalid_token', 'channel_missing', 'configuration_incomplete')),
  connected_by uuid references public.profiles(id) on delete set null,
  notification_settings jsonb not null default '{
    "assigned": true,
    "completed": true,
    "blockers": true,
    "resolutions": true,
    "mentions": true,
    "daily_reports": true
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_slack_connections enable row level security;

-- Policy: Workspace members can select Slack connection rows
create policy "workspace_slack_connections_select" on public.workspace_slack_connections
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_slack_connections.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Policy: Only Workspace Owner or Admin can insert/update/delete Slack connections
create policy "workspace_slack_connections_insert_owner_admin" on public.workspace_slack_connections
  for insert with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_slack_connections.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "workspace_slack_connections_update_owner_admin" on public.workspace_slack_connections
  for update using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_slack_connections.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "workspace_slack_connections_delete_owner_admin" on public.workspace_slack_connections
  for delete using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_slack_connections.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

grant select, insert, update, delete on public.workspace_slack_connections to authenticated;

-- Table for tracking event delivery idempotency and duplicate prevention (Phase 11)
create table if not exists public.workspace_slack_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id text not null,
  event_type text not null,
  delivered_at timestamptz not null default now(),
  unique (workspace_id, event_id, event_type)
);

alter table public.workspace_slack_deliveries enable row level security;
grant select, insert on public.workspace_slack_deliveries to authenticated;

-- Helper RPC to safely return Slack status without exposing bot_access_token (Phase 14)
create or replace function public.get_workspace_slack_status(p_workspace_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_conn record;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select role into v_role from public.workspace_members
    where workspace_id = p_workspace_id and user_id = v_user_id;

  if v_role is null then
    raise exception 'not a member of this workspace';
  end if;

  select id, workspace_id, slack_team_id, slack_team_name, channel_id, channel_name, connection_status, connected_by, notification_settings, created_at, updated_at
    into v_conn
    from public.workspace_slack_connections
    where workspace_id = p_workspace_id;

  if not found then
    return jsonb_build_object(
      'connected', false,
      'connection_status', 'disconnected',
      'can_manage', (v_role in ('owner', 'admin'))
    );
  end if;

  v_status := v_conn.connection_status;
  if v_conn.channel_id is null or v_conn.channel_id = '' then
    v_status := 'configuration_incomplete';
  end if;

  return jsonb_build_object(
    'connected', true,
    'id', v_conn.id,
    'slack_team_id', v_conn.slack_team_id,
    'slack_team_name', v_conn.slack_team_name,
    'channel_id', v_conn.channel_id,
    'channel_name', v_conn.channel_name,
    'connection_status', v_status,
    'notification_settings', v_conn.notification_settings,
    'can_manage', (v_role in ('owner', 'admin'))
  );
end;
$$;

grant execute on function public.get_workspace_slack_status(uuid) to authenticated;

-- Phase 6 & Phase 7 — Postgres triggers for async Slack event dispatch via pg_net
create or replace function public.dispatch_slack_from_task_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_target_url text;
  v_has_conn boolean;
begin
  select exists (
    select 1 from public.workspace_slack_connections
    where workspace_id = new.workspace_id and channel_id is not null and channel_id <> ''
  ) into v_has_conn;

  if not v_has_conn then
    return new;
  end if;

  if new.event_type not in (
    'assigned', 'reassigned', 'completed', 'reopened',
    'blocker_created', 'blocker_resolved', 'task_unblocked'
  ) then
    return new;
  end if;

  select target_url into v_target_url from public.app_cron_config limit 1;
  if v_target_url is not null and v_target_url <> '' then
    v_target_url := regexp_replace(v_target_url, '/api/cron/daily-reports.*$', '/api/integrations/slack/dispatch');
  end if;

  if v_target_url is null or v_target_url = '' then
    v_target_url := 'http://localhost:3000/api/integrations/slack/dispatch';
  end if;

  begin
    perform net.http_post(
      url := v_target_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'workspaceId', new.workspace_id,
        'eventType', new.event_type,
        'taskId', new.task_id,
        'taskTitle', coalesce(new.metadata->>'title', 'A task'),
        'actorId', new.actor_id,
        'recipientUserId', new.metadata->>'to_user_id',
        'blockerReason', new.metadata->>'reason'
      )
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_slack_task_events on public.task_events;
create trigger trg_slack_task_events
  after insert on public.task_events
  for each row execute function public.dispatch_slack_from_task_event();

create or replace function public.dispatch_slack_from_daily_summary()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_target_url text;
  v_has_conn boolean;
begin
  if new.generation_status <> 'completed' or (TG_OP = 'UPDATE' and old.generation_status = 'completed') then
    return new;
  end if;

  select exists (
    select 1 from public.workspace_slack_connections
    where workspace_id = new.workspace_id and channel_id is not null and channel_id <> ''
  ) into v_has_conn;

  if not v_has_conn then
    return new;
  end if;

  select target_url into v_target_url from public.app_cron_config limit 1;
  if v_target_url is not null and v_target_url <> '' then
    v_target_url := regexp_replace(v_target_url, '/api/cron/daily-reports.*$', '/api/integrations/slack/dispatch');
  end if;

  if v_target_url is null or v_target_url = '' then
    v_target_url := 'http://localhost:3000/api/integrations/slack/dispatch';
  end if;

  begin
    perform net.http_post(
      url := v_target_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'workspaceId', new.workspace_id,
        'eventType', 'daily_report_ready',
        'reportId', new.id
      )
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_slack_daily_summaries on public.workspace_daily_summaries;
create trigger trg_slack_daily_summaries
  after insert or update on public.workspace_daily_summaries
  for each row execute function public.dispatch_slack_from_daily_summary();

