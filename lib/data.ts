import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import type {
  EventRecord,
  EventGalleryImage,
  EventFeatured,
  Announcement,
  AnnouncementWithEvent,
  ReflectionWithUser,
  PledgeWithUser,
  ProgramBlock,
  Speaker,
  Profile,
  Registration,
  Feedback,
} from "@/lib/types";

export async function getEvents(): Promise<EventRecord[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("start_date", { ascending: true });
    if (error) throw error;
    return (data ?? []) as EventRecord[];
  } catch {
    return [];
  }
}

export async function getFeaturedEvent(): Promise<EventRecord | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as EventRecord) ?? null;
  } catch {
    return null;
  }
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as EventRecord) ?? null;
  } catch {
    return null;
  }
}

export interface ProgramBlockWithSpeakers extends ProgramBlock {
  speakers: Speaker[];
}

export async function getEventProgram(
  eventId: string,
): Promise<ProgramBlockWithSpeakers[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("event_program_blocks")
      .select(
        "*, event_program_block_speakers(speaker:speakers(*))",
      )
      .eq("event_id", eventId)
      .order("day_number", { ascending: true })
      .order("display_order", { ascending: true });
    if (error) throw error;

    const blocks = (data ?? []) as unknown as Array<
      ProgramBlock & {
        event_program_block_speakers?: Array<{ speaker: Speaker }>;
      }
    >;

    return blocks.map(({ event_program_block_speakers, ...block }) => ({
      ...block,
      speakers: (event_program_block_speakers ?? [])
        .map((entry) => entry.speaker)
        .filter(Boolean),
    })) as ProgramBlockWithSpeakers[];
  } catch {
    return [];
  }
}

export interface RegistrationWithEvent extends Registration {
  event: EventRecord;
}

export async function getUserRegistrations(userId: string): Promise<RegistrationWithEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("registrations")
      .select("*, event:events(*)")
      .eq("attendee_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Most recent event (by event date) first.
    return ((data ?? []) as unknown as RegistrationWithEvent[]).sort(
      (a, b) =>
        new Date(b.event?.start_date ?? 0).getTime() -
        new Date(a.event?.start_date ?? 0).getTime(),
    );
  } catch {
    return [];
  }
}

export async function getUserFeedback(
  userId: string,
): Promise<Feedback[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("attendee_id", userId);
    if (error) throw error;
    return (data ?? []) as Feedback[];
  } catch {
    return [];
  }
}

export async function getProfileById(
  userId: string,
): Promise<Profile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return (data as Profile) ?? null;
  } catch {
    return null;
  }
}

export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Profile[];
  } catch {
    return [];
  }
}

export interface ResidenceStat {
  residence: string;
  count: number;
}

// Members per Wits residence (profiles that selected a university residence),
// most members first. Paginated past PostgREST's 1000-row cap.
export async function getResidenceStats(): Promise<ResidenceStat[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const counts: Record<string, number> = {};
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("profiles")
      .select("university_res")
      .range(from, from + pageSize - 1);
    if (error) break;
    for (const row of (data ?? []) as Array<{
      university_res: string | null;
    }>) {
      const value = (row.university_res ?? "").trim();
      if (value) counts[value] = (counts[value] ?? 0) + 1;
    }
    if (!data || data.length < pageSize) break;
  }
  return Object.entries(counts)
    .map(([residence, count]) => ({ residence, count }))
    .sort((a, b) => b.count - a.count || a.residence.localeCompare(b.residence));
}

export async function getSpeakers(): Promise<Speaker[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("speakers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Speaker[];
  } catch {
    return [];
  }
}

export async function getSpeakersByEvent(
  eventId: string,
): Promise<Speaker[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("speakers")
      .select("*")
      .eq("event_id", eventId)
      .order("speaker_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Speaker[];
  } catch {
    return [];
  }
}

export async function getEventGallery(
  eventId: string,
): Promise<EventGalleryImage[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("event_gallery_images")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as EventGalleryImage[];
  } catch {
    return [];
  }
}

export async function getEventAnnouncements(
  eventId: string,
): Promise<Announcement[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Announcement[];
  } catch {
    return [];
  }
}

export async function getEventFeatured(
  eventId: string,
): Promise<EventFeatured[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("event_featured")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as EventFeatured[];
  } catch {
    return [];
  }
}

export async function getRecentAnnouncements(
  limit = 5,
): Promise<AnnouncementWithEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, event_id, text, created_at, event:events(id, title)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as AnnouncementWithEvent[];
  } catch {
    return [];
  }
}

