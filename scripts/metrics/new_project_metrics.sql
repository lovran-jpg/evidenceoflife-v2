-- ============================================================================
-- Evidence of Life — read-only usage metrics (single Supabase project)
-- ----------------------------------------------------------------------------
-- SAFE: SELECT-only, aggregate-only. Returns NO names, emails, task/note text,
-- photos, coordinates, or calendar content. Run in the Supabase SQL Editor.
--
-- Run this file against the NEW (current) project. Run the identical file
-- `old_project_metrics.sql` against the OLD project. Then merge with the
-- account-switch boundary (see metric-definitions.md) to avoid double counting.
--
-- BEFORE RUNNING: fill in the two config values below.
-- ============================================================================

-- 1) Accounts to EXCLUDE from counts (maintainer / admin / test / duplicates).
--    Put the real emails here. Aggregate output still exposes no emails.
with excluded_users as (
  select id
  from auth.users
  where lower(email) = any (array[
    'REPLACE_MAINTAINER_EMAIL@example.com'
    -- , 'test1@example.com'
    -- , 'test2@example.com'
  ])
),

-- 2) Registered users (canonical source = auth.users), excluding the above.
registered as (
  select u.id, u.created_at, u.last_sign_in_at
  from auth.users u
  where u.id not in (select id from excluded_users)
),

-- Union of "activity" events across the primary user-generated tables.
-- We only read user_id + created_at + date (local day). No content columns.
activity as (
  select user_id, created_at, date from public.todos
  union all
  select user_id, created_at, date from public.moments
),
activity_ext as (
  select a.user_id, a.created_at, a.date
  from activity a
  where a.user_id in (select id from registered)
),

-- Distinct local-active-days per user (uses the app's own `date` column,
-- which is the user's local calendar day — avoids timezone drift).
user_active_days as (
  select user_id, count(distinct date) as active_days
  from activity_ext
  group by user_id
),

-- Users active in the last 30 days (by event created_at).
active_30 as (
  select distinct user_id
  from activity_ext
  where created_at >= now() - interval '30 days'
)

select
  (select count(*) from registered)                                   as registered_users,
  (select count(*) from active_30)                                    as active_users_30d,
  (select count(*) from user_active_days where active_days >= 2)      as returning_users,
  (select count(*) from registered where last_sign_in_at >= now() - interval '30 days')
                                                                      as signed_in_30d,
  (select count(*) from public.todos     where user_id in (select id from registered)) as tasks_created,
  (select count(*) from public.todos     where user_id in (select id from registered) and is_completed) as tasks_completed,
  (select count(*) from public.moments   where user_id in (select id from registered)) as moments_captured,
  (select count(*) from public.todos     where user_id in (select id from registered) and timer_seconds is not null and timer_seconds > 0) as focus_sessions,
  (select coalesce(round(sum(timer_seconds)/60.0), 0) from public.todos where user_id in (select id from registered) and timer_seconds is not null) as focus_minutes,
  (select count(*) from public.sticky_note_items where user_id in (select id from registered)) as note_items,
  (select count(*) from public.imported_events where user_id in (select id from registered)) as calendar_events_synced,
  now() as computed_at;
