-- Notifications for new episodes (plan P3-16). The dispatcher claims one event at a time for a few
-- minutes (locked_until) and records how far it got in payload.after, so a crash resumes instead
-- of notifying everybody twice or never.
alter table outbox_events add column locked_until timestamptz;
