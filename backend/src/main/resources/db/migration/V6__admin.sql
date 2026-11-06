-- P3-18 Admin API and audit log.

-- An admin can take a live episode down (A8); the creator cannot put it back.
alter table episodes drop constraint episodes_status_check;
alter table episodes add constraint episodes_status_check
    check (status in ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'HIDDEN'));

-- A paid order can be refunded: the coins leave the wallet through a REFUND ledger row.
alter table payment_orders drop constraint payment_orders_status_check;
alter table payment_orders add constraint payment_orders_status_check
    check (status in ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'));
alter table payment_orders add column refunded_at timestamptz;
create unique index coin_ledger_one_refund_per_order on coin_ledger (order_id) where reason = 'REFUND';

alter table reports add column resolution_note text check (char_length(resolution_note) <= 1000);

-- The audit log is append-only, like the coin ledger.
create function audit_log_reject_change() returns trigger
    language plpgsql
    set search_path = ''
as $$
begin
    raise exception 'audit_log is append-only (% is not allowed)', tg_op;
end;
$$;

create trigger audit_log_append_only
    before update or delete on audit_log
    for each row execute function audit_log_reject_change();

create trigger audit_log_no_truncate
    before truncate on audit_log
    for each statement execute function audit_log_reject_change();

create index audit_log_actor_idx on audit_log (actor_id, created_at desc);
