import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { EventGallery } from "@/components/events/EventGallery";
import { getCachedEventGallery, getEventById } from "@/lib/data";
import { galleryVideos } from "@/lib/gallery";
import { formatDate } from "@/lib/utils";

export async function generateMetadata(
  props: PageProps<"/events/[id]/gallery">,
): Promise<Metadata> {
  const { id } = await props.params;
  const event = await getEventById(id);
  return { title: event ? `${event.title} — Gallery` : "Gallery" };
}

export default async function EventGalleryPage(
  props: PageProps<"/events/[id]/gallery">,
) {
  const { id } = await props.params;
  const { album } = await props.searchParams;
  const [event, items] = await Promise.all([
    getEventById(id),
    getCachedEventGallery(id),
  ]);

  // The gallery follows the event's Media visibility switch.
  if (!event || !event.has_media || items.length === 0) notFound();

  const videoCount = galleryVideos(items).length;
  const photoCount = items.length - videoCount;
  const cover =
    event.gallery_cover_url ??
    event.cover_image_url ??
    items.find((item) => item.media_type === "image")?.image_url ??
    null;

  return (
    <div className="w-full bg-white pb-16">
      <section className="relative isolate flex min-h-[60vh] items-center justify-center overflow-hidden bg-primary sm:min-h-[70vh]">
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/45 to-primary/85" />

        <Link
          href={`/events/${event.id}`}
          className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25 sm:left-6 sm:top-6"
        >
          <ArrowLeft className="size-4" />
          Event page
        </Link>

        <div className="relative z-10 px-4 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d9b45b]">
            Gallery
          </p>
          <h1 className="mx-auto mt-3 max-w-4xl text-3xl font-semibold leading-tight text-balance sm:text-5xl">
            {event.title}
          </h1>
          <p className="mt-4 text-sm text-white/80 sm:text-base">
            {formatDate(event.start_date, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            <span className="mx-2 text-white/40">·</span>
            {photoCount} photo{photoCount === 1 ? "" : "s"}
            {videoCount > 0 && (
              <>
                <span className="mx-2 text-white/40">·</span>
                {videoCount} video{videoCount === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>
      </section>

      <EventGallery
        items={items}
        initialAlbum={typeof album === "string" ? album : null}
      />
    </div>
  );
}
