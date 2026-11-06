-- First-purchase bonus (Coins page): the same number of coins as the pack, once per account. Stored on the
-- order: the expected bonus when the order is created, the bonus actually credited when it is paid.
alter table payment_orders
    add column first_bonus_coins integer not null default 0 check (first_bonus_coins >= 0);
