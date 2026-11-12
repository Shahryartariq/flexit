-- Flexit schema: people post what they made, learned or achieved in any skill.
-- Every table is public to read. Writes go through row level security,
-- column grants and a few triggers that keep counters and rate limits honest.

-- ---------------------------------------------------------------------------
-- Skills (fixed list, seeded here so every environment has the same set)
-- ---------------------------------------------------------------------------
create table public.skills (
  slug text primary key check (slug ~ '^[a-z-]{2,30}$'),
  name text not null,
  emoji text not null,
  position int not null unique
);

insert into public.skills (slug, name, emoji, position) values
  ('development', 'Development', '💻', 1),
  ('design', 'Design', '🎨', 2),
  ('art', 'Art', '🖌️', 3),
  ('music', 'Music', '🎸', 4),
  ('gaming', 'Gaming', '🎮', 5),
  ('fitness', 'Fitness', '🏋️', 6),
  ('cooking', 'Cooking', '🍳', 7),
  ('writing', 'Writing', '✍️', 8),
  ('photography', 'Photography', '📷', 9),
  ('learning', 'Learning', '🎓', 10),
  ('business', 'Business', '📈', 11),
  ('other', 'Something else', '✨', 12);

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by a trigger on sign-up)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  headline text not null default '' check (char_length(headline) <= 80),
  bio text not null default '' check (char_length(bio) <= 280),
  avatar_path text check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/[A-Za-z0-9_-]{6,40}\.(webp|jpg|jpeg|png)$')
  ),
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := lower(coalesce(meta ->> 'username', ''));
  display text := left(btrim(coalesce(
    nullif(btrim(meta ->> 'display_name'), ''),
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    ''
  )), 50);
  base text;
  final text;
begin
  if wanted ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = wanted) then
    final := wanted;
  else
    -- OAuth sign-ups and taken names: derive one and add a short unique tail.
    base := left(regexp_replace(
      lower(coalesce(meta ->> 'user_name', split_part(coalesce(new.email, ''), '@', 1), '')),
      '[^a-z0-9_]', '', 'g'
    ), 14);
    if char_length(base) < 3 then
      base := 'maker';
    end if;
    final := base || '_' || substr(replace(new.id::text, '-', ''), 1, 5);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, final, coalesce(nullif(display, ''), final));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Posts ("flexes")
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  skill_slug text not null references public.skills (slug),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  body text not null default '' check (char_length(body) <= 1000),
  image_path text check (
    image_path is null
    or image_path ~ ('^' || author_id::text || '/[A-Za-z0-9_-]{6,40}\.(webp|jpg|jpeg|png)$')
  ),
  link text check (link is null or (link ~ '^https?://[^\s]+$' and char_length(link) <= 300)),
  like_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now()
);

create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_skill_idx on public.posts (skill_slug, created_at desc);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index likes_user_idx on public.likes (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id);

-- ---------------------------------------------------------------------------
-- Counters: like_count and comment_count are kept by triggers, never by clients
-- ---------------------------------------------------------------------------
create function public.bump_post_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  target uuid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  if tg_table_name = 'likes' then
    update public.posts set like_count = greatest(like_count + delta, 0) where id = target;
  else
    update public.posts set comment_count = greatest(comment_count + delta, 0) where id = target;
  end if;
  return null;
end;
$$;

create trigger likes_count after insert or delete on public.likes
  for each row execute function public.bump_post_counter();
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_post_counter();

-- ---------------------------------------------------------------------------
-- Rate limits (checked in the database, so they hold for every client)
-- ---------------------------------------------------------------------------
create function public.enforce_rate_limit()
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
  end if;
  return new;
end;
$$;

create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.enforce_rate_limit();
create trigger comments_rate_limit before insert on public.comments
  for each row execute function public.enforce_rate_limit();

-- ---------------------------------------------------------------------------
-- Privileges: clients may only write the columns they own
-- ---------------------------------------------------------------------------
revoke all on public.skills, public.profiles, public.posts, public.likes, public.comments, public.follows
  from anon, authenticated;

grant select on public.skills, public.profiles, public.posts, public.likes, public.comments, public.follows
  to anon, authenticated;

grant update (display_name, headline, bio, avatar_path) on public.profiles to authenticated;
grant insert (skill_slug, title, body, image_path, link) on public.posts to authenticated;
grant update (skill_slug, title, body, link) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant insert (post_id) on public.likes to authenticated;
grant delete on public.likes to authenticated;
grant insert (post_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant insert (following_id) on public.follows to authenticated;
grant delete on public.follows to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.bump_post_counter() from public, anon, authenticated;
revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.skills enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

create policy "skills are public" on public.skills for select to anon, authenticated using (true);

create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "edit your own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "posts are public" on public.posts for select to anon, authenticated using (true);
create policy "post as yourself" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "edit your own posts" on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "delete your own posts" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "likes are public" on public.likes for select to anon, authenticated using (true);
create policy "like as yourself" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "remove your own likes" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "comments are public" on public.comments for select to anon, authenticated using (true);
create policy "comment as yourself" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "delete your comments or comments on your posts" on public.comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );

create policy "follows are public" on public.follows for select to anon, authenticated using (true);
create policy "follow as yourself" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy "unfollow as yourself" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: public image buckets, each user writes only inside their own folder
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('post-images', 'post-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "upload into your own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('post-images', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "delete from your own folder" on storage.objects for delete to authenticated
  using (
    bucket_id in ('post-images', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Realtime: new flexes, counter changes and comments stream to the browser
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.posts, public.comments;
