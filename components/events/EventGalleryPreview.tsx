import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Images, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { galleryVideos, groupAlbums } from "@/lib/gallery";
import type { EventGalleryImage } from "@/lib/types";

/**
 * Event page teaser for the gallery: a small collage that links through to
 * the full gallery page.
 */
export function EventGalleryPreview({
  eventId,
  items,
  coverUrl,
}: {
  eventId: string;
  items: EventGalleryImage[];
  coverUrl?: string | null;
}) {
  const albums = groupAlbums(items);
  const videos = galleryVideos(items);
  // The chosen cover leads, then one photo from each album, so the collage
  // shows the range.
  const photos = [
    ...albums.map((album) => album.items[0]),
    ...albums.flatMap((album) => album.items.slice(1)),
  ];
  const cover = photos.find((photo) => photo.image_url === coverUrl);
  const picks = (
    cover ? [cover, ...photos.filter((photo) => photo !== cover)] : photos
  ).slice(0, 5);
  const photoCount = items.length - videos.length;
  const href = `/events/${eventId}/gallery`;

  return (
    <Card className="border-gray-200 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Gallery</h2>
          <p className="mt-1 text-sm text-gray-500">
            {photoCount} photo{photoCount === 1 ? "" : "s"}
            {albums.length > 1 && ` in ${albums.length} albums`}
            {videos.length > 0 &&
              ` · ${videos.length} video${videos.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          View gallery
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <Link
        href={href}
        className="group mt-5 grid grid-cols-4 grid-rows-2 gap-1.5 overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-72"
        aria-label="Open the gallery"
      >
        {picks.map((photo, i) => (
          <div
            key={photo.id}
            className={
              i === 0
                ? "relative col-span-4 row-span-2 aspect-[3/2] bg-slate-100 sm:col-span-2 sm:aspect-auto"
                : "relative hidden aspect-square bg-slate-100 sm:block sm:aspect-auto"
            }
          >
            <Image
              src={photo.image_url}
              alt=""
              fill
              sizes={i === 0 ? "(max-width: 640px) 100vw, 400px" : "200px"}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            {i === picks.length - 1 && (
              <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 text-sm font-semibold text-white">
                <Images className="size-4" />
                See all
              </span>
            )}
          </div>
        ))}
      </Link>

      {videos.length > 0 && (
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-wits-blue-dark"
        >
          <Play className="size-4 fill-current" />
          Watch {videos[0].file_name}
        </Link>
      )}
    </Card>
  );
}
