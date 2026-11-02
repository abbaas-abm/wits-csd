import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendPushToAll, sendPushToUsers } from "@/lib/push";
import { enqueue, getQueueCounts } from "@/lib/queue";
import { deliverAnnouncementEmail } from "@/lib/email/announcement";
import type { AnnouncementAudience, AudienceCounts } from "@/lib/announcements";

export const runtime = "nodejs";

// Admin-only.
//   GET  ?eventId=…  → audience sizes for the announcement form, plus the
//                      email queue's progress.
//   POST            → sends an already-posted announcement to an audience by
//                      push and/or email.

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured.", status: 500 };
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return { error: "Unauthorized.", status: 401 };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: "Forbidden.", status: 403 };

  const admin = tryCreateAdminClient();
  if (!admin) {
    return {
      error: "This action requires SUPABASE_SERVICE_ROLE_KEY on the server.",
      status: 500,
    };
  }
  return { admin };
}

/** Distinct attendee ids for an event, read in pages of 1000. */
async function eventPeople(
  admin: SupabaseClient,
  eventId: string,
  audience: "registered" | "checked-in",
): Promise<string[]> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    let query = admin
      .from(audience === "registered" ? "registrations" : "attendance")
      .select("attendee_id")
      .eq("event_id", eventId)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (audience === "registered") query = query.eq("status", "CONFIRMED");
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data ?? []) if (row.attendee_id) ids.add(row.attendee_id);
    if (!data || data.length < 1000) break;
  }
  return [...ids];
}

async function pushUserIds(admin: SupabaseClient) {
  const users = new Set<string>();
  let devices = 0;
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("push_subscriptions")
      .select("user_id")
      .order("id", { ascending: true })
      .range(from, from + 999);
    for (const row of data ?? []) {
      devices++;
      if (row.user_id) users.add(row.user_id);
    }
    if (!data || data.length < 1000) break;
  }
  return { users, devices };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const eventId = new URL(request.url).searchParams.get("eventId") ?? "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const [registered, checkedIn, push, queue] = await Promise.all([
    eventPeople(auth.admin, eventId, "registered"),
    eventPeople(auth.admin, eventId, "checked-in"),
    pushUserIds(auth.admin),
    getQueueCounts("announcements"),
  ]);
  const counts: AudienceCounts = {
    registered: registered.length,
    checkedIn: checkedIn.length,
    registeredWithPush: registered.filter((id) => push.users.has(id)).length,
    checkedInWithPush: checkedIn.filter((id) => push.users.has(id)).length,
    allDevices: push.devices,
  };
  return NextResponse.json({ ok: true, counts, queue });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const admin = auth.admin;

  const body = (await request.json().catch(() => ({}))) as {
    announcementId?: string;
    audience?: AnnouncementAudience;
    push?: boolean;
    email?: boolean;
    subject?: string;
  };
  const audience = body.audience;
  if (
    !body.announcementId ||
    !audience ||
    !["registered", "checked-in", "all-devices"].includes(audience)
  ) {
    return NextResponse.json(
      { error: "announcementId and a valid audience are required." },
      { status: 400 },
    );
  }

  const { data: announcement } = await admin
    .from("announcements")
    .select("id, text, link_url, event_id")
    .eq("id", body.announcementId)
    .maybeSingle();
  if (!announcement?.event_id) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }
  const { data: event } = await admin
    .from("events")
    .select("title")
    .eq("id", announcement.event_id)
    .maybeSingle();
  const title = event?.title ?? "Centre for Student Development";

  const people =
    audience === "all-devices"
      ? []
      : await eventPeople(admin, announcement.event_id, audience);

  const result: {
    push?: { sent: number; failed: number } | { error: string };
    email?: { mode: "queued" | "inline"; queued: number; failed?: number };
  } = {};

  if (body.push) {
    if (!pushConfigured()) {
      result.push = { error: "Push is not configured (missing VAPID keys)." };
    } else {
      const payload = {
        title,
        body: announcement.text,
        url: announcement.link_url ?? `/events/${announcement.event_id}`,
      };
      result.push =
        audience === "all-devices"
          ? await sendPushToAll(admin, payload)
          : await sendPushToUsers(admin, people, payload);
      console.log(`[announce] push ${JSON.stringify(result.push)}`);
    }
  }

  if (body.email && audience !== "all-devices" && people.length > 0) {
    const subject = body.subject?.trim() || `Update: ${title}`;
    const job = (attendeeId: string) => ({
      announcementId: announcement.id,
      attendeeId,
      subject,
    });
    const jobId = (attendeeId: string) => `${announcement.id}:${attendeeId}`;

    // Probe the queue with the first person; if Redis is up, queue the rest.
    const firstQueued = await enqueue(
      "announcements",
      "send-announcement",
      job(people[0]),
      jobId(people[0]),
    );
    if (firstQueued) {
      for (let i = 1; i < people.length; i += 200) {
        await Promise.all(
          people
            .slice(i, i + 200)
            .map((id) =>
              enqueue("announcements", "send-announcement", job(id), jobId(id)),
            ),
        );
      }
      result.email = { mode: "queued", queued: people.length };
    } else {
      // No Redis (local dev): send inline with modest concurrency.
      let cursor = 0;
      let failed = 0;
      await Promise.all(
        Array.from({ length: Math.min(5, people.length) }, async () => {
          while (cursor < people.length) {
            const id = people[cursor++];
            const r = await deliverAnnouncementEmail({
              supabase: admin,
              ...job(id),
            });
            if (r.status === "failed") failed++;
          }
        }),
      );
      result.email = { mode: "inline", queued: people.length, failed };
    }
    console.log(`[announce] email ${JSON.stringify(result.email)}`);
  }

  return NextResponse.json({ ok: true, recipients: people.length, ...result });
}
