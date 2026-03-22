-- Migration: 0005_short_invite_tokens
--
-- Replaces 32-char hex invite tokens with 6-char uppercase alphanumeric tokens.
-- Excludes visually ambiguous characters: O, 0, I, 1.
-- Adds a shared token generator function usable by future invite tables (e.g. group_invites).

create or replace function public.generate_short_token()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- Update the default token generator on friend_invites
alter table public.friend_invites
  alter column token set default public.generate_short_token();
