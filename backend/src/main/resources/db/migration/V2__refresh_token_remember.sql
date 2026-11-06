-- "Remember me" on the login form: persistent cookies when true, browser-session cookies when false.
-- Kept on the token so a refresh sets the same kind of cookie.
alter table refresh_tokens add column remember boolean not null default true;
