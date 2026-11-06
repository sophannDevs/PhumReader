-- PhumReader schema V1 (plan P3-01, Stage 1 Step 2).
--
-- Conventions
--   * uuid primary keys, timestamptz stored in UTC (shown in Asia/Phnom_Penh by the website).
--   * Enum-like columns hold UPPER_CASE values that match the Java enums; locale codes stay 'en' / 'km'.
--   * Row level security is enabled on every table with no policies (last section). The API connects as
--     the table owner and is not affected; anything reaching the tables through Supabase's Data API is blocked.
--   * Money: balances change only through coin_ledger, which is append-only (trigger below).

-- ============================================================================================
-- Accounts
-- ============================================================================================

create table users (
    id                    uuid primary key default gen_random_uuid(),
    email                 text not null check (position('@' in email) > 1 and char_length(email) <= 254),
    email_verified_at     timestamptz,
    -- Argon2 hash; null for accounts that only sign in with Google or Facebook.
    password_hash         text,
    display_name          text not null check (char_length(display_name) between 1 and 60),
    avatar_url            text,
    status                text not null default 'ACTIVE'
                          check (status in ('ACTIVE', 'BANNED', 'DELETION_PENDING', 'DELETED')),
    -- Start of the 30-day grace period before personal data is erased (A18).
    deletion_requested_at timestamptz,
    last_login_at         timestamptz,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);
create unique index users_email_key on users (lower(email));

create table user_roles (
    user_id uuid not null references users (id) on delete cascade,
    role    text not null check (role in ('READER', 'CREATOR', 'ADMIN')),
    primary key (user_id, role)
);

create table user_identities (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references users (id) on delete cascade,
    provider         text not null check (provider in ('GOOGLE', 'FACEBOOK')),
    provider_user_id text not null,
    email            text,
    created_at       timestamptz not null default now(),
    unique (provider, provider_user_id)
);
create index user_identities_user_idx on user_identities (user_id);

-- One family per device sign-in. Each refresh rotates the token; reusing a rotated token revokes the family.
create table refresh_tokens (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references users (id) on delete cascade,
    family_id    uuid not null,
    -- SHA-256 of the token: the token itself is never stored.
    token_hash   text not null unique,
    device_name  text,
    created_at   timestamptz not null default now(),
    expires_at   timestamptz not null,
    last_used_at timestamptz,
    rotated_at   timestamptz,
    revoked_at   timestamptz
);
create index refresh_tokens_user_idx on refresh_tokens (user_id);
create index refresh_tokens_family_idx on refresh_tokens (family_id);

