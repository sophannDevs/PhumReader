-- Images a creator uploads (plan P3-07): the browser PUTs the original to object storage with a
-- presigned URL, then asks the API to check and process it into WebP variants.
create table media_uploads (
    id               uuid primary key default gen_random_uuid(),
    owner_id         uuid not null references users (id) on delete cascade,
    kind             text not null check (kind in ('COVER', 'BANNER', 'THUMBNAIL', 'PANEL')),
    status           text not null default 'PENDING' check (status in ('PENDING', 'READY', 'REJECTED')),
    content_type     text not null check (content_type in ('image/jpeg', 'image/png')),
    declared_size    bigint not null check (declared_size > 0),
    original_key     text not null,
    width            integer,
    height           integer,
    -- Widths of the WebP variants in storage (keys are derived from the upload).
    variant_widths   integer[] not null default '{}',
    reject_code      text,
    reject_message   text,
    created_at       timestamptz not null default now(),
    completed_at     timestamptz
);
create index media_uploads_owner_idx on media_uploads (owner_id, created_at desc);

alter table media_uploads enable row level security;
