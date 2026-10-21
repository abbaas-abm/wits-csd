import { Suspense } from "react";
import type { Metadata } from "next";
import { EventsExplorer } from "@/components/events/EventsExplorer";
import { getCachedEvents } from "@/lib/data";
import type { EventRecord } from "@/lib/types";

export const metadata: Metadata = { title: "Events & Registration" };
export const revalidate = 60;

/**
 * Upcoming events first (soonest at the top), then events that have ended
 * (marked ENDED, or past their end date), most recent first.
 */
function upcomingFirst(events: EventRecord[]): EventRecord[] {
  const now = Date.now();
  const ended = (event: EventRecord) =>
    event.status === "ENDED" || new Date(event.end_date).getTime() <= now;
  const start = (event: EventRecord) => new Date(event.start_date).getTime();

  return [...events].sort((a, b) => {
    const aEnded = ended(a);
    const bEnded = ended(b);
    if (aEnded !== bEnded) return aEnded ? 1 : -1;
    return aEnded ? start(b) - start(a) : start(a) - start(b);
  });
}

export default async function EventsPage() {
  const events = upcomingFirst(await getCachedEvents());

  return (
    <Suspense fallback={null}>
      <EventsExplorer events={events} />
    </Suspense>
  );
}
