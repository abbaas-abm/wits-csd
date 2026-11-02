/** Sign-in steps the browser reports to /api/activity. */
export const AUTH_ACTIONS = [
  "otp_requested",
  "otp_resent",
  "otp_request_failed",
  "otp_verified",
  "otp_failed",
  "signed_out",
] as const;

/** Gallery interactions the browser reports to /api/activity. */
export const GALLERY_ACTIONS = [
  "video_played",
  "video_completed",
  "video_downloaded",
  "photo_downloaded",
] as const;

export type AuthAction = (typeof AUTH_ACTIONS)[number];
export type GalleryAction = (typeof GALLERY_ACTIONS)[number];

function send(body: object) {
  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Lets the request finish even if the page navigates away right after
      // (sign-out, or a download that opens a new response).
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Logging must never get in the way.
  }
}

/**
 * Fire-and-forget: records a sign-in step in the activity log. Never throws
 * and never delays the sign-in flow.
 */
export function logAuthActivity(
  action: AuthAction,
  data: { email?: string; error?: string } = {},
) {
  send({ action, ...data });
}

/** Fire-and-forget: records a gallery view or download. */
export function logGalleryActivity(
  action: GalleryAction,
  item: {
    id: string;
    event_id: string;
    file_name: string;
    album: string | null;
  },
) {
  send({
    action,
    eventId: item.event_id,
    itemId: item.id,
    name: item.file_name,
    album: item.album,
  });
}
