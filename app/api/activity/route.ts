import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  AUTH_ACTIONS,
  GALLERY_ACTIONS,
  type AuthAction,
  type GalleryAction,
} from "@/lib/activity";

export const runtime = "nodejs";

// Records things that happen in the browser and never reach the database:
// sign-in steps (code requested, wrong code, signed in, signed out) and
// gallery use (video played or watched to the end, photo/video downloaded).
// Everything else in the activity log is written by database triggers.
//
// Public on purpose (sign-in and the gallery work signed out), so it only
// accepts known actions, caps field sizes, rate-limits per IP and always
// answers 204.

const WINDOW_MS = 60_000;
// Generous enough for someone downloading a whole album.
const MAX_PER_WINDOW = 120;
const hits = new Map<string, { count: number; resetAt: number }>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(request: Request): string | null {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) {
      for (const [key, value] of hits) if (value.resetAt < now) hits.delete(key);
    }
    return false;
  }
  entry.count++;
  return entry.count > MAX_PER_WINDOW;
}

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (rateLimited(ip ?? "unknown")) return done();

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const action = typeof body.action === "string" ? body.action : "";
  const isAuth = AUTH_ACTIONS.includes(action as AuthAction);
  const isGallery = GALLERY_ACTIONS.includes(action as GalleryAction);
  if (!isAuth && !isGallery) return done();

  const eventId = text(body.eventId, 36);
  const itemId = text(body.itemId, 36);
  if (isGallery && (!eventId || !UUID.test(eventId) || (itemId && !UUID.test(itemId)))) {
    return done();
  }

  const admin = tryCreateAdminClient();
  if (!admin) return done();

  let actorId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = (await supabase?.auth.getUser()) ?? { data: null };
    actorId = data?.user?.id ?? null;
  } catch {
    actorId = null;
  }

  const error = text(body.error, 300);
  const row = isAuth
    ? {
        category: "sign-in",
        action: `auth.${action}`,
        email: text(body.email, 254)?.toLowerCase() ?? null,
        details: error ? { error } : {},
      }
    : {
        category: "gallery",
        action: `gallery.${action}`,
        event_id: eventId,
        record_id: itemId,
        details: {
          name: text(body.name, 200),
          album: text(body.album, 120),
        },
      };

  const { error: insertError } = await admin.from("activity_log").insert({
    ...row,
    actor_id: actorId,
    subject_id: actorId,
    ip,
    user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
  });
  if (insertError) console.error("[activity] insert failed:", insertError.message);

  return done();
}
