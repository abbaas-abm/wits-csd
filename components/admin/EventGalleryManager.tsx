"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  FolderUp,
  ImagePlus,
  Loader2,
  Pencil,
  Play,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { revalidateEvents } from "@/lib/cache-actions";
import {
  EVENT_IMAGE_BUCKET,
  uploadEventFile,
  uploadEventFileResumable,
} from "@/lib/storage";
import {
  GALLERY_MAX_EDGE,
  albumFromFolder,
  galleryVideos,
  groupAlbums,
  resizeForGallery,
  youTubeId,
  youTubeThumbnail,
} from "@/lib/gallery";
import type { EventGalleryImage } from "@/lib/types";

const TABLE = "event_gallery_images";
const DEFAULT_ALBUM = "Photos";
const UPLOAD_CONCURRENCY = 4;
const PREVIEW_COUNT = 12;
const PHOTO_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;
const MIGRATION_HINT =
  "The gallery needs a database update. Run supabase/fixes/gallery_albums_video.sql in the Supabase SQL editor, then try again.";

interface PendingPhoto {
  file: File;
  album: string | null;
}

interface UploadProgress {
  done: number;
  total: number;
  failed: number;
}

function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/album|media_type|video_url|schema cache/i.test(message)) {
    return MIGRATION_HINT;
  }
  if (/maximum allowed size|exceeded|too large|413/i.test(message)) {
    return "This file is larger than the storage upload limit. Raise the limit in Supabase → Storage → Settings (e.g. to 500 MB), or upload the video to YouTube and add it as a link.";
  }
  return message || fallback;
}

const byOrder = (a: EventGalleryImage, b: EventGalleryImage) =>
  a.display_order - b.display_order ||
  a.created_at.localeCompare(b.created_at);

/**
 * Admin gallery for an event: photos grouped into albums (one per uploaded
 * folder), plus videos. Photos are resized in the browser before upload.
 */