export async function getReflections(
  eventId?: string,
  limit = 300,
): Promise<ReflectionWithUser[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    let query = supabase
      .from("reflections")
      .select("*, user:profiles!user_id(first_name,last_name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (eventId) query = query.eq("event_id", eventId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as ReflectionWithUser[];
  } catch {
    return [];
  }
}

export async function getPledgesForEvent(
  eventId: string,
): Promise<PledgeWithUser[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("pledges")
      .select("*, user:profiles!user_id(first_name,last_name,email)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as PledgeWithUser[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Cacheable public reads
//
// These use a cookie-less client so they can be cached and shared across
// visitors. The event detail page intentionally does NOT use these — it stays
// dynamic. Invalidate with `revalidateTag("events")` after admin mutations.
// ---------------------------------------------------------------------------

export const getCachedEvents = unstable_cache(
  async (): Promise<EventRecord[]> => {
    const supabase = createAnonClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventRecord[];
    } catch {
      return [];
    }
  },
  ["public-events"],
  { revalidate: 60, tags: ["events"] },
);

export const getCachedFeaturedEvent = unstable_cache(
  async (): Promise<EventRecord | null> => {
    const supabase = createAnonClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EventRecord) ?? null;
    } catch {
      return null;
    }
  },
  ["public-featured-event"],
  { revalidate: 60, tags: ["events"] },
);

export const getCachedLatestEvent = unstable_cache(
  async (): Promise<EventRecord | null> => {
    const supabase = createAnonClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .neq("status", "ENDED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EventRecord) ?? null;
    } catch {
      return null;
    }
  },
  ["public-latest-event"],
  { revalidate: 60, tags: ["events"] },
);

// ---------------------------------------------------------------------------
// Cacheable per-event reads (public event detail page)
//
// The page itself stays dynamic so the registration/action block reflects the
// signed-in visitor, but the heavy content below is cached and shared across
// visitors. Invalidate with revalidateTag("events") after admin edits.
// ---------------------------------------------------------------------------

export const getCachedEventProgram = unstable_cache(
  async (eventId: string): Promise<ProgramBlockWithSpeakers[]> => {
    const supabase = createAnonClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("event_program_blocks")
        .select("*, event_program_block_speakers(speaker:speakers(*))")
        .eq("event_id", eventId)
        .order("day_number", { ascending: true })
        .order("display_order", { ascending: true });
      if (error) throw error;
      const blocks = (data ?? []) as unknown as Array<
        ProgramBlock & {
          event_program_block_speakers?: Array<{ speaker: Speaker }>;
        }
      >;
      return blocks.map(({ event_program_block_speakers, ...block }) => ({
        ...block,
        speakers: (event_program_block_speakers ?? [])
          .map((entry) => entry.speaker)
          .filter(Boolean),
      })) as ProgramBlockWithSpeakers[];
    } catch {
      return [];
    }
  },
  ["public-event-program"],
  { revalidate: 60, tags: ["events"] },
);

export const getCachedSpeakersByEvent = unstable_cache(
  async (eventId: string): Promise<Speaker[]> => {
    const supabase = createAnonClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .eq("event_id", eventId)
        .order("speaker_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Speaker[];
    } catch {
      return [];
    }
  },
  ["public-event-speakers"],
  { revalidate: 60, tags: ["events"] },
);

export const getCachedEventAnnouncements = unstable_cache(
  async (eventId: string): Promise<Announcement[]> => {
    const supabase = createAnonClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Announcement[];
    } catch {
      return [];
    }
  },
  ["public-event-announcements"],
  { revalidate: 30, tags: ["events"] },
);

export const getCachedEventFeatured = unstable_cache(
  async (eventId: string): Promise<EventFeatured[]> => {
    const supabase = createAnonClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("event_featured")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventFeatured[];
    } catch {
      return [];
    }
  },
  ["public-event-featured"],
  { revalidate: 60, tags: ["events"] },
);

export const getCachedRecentAnnouncements = unstable_cache(
  async (limit = 5): Promise<AnnouncementWithEvent[]> => {
    const supabase = createAnonClient();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, event_id, text, created_at, event:events(id, title)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as AnnouncementWithEvent[];
    } catch {
      return [];
    }
  },
  ["public-recent-announcements"],
  { revalidate: 30, tags: ["events"] },
);
