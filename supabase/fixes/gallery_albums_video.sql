-- ==========================================================
-- Event gallery: albums, videos and image dimensions
-- Run in the Supabase SQL editor. Safe to run repeatedly.
--
-- album       Groups items into tabs on the public gallery
--             (e.g. "Day 1 – Speakers"). NULL = no album.
-- media_type  'image' or 'video'.
-- video_url   For videos: a YouTube link or an uploaded file URL.
--             image_url then holds the poster (YouTube thumbnail),
--             or the file URL itself for uploaded videos.
-- width/height  Pixel size of the stored image, so the public grid
--             can lay photos out at their natural aspect ratio.
-- object_key  Now nullable: linked (YouTube) videos have no file.
-- ==========================================================

alter table public.event_gallery_images
  add column if not exists album text,
  add column if not exists media_type text not null default 'image',
  add column if not exists video_url text,
  add column if not exists width int,
  add column if not exists height int;

alter table public.event_gallery_images
  alter column object_key drop not null;

alter table public.event_gallery_images
  drop constraint if exists event_gallery_images_media_type_check;
alter table public.event_gallery_images
  add constraint event_gallery_images_media_type_check
  check (media_type in ('image', 'video'));

create index if not exists event_gallery_images_event_order_idx
  on public.event_gallery_images (event_id, display_order);
