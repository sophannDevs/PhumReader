-- V21-01 Series review workflow: a new series goes live once an admin approved it.
--   DRAFT -> REVIEW (the creator submits) -> PUBLISHED (approve; sets launched_at the first time)
--                                         -> CHANGES (request changes) -> REVIEW (resubmit)
--                                         -> DRAFT (reject)
-- Readers only ever see PUBLISHED, as before. A series that was live once (launched_at set) can be put
-- back live by its creator without a new review.
alter table series drop constraint series_visibility_check;
alter table series add constraint series_visibility_check
    check (visibility in ('DRAFT', 'REVIEW', 'CHANGES', 'PUBLISHED', 'HIDDEN'));

-- Live and hidden series went live before; publishing always set launched_at, but rows written by
-- hand may lack it. The catalog already falls back to created_at, so readers see no change.
update series set launched_at = created_at
where launched_at is null and visibility in ('PUBLISHED', 'HIDDEN');

-- One row per submission. The admin's decision closes it; a series has at most one open submission.
-- The id grows with every submission, so the latest one is the highest id even within one second.
create table series_reviews (
    id           bigint generated always as identity primary key,
    series_id    uuid not null references series (id) on delete cascade,
    submitted_at timestamptz not null,
    decided_at   timestamptz,
    decided_by   uuid references users (id),
    decision     text check (decision in ('APPROVED', 'CHANGES', 'REJECTED')),
    -- The admin's note to the creator.
    note         text check (char_length(note) <= 300),
    constraint series_reviews_decided_check
        check ((decision is null) = (decided_at is null) and (decision is null) = (decided_by is null))
);
create unique index series_reviews_one_open_idx on series_reviews (series_id) where decided_at is null;
create index series_reviews_series_idx on series_reviews (series_id, id desc);
-- The admin queue: open submissions, oldest first.
create index series_reviews_queue_idx on series_reviews (submitted_at, series_id) where decided_at is null;

-- What the admin asked to change ("Request changes"). The items are the website's keys, which it
-- translates (like the 'en' / 'km' locale codes, they stay lower case). The creator marks each one
-- fixed before resubmitting.
create table series_review_items (
    review_id bigint not null references series_reviews (id) on delete cascade,
    item      text not null check (item in ('contact', 'cover', 'title', 'age', 'images')),
    fixed_at  timestamptz,
    primary key (review_id, item)
);

alter table series_reviews enable row level security;
alter table series_review_items enable row level security;
