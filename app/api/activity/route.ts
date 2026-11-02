import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { AUTH_ACTIONS, type AuthAction } from "@/lib/activity";

export const runtime = "nodejs";

// Records sign-in steps that happen in the browser and never reach the
// database (code requested, wrong code, signed in, signed out). Everything
// else in the activity log is written by database triggers.
//
// Public on purpose (people aren't signed in yet), so it only accepts known
// actions, caps field sizes, rate-limits per IP and always answers 204.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

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

const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (rateLimited(ip ?? "unknown")) return done();

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
    error?: string;
  };
  if (!body.action || !AUTH_ACTIONS.includes(body.action as AuthAction)) {
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

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase().slice(0, 254) || null
      : null;
  const error =
    typeof body.error === "string" ? body.error.slice(0, 300) : undefined;

  const { error: insertError } = await admin.from("activity_log").insert({
    category: "sign-in",
    action: `auth.${body.action}`,
    actor_id: actorId,
    subject_id: actorId,
    email,
    ip,
    user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
    details: error ? { error } : {},
  });
  if (insertError) console.error("[activity] insert failed:", insertError.message);

  return done();
}
