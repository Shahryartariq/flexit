-- Hardening from the November audit:
-- 1. A hidden flex is hidden everywhere: no new likes, comments or reports on it,
--    and its likes and comments aren't readable by anyone but its author.
-- 2. Rate limits for likes, follows and reports, so scripts can't flood
--    notifications or the report queue.
-- 3. Only accounts older than a day count towards hiding a flex, so three
--    throwaway sign-ups can't take someone's post down.

-- ---------------------------------------------------------------------------
-- 1. Hidden flexes
-- ---------------------------------------------------------------------------
-- The sub-selects run with the caller's rights, so the posts policy
-- ("not hidden or author") decides what counts as visible.
drop policy "likes are public" on public.likes;
create policy "likes on visible flexes are public" on public.likes for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

drop policy "like as yourself" on public.likes;
create policy "like visible flexes as yourself" on public.likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy "comments are public" on public.comments;
create policy "comments on visible flexes are public" on public.comments for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

drop policy "comment as yourself" on public.comments;
create policy "comment on visible flexes as yourself" on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy "report as yourself, not your own flex" on public.reports;
create policy "report visible flexes, not your own" on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.author_id <> (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 2. Rate limits (same trigger as posts and comments)
-- ---------------------------------------------------------------------------
create index if not exists follows_follower_idx on public.follows (follower_id, created_at);
create index if not exists likes_user_created_idx on public.likes (user_id, created_at);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at);

create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
begin
  if tg_table_name = 'posts' then
    select count(*) into recent from public.posts
      where author_id = new.author_id and created_at > now() - interval '1 hour';
    if recent >= 10 then
      raise exception 'Slow down: you can post 10 flexes an hour.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'comments' then
    select count(*) into recent from public.comments
      where author_id = new.author_id and created_at > now() - interval '10 minutes';
    if recent >= 30 then
      raise exception 'Slow down: you can add 30 comments every 10 minutes.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'likes' then
    select count(*) into recent from public.likes
      where user_id = new.user_id and created_at > now() - interval '1 hour';
    if recent >= 300 then
      raise exception 'Slow down: you can like 300 flexes an hour.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'follows' then
    select count(*) into recent from public.follows
      where follower_id = new.follower_id and created_at > now() - interval '1 hour';
    if recent >= 100 then
      raise exception 'Slow down: you can follow 100 people an hour.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'reports' then
    select count(*) into recent from public.reports
      where reporter_id = new.reporter_id and created_at > now() - interval '1 day';
    if recent >= 20 then
      raise exception 'Slow down: you can send 20 reports a day.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

create trigger likes_rate_limit before insert on public.likes
  for each row execute function public.enforce_rate_limit();
create trigger follows_rate_limit before insert on public.follows
  for each row execute function public.enforce_rate_limit();
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.enforce_rate_limit();

-- ---------------------------------------------------------------------------
-- 3. Reports only hide a flex when they come from established accounts
-- ---------------------------------------------------------------------------
create or replace function public.hide_reported_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.reports r
    join public.profiles pr on pr.id = r.reporter_id
    where r.post_id = new.post_id
      and pr.created_at < now() - interval '1 day'
  ) >= 3 then
    update public.posts set hidden = true where id = new.post_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.hide_reported_post() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lets the edge tell a missing flex (real 404) from a hidden one (the
--    author can still open it). Answers yes/no only.
-- ---------------------------------------------------------------------------
create function public.flex_exists(flex_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.posts where id = flex_id);
$$;

revoke execute on function public.flex_exists(uuid) from public;
grant execute on function public.flex_exists(uuid) to anon, authenticated;
