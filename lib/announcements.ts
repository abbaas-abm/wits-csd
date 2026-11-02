/** Public origin used for links in emails and push notifications. */
export const SITE_URL = "https://witscsd.co.za";

/**
 * Who an announcement is sent to:
 * - registered:  everyone with a confirmed registration for the event
 * - checked-in:  everyone scanned in at the event
 * - all-devices: every device that turned on notifications (any event)
 */
export type AnnouncementAudience = "registered" | "checked-in" | "all-devices";

export interface AudienceCounts {
  registered: number;
  checkedIn: number;
  registeredWithPush: number;
  checkedInWithPush: number;
  allDevices: number;
}

/** Internal links are site paths ("/events/…"); anything else is external. */
export function isInternalLink(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

/** Accepts a site path or an http(s) URL; returns the cleaned link or null. */
export function normaliseLink(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (isInternalLink(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** A link usable outside the site (emails, notifications). */
export function absoluteLink(url: string): string {
  return isInternalLink(url) ? `${SITE_URL}${url}` : url;
}
