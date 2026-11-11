-- V21-04 Blocking and report outcomes.

-- "Block": the blocker's comment threads flag the blocked person's comments; the list is on Settings.
create table user_blocks (
    blocker_id uuid not null references users (id) on delete cascade,
    blocked_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (blocker_id, blocked_id),
    constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on user_blocks (blocked_id);

-- Case numbers R-20481, R-20482 ... (the demo data used R-20477 and below).
create sequence report_case_seq start with 20481;
alter table reports add column case_number integer;
update reports set case_number = nextval('report_case_seq') where case_number is null;
alter table reports alter column case_number set not null;
alter table reports alter column case_number set default nextval('report_case_seq');
alter sequence report_case_seq owned by reports.case_number;
create unique index reports_case_number_idx on reports (case_number);

-- The person behind the reported thing, and what the admin did.
alter table reports add column accused_id uuid references users (id);
alter table reports add column action text check (action in ('REMOVE', 'REMOVE_WARN', 'SUSPEND', 'NONE'));
update reports r set accused_id = c.author_id from comments c
    where r.target_type = 'COMMENT' and c.id = r.target_id;
update reports r set accused_id = s.creator_id from series s
    where r.target_type = 'SERIES' and s.id = r.target_id;
update reports r set accused_id = s.creator_id from episodes e join series s on s.id = e.series_id
    where r.target_type = 'EPISODE' and e.id = r.target_id;
create index reports_reporter_idx on reports (reporter_id, created_at desc);

-- A timed suspension: BANNED until this moment (null = until an admin lifts it).
alter table users add column suspended_until timestamptz;

alter table user_blocks enable row level security;
