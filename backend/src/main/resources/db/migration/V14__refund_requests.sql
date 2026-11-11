-- V21-06 Admin payments: refund requests and stuck payments.

-- The reader asks for a refund of a paid order (receipt / Help). One request per order; an admin approves or declines.
create table refund_requests (
    id             uuid primary key default gen_random_uuid(),
    order_id       uuid not null unique references payment_orders (id),
    user_id        uuid not null references users (id),
    reason         text not null check (char_length(reason) between 10 and 500),
    status         text not null default 'OPEN' check (status in ('OPEN', 'APPROVED', 'DECLINED')),
    requested_at   timestamptz not null default now(),
    decided_at     timestamptz,
    decided_by     uuid references users (id),
    -- The admin's note to the reader (required when declining).
    decision_note  text check (char_length(decision_note) <= 500),
    -- Coins taken back from the wallet when approved (may be less than the order when some were spent).
    refunded_coins integer check (refunded_coins > 0),
    constraint refund_requests_decided_check
        check ((status = 'OPEN') = (decided_at is null) and (status = 'OPEN') = (decided_by is null))
);
create index refund_requests_queue_idx on refund_requests (requested_at) where status = 'OPEN';
create index refund_requests_user_idx on refund_requests (user_id, requested_at desc);

-- "Paid but no coins": PayWay says the order was paid, but reconciliation did not credit it (the amount or currency
-- differs from the order). An admin checks PayWay's dashboard and adds the coins by hand.
create table payment_stuck (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid not null unique references payment_orders (id),
    kind        text not null check (kind in ('AMOUNT_MISMATCH')),
    paid_amount numeric(12, 2),
    currency    text,
    found_at    timestamptz not null default now(),
    resolved_at timestamptz,
    resolved_by uuid references users (id),
    note        text check (char_length(note) <= 500),
    constraint payment_stuck_resolved_check check ((resolved_at is null) = (resolved_by is null))
);
create index payment_stuck_open_idx on payment_stuck (found_at) where resolved_at is null;

alter table refund_requests enable row level security;
alter table payment_stuck enable row level security;
