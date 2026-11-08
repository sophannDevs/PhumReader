-- Creator writes (plan P3-14).
-- A Fast Pass draft keeps its "free after N days" until it is published or scheduled; only then is
-- free_at (published_at + N days) known.
alter table episodes add column fast_pass_days smallint check (fast_pass_days between 1 and 90);
alter table episodes drop constraint episodes_fast_pass_check;
alter table episodes add constraint episodes_fast_pass_check
    check (status = 'DRAFT' or (free_at is null) = (price_coins is null));
alter table episodes add constraint episodes_fast_pass_ready_check
    check (price_coins is null or status = 'DRAFT' or fast_pass_days is not null or free_at is not null);

-- Which upload a panel came from, so a draft can be reopened with its panels in order.
alter table episode_images add column upload_id uuid references media_uploads (id) on delete set null;

-- Finds due scheduled episodes quickly.
create index episodes_scheduled_idx on episodes (published_at) where status = 'SCHEDULED';
