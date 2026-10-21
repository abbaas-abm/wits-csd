"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { AWARDS } from "@/lib/awards";
import { splitDuration } from "@/lib/utils";

/**
 * Site-wide top bar for the 2026 Student Leadership Awards. Invite-only, so it
 * links to the About page rather than to registration.
 */
export function AwardsTopBar() {
  const [seconds, setSeconds] = React.useState<number | null>(null);

  React.useEffect(() => {
    const target = new Date(AWARDS.date).getTime();
    const tick = () =>
      setSeconds(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const duration = seconds === null ? null : splitDuration(seconds);
  const countdown =
    duration === null
      ? null
      : duration.days > 0
        ? `${duration.days}d ${duration.hours}h ${duration.minutes}m`
        : duration.hours > 0
          ? `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`
          : `${duration.minutes}m ${duration.seconds}s`;

  const title = `${AWARDS.year} ${AWARDS.title}`;

  return (
    <Link
      href="/about#awards"
      aria-label={`${title} — ${AWARDS.dateShort}, by invitation only`}
      className="group block bg-primary text-white pwa:hidden"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-white/70 sm:inline-flex">
            <CalendarDays className="size-3.5" />
            Up next
          </span>
          <span className="truncate text-sm font-semibold">{title}</span>
          {seconds === null ? (
            <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white/80">
              {AWARDS.dateShort}
            </span>
          ) : seconds > 0 ? (
            <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white">
              {countdown}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-[#d9b45b] px-2.5 py-0.5 text-xs font-semibold text-primary">
              Happening now
            </span>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#d9b45b] px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors group-hover:bg-[#e6c677]">
          <span className="hidden sm:inline">By invitation only</span>
          <span className="sm:hidden">Invite only</span>
          <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
