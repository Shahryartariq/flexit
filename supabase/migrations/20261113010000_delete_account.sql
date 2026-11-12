-- Lets a signed-in person delete their own account. Their profile, flexes,
-- likes, comments and follows go with it (all cascade from auth.users).
-- The app removes their uploaded images from Storage first.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Listing your own uploads (needed to clean them up before deleting the account).
create policy "list your own folder" on storage.objects for select to authenticated
  using (
    bucket_id in ('post-images', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
