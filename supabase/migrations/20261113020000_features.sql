-- Features: edited flexes, live notifications, reports with auto-hide, faster search.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Edited flexes: the database stamps edited_at whenever the content changes
-- ---------------------------------------------------------------------------
alter table public.posts add column edited_at timestamptz;

create function public.stamp_post_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.title, new.body, new.link, new.skill_slug) is distinct from (old.title, old.body, old.link, old.skill_slug) then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger posts_stamp_edit before update on public.posts
  for each row execute function public.stamp_post_edit();

-- ---------------------------------------------------------------------------
-- Reports: three different people reporting a flex hides it for everyone
-- except its author, until someone reviews it in the dashboard
-- ---------------------------------------------------------------------------
alter table public.posts add column hidden boolean not null default false;

create table public.reports (
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'not-theirs', 'offensive', 'other')),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

create function public.hide_reported_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.reports where post_id = new.post_id) >= 3 then
    update public.posts set hidden = true where id = new.post_id;
  end if;
  return null;
end;
$$;

create trigger reports_hide after insert on public.reports
  for each row execute function public.hide_reported_post();

revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (post_id, reason) on public.reports to authenticated;
alter table public.reports enable row level security;

create policy "see your own reports" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy "report as yourself, not your own flex" on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and not exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );

drop policy "posts are public" on public.posts;
create policy "posts are public unless hidden" on public.posts for select to anon, authenticated
  using (not hidden or author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Notifications: likes, comments and follows on your things, made by triggers
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('like', 'comment', 'follow')),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_inbox_idx on public.notifications (recipient_id, created_at desc);
-- One like/follow notification per person and flex, however often they toggle.
create unique index notifications_once_idx on public.notifications (recipient_id, actor_id, kind, coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where kind in ('like', 'follow');

create function public.notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if tg_table_name = 'likes' then
    select author_id into owner from public.posts where id = new.post_id;
    if owner is not null and owner <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id)
      values (owner, new.user_id, 'like', new.post_id)
      on conflict do nothing;
    end if;
  elsif tg_table_name = 'comments' then
    select author_id into owner from public.posts where id = new.post_id;
    if owner is not null and owner <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id, comment_id)
      values (owner, new.author_id, 'comment', new.post_id, new.id);
    end if;
  elsif tg_table_name = 'follows' then
    insert into public.notifications (recipient_id, actor_id, kind)
    values (new.following_id, new.follower_id, 'follow')
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger likes_notify after insert on public.likes
  for each row execute function public.notify();
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify();
create trigger follows_notify after insert on public.follows
  for each row execute function public.notify();

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
alter table public.notifications enable row level security;

create policy "read your own notifications" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "mark your own notifications read" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy "clear your own notifications" on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

revoke execute on function public.notify() from public, anon, authenticated;
revoke execute on function public.hide_reported_post() from public, anon, authenticated;

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Search: trigram indexes keep "contains" searches fast as the site grows
-- ---------------------------------------------------------------------------
create index posts_title_trgm_idx on public.posts using gin (title extensions.gin_trgm_ops);
create index profiles_username_trgm_idx on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_name_trgm_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);