create table user_settings (
    user_id             uuid primary key references users (id) on delete cascade,
    language            text not null default 'en' check (language in ('en', 'km')),
    theme               text not null default 'SYSTEM' check (theme in ('SYSTEM', 'LIGHT', 'DARK')),
    -- Novel reader defaults (Settings > Reading and the reader's settings popover).
    reader_text_size    smallint not null default 18 check (reader_text_size between 12 and 32),
    reader_theme        text not null default 'LIGHT' check (reader_theme in ('LIGHT', 'SEPIA', 'DARK')),
    reader_font         text not null default 'SANS' check (reader_font in ('SANS', 'SERIF')),
    reader_wide_spacing boolean not null default true,
    notify_new_episodes boolean not null default true,
    notify_fast_pass    boolean not null default false,
    updated_at          timestamptz not null default now()
);

-- A reader becomes a creator by accepting the Creator terms (A11).
create table creator_profiles (
    user_id           uuid primary key references users (id),
    pen_name          text not null check (char_length(pen_name) between 1 and 60),
    bio               text check (char_length(bio) <= 500),
    accepted_terms_at timestamptz not null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create table creator_follows (
    user_id    uuid not null references users (id) on delete cascade,
    creator_id uuid not null references creator_profiles (user_id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, creator_id)
);
create index creator_follows_creator_idx on creator_follows (creator_id);

-- ============================================================================================
-- Content
-- ============================================================================================

create table genres (
    id       smallint primary key,
    slug     text not null unique,
    name     text not null unique,
    position smallint not null
);

create table series (
    id               uuid primary key default gen_random_uuid(),
    slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    creator_id       uuid not null references creator_profiles (user_id),
    type             text not null check (type in ('COMIC', 'NOVEL')),
    title            text not null check (char_length(title) between 1 and 120),
    summary          text not null default '' check (char_length(summary) <= 2000),
    genre_id         smallint not null references genres (id),
    languages        text[] not null default '{en}'
                     check (cardinality(languages) > 0 and languages <@ array['en', 'km']),
    age_rating       text not null default 'ALL' check (age_rating in ('ALL', 'TEEN', 'MATURE')),
    status           text not null default 'ONGOING' check (status in ('ONGOING', 'COMPLETED', 'HIATUS')),
    -- DRAFT until the creator publishes; HIDDEN when an admin takes it down.
    visibility       text not null default 'DRAFT' check (visibility in ('DRAFT', 'PUBLISHED', 'HIDDEN')),
    update_day       text check (update_day in
                         ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    cover_url        text,
    banner_url       text,
    view_count       bigint not null default 0 check (view_count >= 0),
    like_count       bigint not null default 0 check (like_count >= 0),
    subscriber_count bigint not null default 0 check (subscriber_count >= 0),
    -- When the series first went live on PhumReader (the "NEW" badge).
    launched_at      timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index series_creator_idx on series (creator_id);
create index series_genre_idx on series (genre_id) where visibility = 'PUBLISHED';
create index series_update_day_idx on series (update_day) where visibility = 'PUBLISHED';

create table series_tags (
    series_id uuid not null references series (id) on delete cascade,
    tag       text not null check (char_length(tag) between 1 and 30),
    primary key (series_id, tag)
);
create index series_tags_tag_idx on series_tags (tag);

-- An episode (comic) or chapter (novel). Fast Pass (A3): price_coins and free_at are set together;
-- before free_at the episode needs an unlock, from free_at on it is free for everyone.
create table episodes (
    id               uuid primary key default gen_random_uuid(),
    series_id        uuid not null references series (id) on delete cascade,
    number           integer not null check (number > 0),
    title            text not null check (char_length(title) between 1 and 120),
    status           text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'PUBLISHED')),
    -- Release time (UTC); for SCHEDULED episodes the time the publish job makes them live.
    published_at     timestamptz,
    free_at          timestamptz,
    price_coins      smallint check (price_coins between 3 and 10),
    thumbnail_url    text,
    creator_note     text check (char_length(creator_note) <= 1000),
    comments_enabled boolean not null default true,
    view_count       bigint not null default 0 check (view_count >= 0),
    like_count       bigint not null default 0 check (like_count >= 0),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (series_id, number),
    constraint episodes_fast_pass_check check ((free_at is null) = (price_coins is null)),
    constraint episodes_published_at_check check (status = 'DRAFT' or published_at is not null)
);
create index episodes_published_idx on episodes (published_at) where status = 'PUBLISHED';

-- Comic panels in reading order (A19: 800 px wide, at most 100 per episode).
create table episode_images (
    episode_id  uuid not null references episodes (id) on delete cascade,
    position    smallint not null check (position between 1 and 100),
    -- R2 object key; the demo panels use their public path (/panels/<id>.svg).
    storage_key text not null,
    width       integer not null check (width > 0),
    height      integer not null check (height > 0),
    alt         text not null default '',
    primary key (episode_id, position)
);

-- Novel chapter text as blocks: {"type":"paragraph"|"quote","text":…} or {"type":"scene-break"}.
create table chapter_texts (
    episode_id uuid primary key references episodes (id) on delete cascade,
    blocks     jsonb not null check (jsonb_typeof(blocks) = 'array'),
    word_count integer not null default 0 check (word_count >= 0)
);

-- Home hero carousel (editorial).
create table featured_slides (
    position  smallint primary key check (position > 0),
    series_id uuid not null references series (id) on delete cascade,
    tag       text not null default '',
    blurb     text not null default ''
);

-- Rankings as last computed; movement = previous_position - position, null previous = NEW.
create table rankings (
    kind              text not null check (kind in ('COMICS', 'NOVELS')),
    position          integer not null check (position > 0),
    series_id         uuid not null references series (id) on delete cascade,
    previous_position integer check (previous_position > 0),
    computed_at       timestamptz not null default now(),
    primary key (kind, position),
    unique (kind, series_id)
);

-- ============================================================================================
-- Reading
-- ============================================================================================

create table subscriptions (
    user_id    uuid not null references users (id) on delete cascade,
    series_id  uuid not null references series (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, series_id)
);
create index subscriptions_series_idx on subscriptions (series_id);

-- Where a reader is in each series: Continue reading, Recently read and the "Read" marks.
create table reading_progress (
    user_id            uuid not null references users (id) on delete cascade,
    series_id          uuid not null references series (id) on delete cascade,
    -- The episode opened last and how far into it (0..1).
    episode_id         uuid not null references episodes (id) on delete cascade,
    progress           real not null default 0 check (progress between 0 and 1),
    -- Highest episode number opened in this series.
    max_episode_number integer not null check (max_episode_number > 0),
    updated_at         timestamptz not null default now(),
    primary key (user_id, series_id)
);
create index reading_progress_user_idx on reading_progress (user_id, updated_at desc);

create table episode_likes (
    user_id    uuid not null references users (id) on delete cascade,
    episode_id uuid not null references episodes (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, episode_id)
);
create index episode_likes_episode_idx on episode_likes (episode_id);

create table episode_bookmarks (
    user_id    uuid not null references users (id) on delete cascade,
    episode_id uuid not null references episodes (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, episode_id)
);

-- ============================================================================================
-- Money
-- ============================================================================================

-- Prices live here so they change without a deploy (A2); null until the real prices are set.
create table coin_packs (
    id              smallint primary key,
    coins           integer not null check (coins > 0),
    bonus_coins     integer not null default 0 check (bonus_coins >= 0),
    tag             text check (tag in ('POPULAR', 'BEST_VALUE')),
    price_usd_cents integer check (price_usd_cents > 0),
    price_khr       integer check (price_khr > 0),
    position        smallint not null,
    active          boolean not null default true
);

-- The row an unlock or credit locks (SELECT … FOR UPDATE). balance always equals the sum of the user's ledger.
create table coin_wallets (
    user_id    uuid primary key references users (id),
    balance    integer not null default 0 check (balance >= 0),
    updated_at timestamptz not null default now()
);

-- PENDING → PAID | FAILED | CANCELLED | EXPIRED (10 minutes). Coins are credited once, on PAID.
create table payment_orders (
    id              uuid primary key default gen_random_uuid(),
    order_number    text not null unique check (order_number ~ '^PR-[0-9]{8}$'),
    user_id         uuid not null references users (id),
    pack_id         smallint not null references coin_packs (id),
    coins           integer not null check (coins > 0),
    bonus_coins     integer not null default 0 check (bonus_coins >= 0),
    method          text not null check (method in ('KHQR', 'ABA_PAY', 'CARD')),
    status          text not null default 'PENDING'
                    check (status in ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
    price_usd_cents integer check (price_usd_cents > 0),
    price_khr       integer check (price_khr > 0),
    -- PAYWAY, or DEV_SIMULATOR in development.
    provider        text not null,
    provider_ref    text,
    expires_at      timestamptz not null,
    paid_at         timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (provider, provider_ref)
);
create index payment_orders_user_idx on payment_orders (user_id, created_at desc);
create index payment_orders_pending_idx on payment_orders (expires_at) where status = 'PENDING';

create table unlocks (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users (id),
    episode_id uuid not null references episodes (id),
    coins      integer not null check (coins > 0),
    created_at timestamptz not null default now(),
    unique (user_id, episode_id)
);
create index unlocks_episode_idx on unlocks (episode_id);

-- Append-only: one row per top-up, bonus, unlock, refund or adjustment.
create table coin_ledger (
    id            bigint generated always as identity primary key,
    user_id       uuid not null references users (id),
    amount        integer not null check (amount <> 0),
    balance_after integer not null check (balance_after >= 0),
    reason        text not null check (reason in ('PURCHASE', 'BONUS', 'UNLOCK', 'REFUND', 'ADJUSTMENT')),
    order_id      uuid references payment_orders (id),
    unlock_id     uuid references unlocks (id),
    note          text,
    created_at    timestamptz not null default now(),
    constraint coin_ledger_purchase_check check (reason <> 'PURCHASE' or (order_id is not null and amount > 0)),
    constraint coin_ledger_unlock_check check (reason <> 'UNLOCK' or (unlock_id is not null and amount < 0))
);
create index coin_ledger_user_idx on coin_ledger (user_id, created_at desc);
-- An order is credited at most once, an unlock charged at most once, whatever the retries.
create unique index coin_ledger_one_credit_per_order on coin_ledger (order_id) where reason = 'PURCHASE';
create unique index coin_ledger_one_charge_per_unlock on coin_ledger (unlock_id) where reason = 'UNLOCK';

create function coin_ledger_reject_change() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    raise exception 'coin_ledger is append-only (% is not allowed)', tg_op;
end;
$$;

create trigger coin_ledger_append_only
    before update or delete on coin_ledger
    for each row execute function coin_ledger_reject_change();

create trigger coin_ledger_no_truncate
    before truncate on coin_ledger
    for each statement execute function coin_ledger_reject_change();

-- What a creator earned from each unlock (A7: payouts are out of scope for v1).
create table creator_earnings (
    id         uuid primary key default gen_random_uuid(),
    creator_id uuid not null references creator_profiles (user_id),
    unlock_id  uuid not null unique references unlocks (id),
    episode_id uuid not null references episodes (id),
    coins      integer not null check (coins > 0),
    created_at timestamptz not null default now()
);
create index creator_earnings_creator_idx on creator_earnings (creator_id, created_at desc);

-- Stored results of money and access requests, so a retry with the same Idempotency-Key repeats the answer.
create table idempotency_keys (
    user_id         uuid not null references users (id) on delete cascade,
    scope           text not null,
    key             text not null check (char_length(key) between 8 and 100),
    request_hash    text not null,
    response_status smallint,
    response_body   jsonb,
    created_at      timestamptz not null default now(),
    expires_at      timestamptz not null,
    primary key (user_id, scope, key)
);
create index idempotency_keys_expiry_idx on idempotency_keys (expires_at);

-- ============================================================================================
-- Community
-- ============================================================================================

create table comments (
    id         uuid primary key default gen_random_uuid(),
    series_id  uuid not null references series (id) on delete cascade,
    -- Null: a comment on the series page; otherwise on that episode.
    episode_id uuid references episodes (id) on delete cascade,
    author_id  uuid not null references users (id),
    body       text not null check (char_length(body) between 1 and 2000),
    like_count integer not null default 0 check (like_count >= 0),
    status     text not null default 'VISIBLE' check (status in ('VISIBLE', 'HIDDEN', 'DELETED')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index comments_series_idx on comments (series_id, created_at desc) where episode_id is null;
create index comments_episode_idx on comments (episode_id, created_at desc) where episode_id is not null;
create index comments_author_idx on comments (author_id);

create table comment_likes (
    user_id    uuid not null references users (id) on delete cascade,
    comment_id uuid not null references comments (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, comment_id)
);
create index comment_likes_comment_idx on comment_likes (comment_id);

-- "Report" on a series, episode or comment goes to the admin queue (A9).
create table reports (
    id          uuid primary key default gen_random_uuid(),
    reporter_id uuid not null references users (id),
    target_type text not null check (target_type in ('SERIES', 'EPISODE', 'COMMENT')),
    target_id   uuid not null,
    reason      text not null check (char_length(reason) between 1 and 50),
    details     text check (char_length(details) <= 1000),
    status      text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'DISMISSED')),
    resolved_by uuid references users (id),
    resolved_at timestamptz,
    created_at  timestamptz not null default now()
);
create index reports_open_idx on reports (created_at) where status = 'OPEN';
create index reports_target_idx on reports (target_type, target_id);

-- ============================================================================================
-- Operations
-- ============================================================================================

create table push_tokens (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references users (id) on delete cascade,
    token        text not null unique,
    platform     text not null default 'WEB' check (platform in ('WEB')),
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on push_tokens (user_id);

-- Written in the same transaction as the change; the worker syncs search and sends notifications from it.
create table outbox_events (
    id           bigint generated always as identity primary key,
    topic        text not null check (topic in ('SEARCH', 'NOTIFICATION')),
    event_type   text not null,
    aggregate_id uuid,
    payload      jsonb not null default '{}'::jsonb,
    attempts     integer not null default 0,
    last_error   text,
    created_at   timestamptz not null default now(),
    processed_at timestamptz
);
create index outbox_events_pending_idx on outbox_events (id) where processed_at is null;

create table audit_log (
    id          bigint generated always as identity primary key,
    actor_id    uuid references users (id),
    action      text not null,
    target_type text not null,
    target_id   text,
    details     jsonb not null default '{}'::jsonb,
    request_id  text,
    created_at  timestamptz not null default now()
);
create index audit_log_target_idx on audit_log (target_type, target_id);
create index audit_log_created_idx on audit_log (created_at desc);

-- ShedLock: a scheduled job runs on one API instance at a time.
create table shedlock (
    name       varchar(64) primary key,
    lock_until timestamptz not null,
    locked_at  timestamptz not null,
    locked_by  varchar(255) not null
);

-- ============================================================================================
-- Row level security on every table in public, no policies. Later migrations must enable it on the
-- tables they add (SchemaTest checks this). Flyway's own history table is left alone: Flyway holds a
-- lock on it from a second connection while migrating, so altering it here would wait forever.
-- ============================================================================================

do $$
declare
    t record;
begin
    for t in select tablename from pg_tables
             where schemaname = 'public' and tablename <> 'flyway_schema_history' loop
        execute format('alter table public.%I enable row level security', t.tablename);
    end loop;
end;
$$;
