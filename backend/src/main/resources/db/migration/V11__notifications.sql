-- V21-03 In-app notifications inbox (spec section 13) and the alert settings behind it.

-- One row per recipient and thing that happened. Items are a type plus values (data), never text: the
-- website writes them in English or Khmer. The page's tabs follow kind (New episodes = EPISODE,
-- Comments = COMMENT, Coins = COINS; SYSTEM shows under All and Unread).
create table notifications (
    id             uuid primary key default gen_random_uuid(),
    -- Goes with the account. (Erasing an account keeps the users row, so AccountErasureService also
    -- deletes these rows itself.)
    user_id        uuid not null references users (id) on delete cascade,
    kind           text not null check (kind in ('EPISODE', 'COMMENT', 'COINS', 'SYSTEM')),
    -- The website's keys (lower case, like the review item keys).
    type           text not null check (type in ('episode_published', 'comment_liked', 'order_paid',
                                                 'order_refunded', 'report_resolved', 'report_dismissed',
                                                 'series_approved', 'series_changes', 'series_rejected',
                                                 'welcome')),
    -- What the row is about, unique per person: writing it again changes nothing, so a resumed
    -- dispatcher page or a repeated payment confirmation never adds a second row. comment_liked uses
    -- one key per comment and day (Asia/Phnom_Penh) and raises the count in data instead.
    group_key      text not null check (char_length(group_key) between 1 and 120),
    -- The series the item opens. Deleting a series (only possible while none of its episodes was
    -- ever published, V21-02) takes its items along: their text needs the series' title and their
    -- link its slug, so a row without its series could neither be written nor opened.
    series_id      uuid references series (id) on delete cascade,
    episode_number integer check (episode_number > 0),
    -- The values the text needs: coins, order number, like count, outcome, review items...
    data           jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
    -- When it happened; for comment_liked the time of the latest like.
    created_at     timestamptz not null default now(),
    read_at        timestamptz,
    -- Removed by the reader: hidden, kept 7 days for Undo / restore, then deleted by the nightly job.
    removed_at     timestamptz,
    constraint notifications_kind_type_check check (
        (kind = 'EPISODE') = (type = 'episode_published')
        and (kind = 'COMMENT') = (type = 'comment_liked')
        and (kind = 'COINS') = (type in ('order_paid', 'order_refunded')))
);
create unique index notifications_group_key on notifications (user_id, group_key);
-- The inbox, newest first, per tab.
create index notifications_inbox_idx on notifications (user_id, created_at desc, id desc)
    where removed_at is null;
-- The bell.
create index notifications_unread_idx on notifications (user_id)
    where read_at is null and removed_at is null;
-- The nightly clean-up (removed after 7 days, read after 90 days) and series deletion.
create index notifications_removed_idx on notifications (removed_at) where removed_at is not null;
create index notifications_created_idx on notifications (created_at);
create index notifications_series_idx on notifications (series_id) where series_id is not null;

alter table notifications enable row level security;

-- Alert settings (Settings > Notifications): push and email per type, quiet hours (whole hours in
-- Asia/Phnom_Penh; the window may wrap midnight, from = to means none) and the daily digest. The
-- defaults are the website's (src/lib/store.ts defaultNotifPrefs). The V1 switches stay what they
-- were: notify_new_episodes is the push switch of "update" (new episodes), notify_fast_pass the push
-- switch of "fastpass" (a Fast Pass episode turned free).
alter table user_settings
    add column email_new_episodes boolean not null default false,
    add column email_fast_pass    boolean not null default false,
    add column push_comments      boolean not null default true,
    add column email_comments     boolean not null default false,
    add column push_coins         boolean not null default true,
    add column email_coins        boolean not null default true,
    add column push_news          boolean not null default false,
    add column email_news         boolean not null default false,
    add column quiet_hours        boolean not null default true,
    add column quiet_from         smallint not null default 22 check (quiet_from between 0 and 23),
    add column quiet_to           smallint not null default 7 check (quiet_to between 0 and 23),
    add column daily_digest       boolean not null default false;
-- The website's default for the Fast Pass push switch is on; rows saved before keep their choice.
alter table user_settings alter column notify_fast_pass set default true;
