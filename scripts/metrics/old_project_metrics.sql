-- ============================================================================
-- Evidence of Life — read-only usage metrics (OLD Supabase project)
-- ----------------------------------------------------------------------------
-- Run this against the OLD project (the one used before the account switch).
-- It is intentionally IDENTICAL to new_project_metrics.sql so the two result
-- rows are directly comparable. Merge per metric-definitions.md.
--
-- To avoid DOUBLE COUNTING users who exist in BOTH projects, the merge step
-- (not this file) must dedupe on a stable identity (email hash / user id) and
-- apply the account-switch boundary date. This file only produces one project's
-- aggregates; it does not merge.
--
-- SAFE: SELECT-only, aggregate-only, no user content.
-- ============================================================================

with excluded_users as (
  select id
  from auth.users
  where lower(email) = any (array[
    'REPLACE_MAINTAINER_EMAIL@example.com'
  ])
),
registered as (
  select u.id, u.created_at, u.last_sign_in_at
  from auth.users u
  where u.id not in (select id from excluded_users)
),
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
user_active_days as (
  select user_id, count(distinct date) as active_days
  from activity_ext
  group by user_id
),
active_30 as (
  select distinct user_id
  from activity_ext
  where created_at >= now() - interval '30 days'
)
select
  (select count(*) from registered)                              as registered_users,
  (select count(*) from active_30)                               as active_users_30d,
  (select count(*) from user_active_days where active_days >= 2) as returning_users,
  (select count(*) from public.todos   where user_id in (select id from registered)) as tasks_created,
  (select count(*) from public.moments where user_id in (select id from registered)) as moments_captured,
  now() as computed_at;

-- OPTIONAL (for de-dup only): a privacy-preserving identity list so the merge
-- can detect users present in BOTH projects WITHOUT exposing emails.
-- Returns only salted hashes, never raw emails.
-- Replace 'REPLACE_WITH_RANDOM_SALT' with the SAME salt used on both projects.
--
-- select encode(digest(lower(email) || 'REPLACE_WITH_RANDOM_SALT', 'sha256'), 'hex') as email_hash
-- from auth.users
-- where email is not null;
