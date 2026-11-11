-- V21-02 Series and episode fields from the V2.1 forms (Create series, Manage series).

-- Second genre: optional, never the main genre. Genre lists and search keep using the main one.
alter table series add column second_genre_id smallint references genres (id);
alter table series add constraint series_second_genre_check check (second_genre_id <> genre_id);

-- Age 16+: ALL (all ages), TEEN (13+), TEEN16 (16+), MATURE (18+). Existing rows keep their meaning.
alter table series drop constraint series_age_rating_check;
alter table series add constraint series_age_rating_check
    check (age_rating in ('ALL', 'TEEN', 'TEEN16', 'MATURE'));

-- Several update days instead of one: the weekdays new episodes come out, each at most once.
create function series_days_distinct(days text[]) returns boolean
    language sql
    immutable
    set search_path = ''
as $$
    select count(*) = count(distinct d) from unnest(days) as d;
$$;

alter table series add column update_days text[] not null default '{}'
    check (update_days <@ array['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
                                'SUNDAY']
           and cardinality(update_days) <= 7
           and series_days_distinct(update_days));
update series set update_days = array[update_day] where update_day is not null;
-- Dropping the column drops series_update_day_idx with it.
alter table series drop column update_day;
-- Home's daily lists and the UP badge look at published series by day.
create index series_update_days_idx on series using gin (update_days) where visibility = 'PUBLISHED';

-- Release time (hour of the day in Asia/Phnom_Penh); Upload episode uses it for scheduled releases.
alter table series add column release_hour smallint check (release_hour between 0 and 23);

-- Series-wide Fast Pass: the defaults for new episodes (episodes already out keep their own price
-- and free date). Free after ceil(ahead * 7 / number of update days) days.
alter table series add column fast_pass boolean not null default true;
alter table series add column fast_pass_ahead smallint not null default 3
    check (fast_pass_ahead between 1 and 5);

-- Comments switch for the whole series; the per-episode switch stays, both must be on.
alter table series add column comments_enabled boolean not null default true;

-- "On break" message, kept only while the series is on hiatus.
alter table series add column break_message text check (char_length(break_message) <= 120);
alter table series add constraint series_break_only_on_hiatus_check
    check (break_message is null or status = 'HIATUS');

-- The creator hides one live episode (separate from an admin's HIDDEN status, which the creator
-- cannot undo). Readers no longer see it, also those who unlocked it; numbers don't shift.
alter table episodes add column hidden_at timestamptz;
alter table episodes add constraint episodes_hidden_check
    check (hidden_at is null or status in ('PUBLISHED', 'HIDDEN'));