export function EventGalleryManager({ eventId }: { eventId: string }) {
  const [items, setItems] = React.useState<EventGalleryImage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [progress, setProgress] = React.useState<UploadProgress | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [albumInput, setAlbumInput] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [videoOpen, setVideoOpen] = React.useState(false);
  const filesRef = React.useRef<HTMLInputElement>(null);
  const folderRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const all: EventGalleryImage[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from(TABLE)
          .select("*")
          .eq("event_id", eventId)
          .order("display_order", { ascending: true })
          .range(from, from + 999);
        if (error || !data) break;
        all.push(...(data as EventGalleryImage[]));
        if (data.length < 1000) break;
      }
      if (active) {
        setItems(all);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [eventId]);

  // Warn before leaving mid-upload.
  React.useEffect(() => {
    if (!progress) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [progress]);

  const sorted = React.useMemo(() => [...items].sort(byOrder), [items]);
  const albums = React.useMemo(() => groupAlbums(sorted), [sorted]);
  const videos = React.useMemo(() => galleryVideos(sorted), [sorted]);
  const nextOrder = sorted.length
    ? sorted[sorted.length - 1].display_order + 1
    : 0;

  async function uploadPhotos(pending: PendingPhoto[], skippedOther: number) {
    // Skip photos already in the gallery, so a failed upload can simply be
    // re-run with the same folder.
    const existing = new Set(
      items.map((item) => `${item.album ?? ""}/${item.file_name}`),
    );
    const queue = pending
      .filter((p) => !existing.has(`${p.album ?? ""}/${p.file.name}`))
      .sort(
        (a, b) =>
          (a.album ?? "").localeCompare(b.album ?? "", undefined, {
            numeric: true,
          }) ||
          a.file.name.localeCompare(b.file.name, undefined, { numeric: true }),
      );
    const duplicates = pending.length - queue.length;

    if (queue.length === 0) {
      toast.info(
        duplicates > 0
          ? "Those photos are already in the gallery."
          : "No photos found to upload.",
      );
      return;
    }

    const startOrder = nextOrder;
    const supabase = createClient();
    let done = 0;
    let failed = 0;
    let firstError: unknown = null;
    setProgress({ done: 0, total: queue.length, failed: 0 });

    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const index = cursor++;
        const { file, album } = queue[index];
        try {
          const { blob, width, height } = await resizeForGallery(file);
          const { url, path } = await uploadEventFile(
            blob,
            `events/${eventId}/gallery`,
            "jpg",
            "image/jpeg",
          );
          const { data, error } = await supabase
            .from(TABLE)
            .insert({
              event_id: eventId,
              file_name: file.name,
              image_url: url,
              object_key: path,
              display_order: startOrder + index,
              album,
              media_type: "image",
              width,
              height,
            })
            .select("*")
            .single();
          if (error) throw error;
          setItems((prev) => [...prev, data as EventGalleryImage]);
        } catch (error) {
          failed++;
          firstError ??= error;
        } finally {
          done++;
          setProgress({ done, total: queue.length, failed });
        }
      }
    }

    await Promise.all(
      Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()),
    );
    setProgress(null);
    void revalidateEvents();

    const added = queue.length - failed;
    const notes = [
      duplicates > 0 && `${duplicates} already uploaded`,
      skippedOther > 0 && `${skippedOther} non-photo file${skippedOther === 1 ? "" : "s"} skipped`,
    ].filter(Boolean);
    if (failed > 0) {
      toast.error(
        `${added} of ${queue.length} photos added; ${failed} failed. ${friendlyError(firstError, "")} Re-run the same upload to retry the missing ones.`,
        { duration: 12000 },
      );
    } else {
      toast.success(
        `${added} photo${added === 1 ? "" : "s"} added.${notes.length ? ` (${notes.join(", ")})` : ""}`,
      );
    }
  }

  function collect(files: FileList | null, fromFolder: boolean) {
    const list = Array.from(files ?? []);
    const photos = list.filter((file) => PHOTO_EXTENSIONS.test(file.name));
    const typedAlbum = albumInput.trim() || null;
    const pending = photos.map((file) => {
      if (!fromFolder) return { file, album: typedAlbum };
      // Each photo's own folder becomes its album.
      const parts = file.webkitRelativePath.split("/");
      const folder = parts.length >= 2 ? parts[parts.length - 2] : null;
      return { file, album: folder ? albumFromFolder(folder) : typedAlbum };
    });
    return { pending, skipped: list.length - photos.length };
  }

  function handlePick(
    e: React.ChangeEvent<HTMLInputElement>,
    fromFolder: boolean,
  ) {
    const { pending, skipped } = collect(e.target.files, fromFolder);
    e.target.value = "";
    void uploadPhotos(pending, skipped);
  }

  /** Rows matching an album, treating the default album as "no album". */
  function albumIds(name: string) {
    return sorted
      .filter(
        (item) =>
          item.media_type === "image" &&
          (item.album?.trim() || DEFAULT_ALBUM) === name,
      )
      .map((item) => item.id);
  }

  async function renameAlbum(name: string) {
    const next = window.prompt("Rename album", name)?.trim();
    if (!next || next === name) return;
    const ids = albumIds(name);
    setBusy(`album:${name}`);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(TABLE)
        .update({ album: next })
        .in("id", ids);
      if (error) throw error;
      setItems((prev) =>
        prev.map((item) =>
          ids.includes(item.id) ? { ...item, album: next } : item,
        ),
      );
      void revalidateEvents();
      toast.success("Album renamed.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not rename album."));
    } finally {
      setBusy(null);
    }
  }

  async function moveAlbum(name: string, delta: -1 | 1) {
    const order = albums.map((a) => a.name);
    const from = order.indexOf(name);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];

    // Renumber every photo so albums follow the new order; videos go last.
    const reordered = [
      ...order.flatMap((n) => albums.find((a) => a.name === n)!.items),
      ...videos,
    ].map((item, i) => ({ ...item, display_order: i }));

    setBusy(`album:${name}`);
    try {
      const supabase = createClient();
      const { error } = await supabase.from(TABLE).upsert(reordered);
      if (error) throw error;
      setItems(reordered);
      void revalidateEvents();
    } catch (error) {
      toast.error(friendlyError(error, "Could not reorder albums."));
    } finally {
      setBusy(null);
    }
  }

  async function deleteItems(targets: EventGalleryImage[]) {
    const supabase = createClient();
    for (let i = 0; i < targets.length; i += 100) {
      const chunk = targets.slice(i, i + 100);
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .in(
          "id",
          chunk.map((item) => item.id),
        );
      if (error) throw error;
      const keys = chunk
        .map((item) => item.object_key)
        .filter((key): key is string => Boolean(key));
      if (keys.length) {
        // Non-fatal: an orphaned file is acceptable.
        await supabase.storage.from(EVENT_IMAGE_BUCKET).remove(keys);
      }
      const removed = new Set(chunk.map((item) => item.id));
      setItems((prev) => prev.filter((item) => !removed.has(item.id)));
    }
    void revalidateEvents();
  }

  async function deleteAlbum(name: string) {
    const targets = albums.find((a) => a.name === name)?.items ?? [];
    if (
      !window.confirm(
        `Delete the album "${name}" and its ${targets.length} photos? This cannot be undone.`,
      )
    )
      return;
    setBusy(`album:${name}`);
    try {
      await deleteItems(targets);
      toast.success("Album deleted.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not delete album."));
    } finally {
      setBusy(null);
    }
  }

  async function deleteOne(item: EventGalleryImage) {
    if (!window.confirm(`Remove ${item.media_type === "video" ? "this video" : "this photo"}?`))
      return;
    setBusy(item.id);
    try {
      await deleteItems([item]);
      toast.success("Removed.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not remove."));
    } finally {
      setBusy(null);
    }
  }

  const uploading = progress !== null;
  const photoCount = sorted.length - videos.length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gallery</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Post-event photos and videos, shown on the event page and its
            gallery page.{" "}
            {!loading &&
              `${photoCount} photo${photoCount === 1 ? "" : "s"} in ${albums.length} album${albums.length === 1 ? "" : "s"}, ${videos.length} video${videos.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setVideoOpen(true)}
          disabled={uploading}
        >
          <Video className="size-4" />
          Add video
        </Button>
      </div>

      <Card className="space-y-4 border-gray-200 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="gallery-album">Album for loose photos</Label>
            <Input
              id="gallery-album"
              list="gallery-albums"
              placeholder={`e.g. Day 1 – Speakers (blank = “${DEFAULT_ALBUM}”)`}
              value={albumInput}
              onChange={(e) => setAlbumInput(e.target.value)}
              disabled={uploading}
            />
            <datalist id="gallery-albums">
              {albums.map((a) => (
                <option key={a.name} value={a.name} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => filesRef.current?.click()}
              disabled={uploading}
            >
              <ImagePlus className="size-4" />
              Add photos
            </Button>
            <Button
              onClick={() => folderRef.current?.click()}
              disabled={uploading}
            >
              <FolderUp className="size-4" />
              Upload folder
            </Button>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-gray-700">Upload folder</span>{" "}
          turns every sub-folder into an album (e.g. “Day_1_-_Speakers” becomes
          “Day 1 – Speakers”). Photos are resized to {GALLERY_MAX_EDGE}px before upload,
          and photos already in the gallery are skipped, so you can safely
          re-run an upload that was interrupted.
        </p>
        <input
          ref={filesRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handlePick(e, false)}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handlePick(e, true)}
          {...{ webkitdirectory: "", directory: "" }}
        />

        {progress && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                <Loader2 className="size-4 animate-spin" />
                Uploading {progress.done} of {progress.total}
              </span>
              {progress.failed > 0 && (
                <span className="text-destructive">
                  {progress.failed} failed
                </span>
              )}
            </div>
            <Progress value={(progress.done / progress.total) * 100} />
            <p className="text-xs text-muted-foreground">
              Keep this tab open until the upload finishes.
            </p>
          </div>
        )}
      </Card>

      {loading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <ImagePlus className="size-6 text-gray-400" />
          <h4 className="mt-3 text-sm font-semibold text-gray-900">
            No gallery photos yet
          </h4>
          <p className="mt-1 text-sm text-gray-600">
            Upload the photographer&apos;s folder to create albums.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {videos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Videos</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-slate-900"
                  >
                    {youTubeId(video.video_url) ? (
                      <Image
                        src={video.image_url}
                        alt=""
                        fill
                        sizes="320px"
                        className="object-cover"
                      />
                    ) : (
                      <video
                        src={`${video.video_url ?? video.image_url}#t=0.5`}
                        preload="metadata"
                        muted
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-3">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                        <Play className="size-3.5 fill-current" />
                        {video.file_name}
                      </span>
                    </div>
                    <DeleteButton
                      busy={busy === video.id}
                      onClick={() => deleteOne(video)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {albums.map((album, i) => {
            const open = expanded.has(album.name);
            const shown = open ? album.items : album.items.slice(0, PREVIEW_COUNT);
            const albumBusy = busy === `album:${album.name}`;
            return (
              <div key={album.name}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {album.name}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {album.items.length}
                    </span>
                  </h4>
                  <div className="flex items-center gap-1">
                    {albumBusy && (
                      <Loader2 className="mr-1 size-4 animate-spin text-muted-foreground" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move album up"
                      disabled={i === 0 || Boolean(busy) || uploading}
                      onClick={() => moveAlbum(album.name, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move album down"
                      disabled={
                        i === albums.length - 1 || Boolean(busy) || uploading
                      }
                      onClick={() => moveAlbum(album.name, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Rename album"
                      disabled={Boolean(busy) || uploading}
                      onClick={() => renameAlbum(album.name)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete album"
                      className="text-destructive hover:text-destructive"
                      disabled={Boolean(busy) || uploading}
                      onClick={() => deleteAlbum(album.name)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {shown.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-slate-100"
                    >
                      <Image
                        src={photo.image_url}
                        alt={photo.file_name}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                      <DeleteButton
                        busy={busy === photo.id}
                        onClick={() => deleteOne(photo)}
                      />
                    </div>
                  ))}
                </div>
                {album.items.length > PREVIEW_COUNT && (
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-primary hover:underline"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (open) next.delete(album.name);
                        else next.add(album.name);
                        return next;
                      })
                    }
                  >
                    {open
                      ? "Show fewer"
                      : `Show all ${album.items.length} photos`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddVideoDialog
        open={videoOpen}
        onOpenChange={setVideoOpen}
        eventId={eventId}
        displayOrder={nextOrder}
        onAdded={(video) => {
          setItems((prev) => [...prev, video]);
          void revalidateEvents();
        }}
      />
    </section>
  );
}

function DeleteButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Remove"
      className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-white/90 text-destructive opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100"
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </button>
  );
}

function AddVideoDialog({
  open,
  onOpenChange,
  eventId,
  displayOrder,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  displayOrder: number;
  onAdded: (video: EventGalleryImage) => void;
}) {
  const [title, setTitle] = React.useState("After movie");
  const [link, setLink] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploaded, setUploaded] = React.useState<number | null>(null);

  const linkId = youTubeId(link.trim());
  const canSave = title.trim() && (linkId || file) && !saving;

  async function save() {
    setSaving(true);
    try {
      let videoUrl: string;
      let imageUrl: string;
      let objectKey: string | null = null;

      if (linkId) {
        videoUrl = `https://www.youtube.com/watch?v=${linkId}`;
        imageUrl = youTubeThumbnail(linkId);
      } else if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
        setUploaded(0);
        const { url, path } = await uploadEventFileResumable(
          file,
          `events/${eventId}/gallery/videos`,
          extension,
          // Browsers report .m4v as video/x-m4v; serve it as MP4 so every
          // browser plays it.
          extension === "m4v" || !file.type ? "video/mp4" : file.type,
          setUploaded,
        );
        videoUrl = url;
        imageUrl = url;
        objectKey = path;
      } else {
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          event_id: eventId,
          file_name: title.trim(),
          image_url: imageUrl,
          object_key: objectKey,
          video_url: videoUrl,
          media_type: "video",
          display_order: displayOrder,
        })
        .select("*")
        .single();
      if (error) throw error;

      onAdded(data as EventGalleryImage);
      toast.success("Video added.");
      setLink("");
      setFile(null);
      onOpenChange(false);
    } catch (error) {
      toast.error(friendlyError(error, "Could not add video."), {
        duration: 10000,
      });
    } finally {
      setSaving(false);
      setUploaded(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add video</DialogTitle>
          <DialogDescription>
            Paste a YouTube link (recommended: it streams smoothly on any
            connection), or upload a short video file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="video-title">Title</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-link">YouTube link</Label>
            <Input
              id="video-link"
              placeholder="https://youtu.be/…"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                if (e.target.value) setFile(null);
              }}
              disabled={saving}
            />
            {link.trim() && !linkId && (
              <p className="text-xs text-destructive">
                That doesn&apos;t look like a YouTube link.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-file">Or upload a file</Label>
            <Input
              id="video-file"
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.m4v"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                if (e.target.files?.[0]) setLink("");
              }}
              disabled={saving || Boolean(link)}
            />
            {file && uploaded === null && (
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(0)} MB. Uploaded in
                resumable chunks; keep this window open until it finishes.
              </p>
            )}
            {uploaded !== null && file && (
              <div className="space-y-1.5 pt-1">
                <Progress value={uploaded * 100} />
                <p className="text-xs tabular-nums text-muted-foreground">
                  {Math.round((uploaded * file.size) / 1024 / 1024)} of{" "}
                  {Math.round(file.size / 1024 / 1024)} MB uploaded
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? (file ? "Uploading…" : "Saving…") : "Add video"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
