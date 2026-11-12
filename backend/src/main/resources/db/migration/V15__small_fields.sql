-- V21-07 Smaller V2.1 fields: welcome picks, birth year, Help tickets and "Was this helpful?" votes.

-- Welcome / Home picks. preferred_genres is null until the reader chooses (an empty list = "Skip");
-- both hold comma-separated values (genre names, locale codes).
alter table user_settings add column preferred_genres text;
alter table user_settings add column story_languages text not null default 'en,km';

-- Birth year from the sign-up form (13+ to join; 16+ and 18+ series are checked against it).
alter table users add column birth_year integer check (birth_year between 1900 and 2100);

-- Help > Contact us. Numbers start at T-58214; the website shows "T-" + number.
create sequence support_ticket_number start 58214;

create table support_tickets (
    id           uuid primary key default gen_random_uuid(),
    number       integer not null unique default nextval('support_ticket_number'),
    user_id      uuid references users (id) on delete set null,
    email        text not null check (char_length(email) <= 254),
    topic        text not null check (topic in ('payment', 'account', 'reading', 'creator', 'report', 'other')),
    order_number text check (order_number is null or order_number ~ '^TW-[0-9]{8}$'),
    message      text not null check (char_length(message) between 20 and 1000),
    locale       text not null default 'en' check (locale in ('en', 'km')),
    status       text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
    created_at   timestamptz not null default now()
);
create index support_tickets_user_idx on support_tickets (user_id);

-- One answer per account and help article (the article's position in the Help list).
create table help_votes (
    user_id  uuid not null references users (id) on delete cascade,
    article  smallint not null check (article between 0 and 99),
    helpful  boolean not null,
    voted_at timestamptz not null default now(),
    primary key (user_id, article)
);

alter table support_tickets enable row level security;
alter table help_votes enable row level security;
