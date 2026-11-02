-- ==========================================================
-- Announcement links + chosen gallery cover
-- Run in the Supabase SQL editor. Safe to run repeatedly.
--
-- announcements.link_url    Optional link shown under the announcement and
--                           opened from its notification. A site path
--                           ("/events/…/gallery") or a full https:// URL.
-- announcements.link_label  Button text for the link, e.g. "View gallery".
-- events.gallery_cover_url  Photo used as the gallery page's cover and the
--                           lead photo of the event page's gallery card.
--                           NULL = fall back to the event cover image.
-- ==========================================================

alter table public.announcements
  add column if not exists link_url text,
  add column if not exists link_label text;

alter table public.events
  add column if not exists gallery_cover_url text;
