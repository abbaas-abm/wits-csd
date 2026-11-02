"use client";

import * as React from "react";
import { toast } from "sonner";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { EventGalleryManager } from "@/components/admin/EventGalleryManager";
import { createClient } from "@/lib/supabase/client";
import { storagePathFromPublicUrl } from "@/lib/utils";
import { EVENT_IMAGE_BUCKET } from "@/lib/storage";
import type { EventRecord } from "@/lib/types";

export function EventMediaTab({ event }: { event: EventRecord }) {
  const [coverUrl, setCoverUrl] = React.useState<string | null>(
    event.cover_image_url,
  );
  const [featuredUrl, setFeaturedUrl] = React.useState<string | null>(
    event.featured_image_url,
  );

  async function updateEventImage(
    field: "cover" | "featured",
    url: string | null,
  ) {
    const key = storagePathFromPublicUrl(url, EVENT_IMAGE_BUCKET);
    if (field === "cover") setCoverUrl(url);
    else setFeaturedUrl(url);

    const supabase = createClient();
    const { error } = await supabase
      .from("events")
      .update(
        field === "cover"
          ? { cover_image_url: url, cover_image_key: key }
          : { featured_image_url: url, featured_image_key: key },
      )
      .eq("id", event.id);
    if (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Cover image
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The wide banner shown at the top of the public event page.
          </p>
        </div>
        <ImageUploader
          label="Cover banner"
          recommended="1400 × 560 px"
          aspect="aspect-[5/2]"
          folder={`events/${event.id}/cover`}
          value={coverUrl}
          onChange={(url) => updateEventImage("cover", url)}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Featured image
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A square image used on event cards and listings.
          </p>
        </div>
        <div className="max-w-xs">
          <ImageUploader
            label="Featured image"
            recommended="600 × 600 px"
            aspect="aspect-square"
            folder={`events/${event.id}/featured`}
            value={featuredUrl}
            onChange={(url) => updateEventImage("featured", url)}
          />
        </div>
      </section>

      <EventGalleryManager eventId={event.id} />
    </div>
  );
}
