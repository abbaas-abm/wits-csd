"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Download, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  galleryDownloadUrl,
  galleryVideos,
  groupAlbums,
  youTubeEmbed,
  youTubeId,
} from "@/lib/gallery";
import type { EventGalleryImage } from "@/lib/types";

interface Viewing {
  list: EventGalleryImage[];
  index: number;
  label: string;
}

/**
 * Public event gallery: videos first, then photos split into album tabs,
 * laid out as a masonry grid with a full-screen viewer.
 */
export function EventGallery({
  items,
  initialAlbum,
}: {
  items: EventGalleryImage[];
  initialAlbum?: string | null;
}) {
  const albums = React.useMemo(() => groupAlbums(items), [items]);
  const videos = React.useMemo(() => galleryVideos(items), [items]);
  const [albumName, setAlbumName] = React.useState(
    () =>
      albums.find((album) => album.name === initialAlbum)?.name ??
      albums[0]?.name ??
      null,
  );
  const [viewing, setViewing] = React.useState<Viewing | null>(null);

  const album = albums.find((a) => a.name === albumName) ?? albums[0];

  function selectAlbum(name: string) {
    setAlbumName(name);
    // Keep the URL shareable without re-rendering the server page.
    const url = new URL(window.location.href);
    url.searchParams.set("album", name);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      {videos.length > 0 && (
        <section className="mx-auto max-w-[1600px] px-2 pt-8 sm:px-4 sm:pt-10">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            {videos.length === 1 ? "Video" : "Videos"}
          </h2>
          <div
            className={cn(
              "mt-3 grid gap-2",
              videos.length > 1 && "sm:grid-cols-2",
            )}
          >
            {videos.map((video, i) => (
              <VideoTile
                key={video.id}
                video={video}
                large={videos.length === 1}
                onOpen={() =>
                  setViewing({ list: videos, index: i, label: "Videos" })
                }
              />
            ))}
          </div>
        </section>
      )}

      {albums.length > 1 && (
        <nav
          aria-label="Albums"
          className="sticky top-16 z-30 mt-8 border-y border-gray-200 bg-white/95 backdrop-blur pwa:top-14"
        >
          <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-2 py-2 sm:px-4 [scrollbar-width:none]">
            {albums.map((a) => (
              <button
                key={a.name}
                type="button"
                onClick={() => selectAlbum(a.name)}
                aria-current={a.name === album?.name ? "true" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  a.name === album?.name
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:bg-slate-100 hover:text-gray-900",
                )}
              >
                {a.name}
                <span
                  className={cn(
                    "ml-1.5 text-xs",
                    a.name === album?.name ? "text-white/70" : "text-gray-400",
                  )}
                >
                  {a.items.length}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {album && (
        <section className="mx-auto max-w-[1600px] px-2 pt-4 sm:px-4">
          {albums.length > 1 && (
            <h2 className="sr-only">{album.name}</h2>
          )}
          <div className="columns-2 gap-2 sm:columns-3 lg:columns-4">
            {album.items.map((photo, i) => (
              <div
                key={photo.id}
                className="group relative mb-2 break-inside-avoid overflow-hidden bg-slate-100"
              >
                <button
                  type="button"
                  onClick={() =>
                    setViewing({ list: album.items, index: i, label: album.name })
                  }
                  className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  aria-label={`Open photo ${i + 1} of ${album.items.length}`}
                >
                  <Image
                    src={photo.image_url}
                    alt=""
                    width={photo.width ?? 1200}
                    height={photo.height ?? 800}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 400px"
                    className="h-auto w-full transition duration-300 group-hover:scale-[1.02] group-hover:brightness-95"
                  />
                </button>
                <DownloadLink
                  item={photo}
                  className="absolute right-2 top-2 size-9 bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {viewing && (
        <GalleryViewer
          viewing={viewing}
          onIndex={(index) => setViewing({ ...viewing, index })}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function VideoTile({
  video,
  large,
  onOpen,
}: {
  video: EventGalleryImage;
  large: boolean;
  onOpen: () => void;
}) {
  const isYouTube = Boolean(youTubeId(video.video_url));
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative block w-full overflow-hidden bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        large ? "aspect-video lg:aspect-[21/9]" : "aspect-video",
      )}
      aria-label={`Play ${video.file_name}`}
    >
      {isYouTube ? (
        <Image
          src={video.image_url}
          alt=""
          fill
          sizes={large ? "100vw" : "(max-width: 640px) 100vw, 50vw"}
          className="object-cover opacity-90 transition group-hover:opacity-100"
        />
      ) : (
        // Uploaded file: the first frame doubles as the poster.
        <video
          src={`${video.video_url ?? video.image_url}#t=0.5`}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition group-hover:scale-105 sm:size-20">
        <Play className="ml-1 size-7 fill-current sm:size-8" />
      </span>
      <span className="absolute inset-x-4 bottom-4 text-left text-base font-semibold text-white sm:text-lg">
        {video.file_name}
      </span>
    </button>
  );
}

function GalleryViewer({
  viewing,
  onIndex,
  onClose,
}: {
  viewing: Viewing;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { list, index, label } = viewing;
  const item = list[index];
  const count = list.length;
  const touchX = React.useRef<number | null>(null);

  const go = React.useCallback(
    (delta: number) => onIndex((index + delta + count) % count),
    [index, count, onIndex],
  );

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [go, onClose]);

  const neighbours = count > 1 ? [list[(index + 1) % count], list[(index - 1 + count) % count]] : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label}: ${index + 1} of ${count}`}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50 && count > 1) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
        <p className="min-w-0 truncate text-white/70">
          <span className="font-medium text-white">{label}</span>
          <span className="ml-2 tabular-nums">
            {index + 1} / {count}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <DownloadLink
            item={item}
            className="size-10 hover:bg-white/10"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        {item.media_type === "video" ? (
          <ViewerVideo key={item.id} video={item} />
        ) : (
          <Image
            key={item.id}
            src={item.image_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-contain"
          />
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-2 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-white/15 sm:flex"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-2 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-white/15 sm:flex"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}

        {/* Warm the cache for the photos either side of this one. */}
        <div aria-hidden className="pointer-events-none absolute size-px overflow-hidden opacity-0">
          {neighbours
            .filter((n) => n.media_type === "image")
            .map((n) => (
              <Image key={n.id} src={n.image_url} alt="" fill sizes="100vw" loading="eager" />
            ))}
        </div>
      </div>
      <div className="h-6 shrink-0 sm:h-10" />
    </div>
  );
}

function DownloadLink({
  item,
  className,
}: {
  item: EventGalleryImage;
  className?: string;
}) {
  const href = galleryDownloadUrl(item);
  if (!href) return null;
  const label = item.media_type === "video" ? "Download video" : "Download photo";
  return (
    <a
      href={href}
      download
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex items-center justify-center rounded-full",
        className,
      )}
    >
      <Download className="size-4" />
    </a>
  );
}

function ViewerVideo({ video }: { video: EventGalleryImage }) {
  const id = youTubeId(video.video_url);
  return (
    <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-16">
      {id ? (
        <iframe
          src={youTubeEmbed(id)}
          title={video.file_name}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="aspect-video w-full max-w-6xl max-h-full"
        />
      ) : (
        <video
          src={video.video_url ?? video.image_url}
          controls
          autoPlay
          playsInline
          className="max-h-full w-full max-w-6xl"
        />
      )}
    </div>
  );
}
