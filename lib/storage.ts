import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const EVENT_IMAGE_BUCKET = "event_images";

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "png";
}

export async function uploadEventImage(
  file: File,
  folder: string,
): Promise<{ url: string; path: string }> {
  return uploadEventFile(file, folder, extensionFor(file), file.type);
}

/** Uploads any blob (e.g. a resized photo or a video) to the event bucket. */
export async function uploadEventFile(
  blob: Blob,
  folder: string,
  extension: string,
  contentType: string,
): Promise<{ url: string; path: string }> {
  const supabase = createClient();
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(EVENT_IMAGE_BUCKET)
    .upload(path, blob, { upsert: true, contentType });
  if (error) throw error;
  const { data } = supabase.storage
    .from(EVENT_IMAGE_BUCKET)
    .getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// Supabase's resumable endpoint requires exactly 6 MB chunks.
const RESUMABLE_CHUNK = 6 * 1024 * 1024;
const RESUMABLE_RETRIES = 4;

const base64 = (value: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(value)));

/**
 * Uploads a large file (e.g. an event video) with Supabase's resumable (TUS)
 * endpoint: 6 MB chunks, each retried on failure, with progress reporting.
 * A single-request upload of a few hundred MB tends to fail in the browser.
 */
export async function uploadEventFileResumable(
  file: File,
  folder: string,
  extension: string,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<{ url: string; path: string }> {
  const supabase = createClient();
  const { url: projectUrl, key } = getSupabaseEnv();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!projectUrl || !key || !session) {
    throw new Error("Please sign in again before uploading.");
  }

  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const auth = {
    authorization: `Bearer ${session.access_token}`,
    apikey: key,
    "tus-resumable": "1.0.0",
  };

  const create = await fetch(`${projectUrl}/storage/v1/upload/resumable`, {
    method: "POST",
    headers: {
      ...auth,
      "upload-length": String(file.size),
      "x-upsert": "true",
      "upload-metadata": [
        `bucketName ${base64(EVENT_IMAGE_BUCKET)}`,
        `objectName ${base64(path)}`,
        `contentType ${base64(contentType)}`,
        `cacheControl ${base64("3600")}`,
      ].join(","),
    },
  });
  const location = create.headers.get("location");
  if (!create.ok || !location) {
    throw new Error(
      (await create.text().catch(() => "")) ||
        `Upload could not start (${create.status}).`,
    );
  }

  let offset = 0;
  let failures = 0;
  while (offset < file.size) {
    try {
      const chunk = file.slice(offset, offset + RESUMABLE_CHUNK);
      const res = await fetch(location, {
        method: "PATCH",
        headers: {
          ...auth,
          "upload-offset": String(offset),
          "content-type": "application/offset+octet-stream",
        },
        body: chunk,
      });
      if (!res.ok) {
        throw new Error(
          (await res.text().catch(() => "")) || `Upload failed (${res.status}).`,
        );
      }
      offset = Number(res.headers.get("upload-offset") ?? offset + chunk.size);
      failures = 0;
      onProgress?.(offset / file.size);
    } catch (error) {
      if (++failures > RESUMABLE_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, 1000 * failures));
      // Ask the server how much it has, then carry on from there.
      const head = await fetch(location, { method: "HEAD", headers: auth }).catch(
        () => null,
      );
      const serverOffset = head?.headers.get("upload-offset");
      if (serverOffset) offset = Number(serverOffset);
    }
  }

  const { data } = supabase.storage.from(EVENT_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function removeEventImage(path: string | null | undefined) {
  if (!path) return;
  try {
    const supabase = createClient();
    await supabase.storage.from(EVENT_IMAGE_BUCKET).remove([path]);
  } catch {
    // Non-fatal: orphaned file is acceptable.
  }
}
