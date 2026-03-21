-- Update handle_new_user() to extract display_name from OAuth providers.
-- Google puts the user's name in raw_user_meta_data->>'full_name',
-- other providers may use 'name'. Add these as fallbacks.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      ''
    )
  );
  return new;
end;
$$;
