"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarX2, Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventCard } from "@/components/events/EventCard";
import type { EventRecord, EventMode } from "@/lib/types";

type ModeFilter = "ALL" | EventMode;

const MODE_LABELS: Record<ModeFilter, string> = {
  ALL: "All modes",
  IN_PERSON: "In Person",
  ONLINE: "Online",
};

export function EventsExplorer({ events }: { events: EventRecord[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState(() => searchParams.get("q") ?? "");
  const [mode, setMode] = React.useState<ModeFilter>(() => {
    const value = searchParams.get("mode");
    return value === "IN_PERSON" || value === "ONLINE" ? value : "ALL";
  });

  function syncUrl(nextQuery: string, nextMode: ModeFilter) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextMode !== "ALL") params.set("mode", nextMode);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    syncUrl(value, mode);
  }

  function handleModeChange(value: ModeFilter) {
    setMode(value);
    syncUrl(query, value);
  }

  function reset() {
    setQuery("");
    setMode("ALL");
    syncUrl("", "ALL");
  }

  const filtered = events.filter((event) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      event.title.toLowerCase().includes(q) ||
      (event.description ?? "").toLowerCase().includes(q) ||
      (event.theme ?? "").toLowerCase().includes(q);
    const matchesMode = mode === "ALL" || event.mode === mode;
    return matchesQuery && matchesMode;
  });

  const hasFilters = query.trim() !== "" || mode !== "ALL";

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate overflow-hidden bg-primary py-16 sm:py-20">
        <Image
          src="/stage-speaker.JPG"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-primary/85" />

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#d9b45b]">
            Events &amp; Registration Portal
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-balance text-white sm:text-4xl">
            Central Events &amp; Engagement Hub
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/85">
            Access university-wide leadership conferences, volunteer drives,
            governance workshops and transition summits. Reserve your spot and
            manage your engagement portfolio.
          </p>

          <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search events..."
                aria-label="Search events"
                className="h-12 border-transparent bg-white pl-11 text-gray-900 placeholder:text-gray-400 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-white/70"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => handleQueryChange("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="sm:w-48">
              <Select
                value={mode}
                onValueChange={(value) => handleModeChange(value as ModeFilter)}
              >
                <SelectTrigger
                  aria-label="Filter by mode"
                  className="h-12 border-transparent bg-white text-gray-900 focus:ring-2 focus:ring-white/70"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABELS) as ModeFilter[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {MODE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {filtered.length} {filtered.length === 1 ? "event" : "events"}{" "}
              found
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={reset}
                className="text-sm font-medium text-primary hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
              <CalendarX2 className="size-6 text-gray-400" />
              <h3 className="mt-3 text-base font-semibold text-gray-900">
                No events found matching your criteria
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-600">
                Try adjusting your search or clearing the active filters.
              </p>
              <Button variant="outline" className="mt-5" onClick={reset}>
                Reset filters
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
