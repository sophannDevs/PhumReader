-- Fix: real-mode data gaps (B4). Report an account (the creator profile's Report): target_type USER, and both
-- target_id and accused_id are the reported account.

alter table reports drop constraint reports_target_type_check;
alter table reports add constraint reports_target_type_check
    check (target_type in ('SERIES', 'EPISODE', 'COMMENT', 'USER'));

-- An account report can end in a warning without anything being removed.
alter table reports drop constraint reports_action_check;
alter table reports add constraint reports_action_check
    check (action in ('REMOVE', 'REMOVE_WARN', 'WARN', 'SUSPEND', 'NONE'));
