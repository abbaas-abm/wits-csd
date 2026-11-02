import type { SupabaseClient } from "@supabase/supabase-js";
import {
  renderAnnouncementHtml,
  type AnnouncementContext,
} from "@/lib/email/announcement-template";

const SENDER = { name: "Wits CSD", email: "reminders@witscsd.co.za" };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// A batch sends the same announcement to thousands of people; cache it per
// worker process instead of re-reading it for every email.
const contextCache = new Map<string, Promise<AnnouncementContext | null>>();

function loadContext(supabase: SupabaseClient, announcementId: string) {
  let cached = contextCache.get(announcementId);
  if (!cached) {
    cached = (async () => {
      const { data: announcement } = await supabase
        .from("announcements")
        .select("text, link_url, link_label, event_id")
        .eq("id", announcementId)
        .maybeSingle();
      if (!announcement?.event_id) return null;
      const { data: event } = await supabase
        .from("events")
        .select("title")
        .eq("id", announcement.event_id)
        .maybeSingle();
      if (!event) return null;
      return {
        text: announcement.text,
        linkUrl: announcement.link_url,
        linkLabel: announcement.link_label,
        eventId: announcement.event_id,
        eventTitle: event.title,
      };
    })();
    contextCache.set(announcementId, cached);
    // Drop failed lookups so a retry reads again.
    cached.then((value) => {
      if (!value) contextCache.delete(announcementId);
    });
  }
  return cached;
}

export interface AnnouncementEmailResult {
  status: "sent" | "failed";
  error?: string;
}

export async function deliverAnnouncementEmail({
  supabase,
  announcementId,
  attendeeId,
  subject,
  throwOnError = false,
}: {
  supabase: SupabaseClient;
  announcementId: string;
  attendeeId: string;
  subject: string;
  throwOnError?: boolean;
}): Promise<AnnouncementEmailResult> {
  try {
    const key = process.env.PLUNK_SECRET_KEY;
    if (!key) throw new Error("PLUNK_SECRET_KEY is not set");

    const [ctx, { data: profile }] = await Promise.all([
      loadContext(supabase, announcementId),
      supabase
        .from("profiles")
        .select("first_name,last_name,email")
        .eq("id", attendeeId)
        .maybeSingle(),
    ]);
    if (!ctx) throw new Error("Announcement not found.");
    const to = String(profile?.email ?? "").trim();
    if (!isValidEmail(to)) {
      return { status: "failed", error: "Missing or invalid email address" };
    }
    const name = profile?.first_name?.trim() || "there";

    const response = await fetch("https://next-api.useplunk.com/v1/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        from: SENDER,
        body: renderAnnouncementHtml(name, ctx),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      // Only retry transient Plunk failures; skip validation errors.
      const retryable = response.status === 429 || response.status >= 500;
      if (throwOnError && retryable) {
        throw new Error(`Plunk error ${response.status}: ${text}`);
      }
      console.error(`Announcement not sent (${response.status}) to ${to}: ${text}`);
      return { status: "failed", error: `Plunk error ${response.status}` };
    }
    return { status: "sent" };
  } catch (error) {
    console.error("Announcement email failed:", error);
    if (throwOnError) throw error;
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
