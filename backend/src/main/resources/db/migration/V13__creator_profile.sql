-- V21-05 Creator earnings and public profile.

alter table creator_profiles add column handle text;
alter table creator_profiles add column location text check (char_length(location) <= 60);
-- Where payouts would go. Only the kind is stored: the account details come from the payout provider later.
alter table creator_profiles add column payout_method text check (payout_method in ('ABA', 'BANK'));

-- Handles for the creators that exist: the pen name in a-z 0-9 and "-", "creator" when nothing is left; the
-- second and later creators with the same base get a number.
with base as (
    select user_id, created_at,
           coalesce(nullif(trim(both '-' from regexp_replace(lower(pen_name), '[^a-z0-9]+', '-', 'g')), ''), 'creator') as b
    from creator_profiles
), ranked as (
    select user_id, b, row_number() over (partition by b order by created_at, user_id) as rn from base
)
update creator_profiles p
set handle = left(case when r.rn = 1 then r.b else r.b || '-' || r.rn end, 40)
from ranked r
where r.user_id = p.user_id;

alter table creator_profiles alter column handle set not null;
-- Code that does not choose one (older code paths, test data) still gets a valid, unique handle.
alter table creator_profiles alter column handle
    set default 'creator-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
alter table creator_profiles add constraint creator_profiles_handle_check
    check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(handle) <= 40);
create unique index creator_profiles_handle_idx on creator_profiles (handle);
