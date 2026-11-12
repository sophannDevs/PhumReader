-- V21-08 Settings saved to the account: comic reader, data use, region and privacy.
-- Enum values are stored as the Java enum names (upper case), like theme and reader_theme.
-- mature_content and public_library are saved only; nothing is filtered or shared by them yet.

-- Settings > Reading (comics).
alter table user_settings add column comic_mode text not null default 'SCROLL' check (comic_mode in ('SCROLL', 'PAGE'));
alter table user_settings add column image_quality text not null default 'AUTO' check (image_quality in ('AUTO', 'HIGH', 'SAVER'));
alter table user_settings add column auto_next boolean not null default true;
alter table user_settings add column data_saver boolean not null default false;
alter table user_settings add column comic_background text not null default 'DARK' check (comic_background in ('DARK', 'LIGHT'));
alter table user_settings add column comic_width text not null default 'FIT' check (comic_width in ('FIT', 'NARROW'));

-- Settings > Privacy.
alter table user_settings add column region text not null default 'KH' check (region in ('KH', 'TH', 'VN', 'OTHER'));
alter table user_settings add column public_library boolean not null default false;
alter table user_settings add column mature_content boolean not null default false;
