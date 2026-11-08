-- Profile pictures use the same upload pipeline as covers and panels (plan P3-17).
alter table media_uploads drop constraint media_uploads_kind_check;
alter table media_uploads
    add constraint media_uploads_kind_check
    check (kind in ('COVER', 'BANNER', 'THUMBNAIL', 'PANEL', 'AVATAR'));
