import type { EventGalleryImage } from "@/lib/types";

/** Longest edge, in pixels, that gallery photos are stored at. */
export const GALLERY_MAX_EDGE = 2048;
const GALLERY_JPEG_QUALITY = 0.82;

export interface GalleryAlbum {
  name: string;
  items: EventGalleryImage[];
}

/**
 * Photos grouped into albums, in display order. Albums are ordered by their
 * first photo, so reordering photos also reorders albums. Videos are left out
 * — they are shown on their own above the albums.
 */
export function groupAlbums(items: EventGalleryImage[]): GalleryAlbum[] {
  const albums = new Map<string, EventGalleryImage[]>();
  for (const item of items) {
    if (item.media_type === "video") continue;
    const name = item.album?.trim() || "Photos";
    const list = albums.get(name);
    if (list) list.push(item);
    else albums.set(name, [item]);
  }
  return Array.from(albums, ([name, list]) => ({ name, items: list }));
}

export function galleryVideos(items: EventGalleryImage[]) {
  return items.filter((item) => item.media_type === "video");
}

/**
 * Turns a download folder name into an album title, e.g.
 * "Day_1_-_Pre_event" → "Day 1 – Pre event".
 */
export function albumFromFolder(folder: string): string {
  return folder
    .replace(/_/g, " ")
    .replace(/\s*-\s*/g, " – ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A link that downloads a gallery file instead of opening it. Supabase serves
 * public objects with `Content-Disposition: attachment` when `?download=` is
 * set; the file is saved under the photo's original name.
 */
export function galleryDownloadUrl(item: EventGalleryImage): string | null {
  const url = item.media_type === "video" ? item.video_url : item.image_url;
  // YouTube videos can't be downloaded.
  if (!url || !item.object_key) return null;
  const extension = item.object_key.split(".").pop() ?? "jpg";
  const base =
    item.media_type === "video"
      ? item.file_name
      : item.file_name.replace(/\.[^.]+$/, "");
  const name = `${base.replace(/[^\w\- ()]+/g, "").trim() || "photo"}.${extension}`;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}download=${encodeURIComponent(name)}`;
}

export function youTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

export function youTubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youTubeEmbed(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

/**
 * Browser-only: re-encodes a photo as a JPEG no larger than GALLERY_MAX_EDGE,
 * honouring EXIF orientation. Camera originals (~8 MB) come out at ~400 KB.
 */
export async function resizeForGallery(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(
      1,
      GALLERY_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", GALLERY_JPEG_QUALITY),
    );
    if (!blob) throw new Error(`Could not process ${file.name}.`);
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
