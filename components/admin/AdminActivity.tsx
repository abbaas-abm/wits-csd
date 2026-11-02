"use client";

import * as React from "react";
import {
  Activity,
  CalendarCheck,
  ChevronDown,
  KeyRound,
  Loader2,
  LogIn,
  Megaphone,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ActivityRow {
  id: number;
  created_at: string;
  category: string;
  action: string;
  actor_id: string | null;
  subject_id: string | null;
  event_id: string | null;
  record_id: string | null;
  email: string | null;
  ip: string | null;
  user_agent: string | null;
  details: {
    error?: string;
    backfilled?: boolean;
    count?: number;
    photos?: number;
    videos?: number;
    record?: Record<string, unknown>;
    changes?: Record<string, { from?: unknown; to?: unknown; changed?: boolean }>;
  };
}

interface Person {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const PAGE_SIZE = 50;
const POLL_MS = 10_000;

const CATEGORIES: { value: string; label: string; icon: LucideIcon; tone: string }[] = [
  { value: "sign-in", label: "Sign-in", icon: KeyRound, tone: "bg-violet-50 text-violet-700" },
  { value: "accounts", label: "Accounts", icon: UserRound, tone: "bg-sky-50 text-sky-700" },
  { value: "registrations", label: "Registrations", icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-700" },
  { value: "check-ins", label: "Check-ins", icon: QrCode, tone: "bg-amber-50 text-amber-700" },
  { value: "engagement", label: "Engagement", icon: Sparkles, tone: "bg-pink-50 text-pink-700" },
  { value: "content", label: "Content & admin", icon: Megaphone, tone: "bg-slate-100 text-slate-700" },
];

const STATS: { label: string; actions: string[]; icon: LucideIcon; alert?: boolean }[] = [
  { label: "Sign-ins", actions: ["auth.otp_verified"], icon: LogIn },
  { label: "Codes requested", actions: ["auth.otp_requested", "auth.otp_resent"], icon: KeyRound },
  { label: "Failed codes", actions: ["auth.otp_failed", "auth.otp_request_failed"], icon: ShieldAlert, alert: true },
  { label: "Registrations", actions: ["registrations.insert"], icon: CalendarCheck },
  { label: "Check-ins", actions: ["attendance.insert"], icon: QrCode },
];

const n = (value: number) => value.toLocaleString("en-ZA");

function personName(person: Person | undefined) {
  if (!person) return null;
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ");
  return name || person.email || null;
}

function device(ua: string | null) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (!browser && !os) return "Server";
  return [browser, os].filter(Boolean).join(" on ");
}

function fieldLabel(key: string) {
  return key.replace(/^has_/, "").replace(/_id$/, "").replace(/_/g, " ");
}

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-gray-900">{children}</span>;
}

/** One readable sentence for a log row. */
function describe(
  row: ActivityRow,
  people: Map<string, Person>,
  eventTitles: Map<string, string>,
): React.ReactNode {
  const actor = row.actor_id ? personName(people.get(row.actor_id)) : null;
  const subject = row.subject_id ? personName(people.get(row.subject_id)) : null;
  const record = row.details.record ?? {};
  const changes = row.details.changes ?? {};
  const event = row.event_id ? (eventTitles.get(row.event_id) ?? "an event") : "an event";
  const [table, op] = row.action.split(".");

  const who = (name: string | null, fallback: string) => <B>{name ?? fallback}</B>;
  const by = actor && actor !== subject ? <> by {who(actor, "")}</> : null;
  const ev = <B>{event}</B>;
  const verb = op === "insert" ? "added" : op === "update" ? "updated" : "removed";
  const changedList = Object.keys(changes).map(fieldLabel).join(", ");

  switch (row.action) {
    case "auth.otp_requested":
      return <>{who(row.email, "Someone")} requested a sign-in code</>;
    case "auth.otp_resent":
      return <>{who(row.email, "Someone")} asked for a new sign-in code</>;
    case "auth.otp_request_failed":
      return <>A sign-in code could not be sent to {who(row.email, "an unknown email")}</>;
    case "auth.otp_verified":
      return <>{who(subject ?? row.email, "Someone")} signed in</>;
    case "auth.otp_failed":
      return <>{who(row.email, "Someone")} entered a wrong or expired code</>;
    case "auth.signed_out":
      return <>{who(subject ?? actor, "Someone")} signed out</>;
  }

  switch (table) {
    case "profiles":
      if (op === "insert") return <>{who(subject ?? row.email, "Someone")} created an account</>;
      if (op === "delete") return <>The account of {who(String(record.email ?? "someone"), "")} was deleted{by}</>;
      if (changes.role)
        return <>{who(subject, "Someone")}&apos;s role changed from {show(changes.role.from)} to <B>{show(changes.role.to)}</B>{by}</>;
      if (changes.onboarding?.to === "DONE") return <>{who(subject, "Someone")} finished setting up their profile</>;
      return <>{who(subject, "Someone")}&apos;s profile was updated ({changedList}){by}</>;
    case "push_subscriptions":
      return op === "insert"
        ? <>{who(subject, "A visitor")} turned on notifications</>
        : op === "delete"
          ? <>A notification subscription{subject ? <> for {who(subject, "")}</> : null} was removed</>
          : <>{who(subject, "A visitor")}&apos;s notification settings changed</>;
    case "registrations":
      if (op === "insert") return <>{who(subject, "Someone")} registered for {ev}{by}</>;
      if (op === "delete") return <>{who(subject, "Someone")}&apos;s registration for {ev} was removed{by}</>;
      if (changes.status) return <>{who(subject, "Someone")}&apos;s registration for {ev} changed to <B>{show(changes.status.to)}</B>{by}</>;
      if (changes.wristband_color)
        return <>{who(subject, "Someone")} was given a <B>{show(changes.wristband_color.to)}</B> wristband for {ev}{by}</>;
      return <>{who(subject, "Someone")}&apos;s registration for {ev} was updated ({changedList}){by}</>;
    case "event_invites":
      return <>{who(actor, "An admin")} {op === "delete" ? "removed the invite for" : "invited"} <B>{String(record.email ?? row.email ?? "someone")}</B> {op === "delete" ? "from" : "to"} {ev}</>;
    case "event_wristbands":
      return <>{who(actor, "An admin")} {verb} a wristband entry for <B>{String(record.name ?? record.identifier ?? "someone")}</B> at {ev}</>;
    case "attendance":
      return op === "delete"
        ? <>{who(subject, "Someone")}&apos;s check-in at {ev} was removed{by}</>
        : <>{who(subject, "Someone")} checked in at {ev}{actor && actor !== subject ? <> (scanned by {who(actor, "")})</> : null}</>;
    case "pledges":
      return <>{who(subject, "Someone")} {op === "insert" ? "made a pledge for" : `${verb} a pledge for`} {ev}</>;
    case "reflections":
      return op === "insert"
        ? <>{who(subject, "Someone")} shared a reflection at {ev}</>
        : <>A reflection at {ev} was {verb}{by}</>;
    case "feedback":
      return <>{who(subject, "Someone")} rated {ev} <B>{show(record.rating)}/5</B></>;
    case "qna":
      if (op === "insert") return <>{who(subject, "Someone")} asked a question at {ev}</>;
      if (changes.answered) return <>A question at {ev} was marked {changes.answered.to ? "answered" : "unanswered"}{by}</>;
      return <>A question at {ev} was {verb}{by}</>;
    case "events": {
      const title = <B>{String(record.title ?? event)}</B>;
      if (op !== "update") return <>{who(actor, "An admin")} {op === "insert" ? "created" : "deleted"} the event {title}</>;
      const toggles = Object.entries(changes)
        .filter(([key, c]) => key.startsWith("has_") || key === "invite_only" || typeof c.to === "boolean")
        .map(([key, c]) => `${fieldLabel(key)} ${show(c.to)}`);
      const other = Object.keys(changes)
        .filter((key) => !(key.startsWith("has_") || key === "invite_only" || typeof changes[key].to === "boolean"))
        .map((key) => (key === "status" ? `status → ${show(changes[key].to)}` : fieldLabel(key)));
      return <>{who(actor, "An admin")} updated {title}: {[...toggles, ...other].join(", ")}</>;
    }
    case "announcements":
      return op === "insert"
        ? <>{who(actor, "An admin")} posted an announcement on {ev}: <span className="text-gray-500">“{String(record.text ?? "")}”</span></>
        : <>{who(actor, "An admin")} {verb} an announcement on {ev}</>;
    case "speakers":
      return <>{who(actor, "An admin")} {verb} the speaker <B>{[record.title, record.first_name, record.last_name].filter(Boolean).join(" ") || "a speaker"}</B>{row.event_id ? <> for {ev}</> : null}</>;
    case "event_program_blocks":
      return <>{who(actor, "An admin")} {verb} the programme item <B>{String(record.title ?? "")}</B> for {ev}</>;
    case "event_featured":
      return <>{who(actor, "An admin")} {verb} the featured item <B>{String(record.title ?? "")}</B> on {ev}</>;
    case "event_gallery_images": {
      const parts = [
        row.details.photos ? `${n(row.details.photos)} photo${row.details.photos === 1 ? "" : "s"}` : null,
        row.details.videos ? `${n(row.details.videos)} video${row.details.videos === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      const what = parts.join(" and ") || `${n(row.details.count ?? 0)} items`;
      if (op === "insert") return <>{who(actor, "An admin")} added <B>{what}</B> to the {ev} gallery</>;
      if (op === "delete") return <>{who(actor, "An admin")} removed <B>{what}</B> from the {ev} gallery</>;
      return <>{who(actor, "An admin")} rearranged or renamed <B>{n(row.details.count ?? 0)}</B> gallery items for {ev}</>;
    }
  }
  return <>{who(actor, "The system")} {verb} a {fieldLabel(table)} record</>;
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AdminActivity({
  events,
}: {
  events: { id: string; title: string }[];
}) {
  const eventTitles = React.useMemo(
    () => new Map(events.map((e) => [e.id, e.title])),
    [events],
  );
  const [rows, setRows] = React.useState<ActivityRow[]>([]);
  const [people, setPeople] = React.useState<Map<string, Person>>(new Map());
  const [stats, setStats] = React.useState<number[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [missingTable, setMissingTable] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  const [category, setCategory] = React.useState<string>("all");
  const [eventId, setEventId] = React.useState<string>("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [live, setLive] = React.useState(true);

  const peopleRef = React.useRef(people);
  React.useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadPeople = React.useCallback(async (list: ActivityRow[]) => {
    const ids = [
      ...new Set(
        list.flatMap((r) => [r.actor_id, r.subject_id]).filter((id): id is string => Boolean(id)),
      ),
    ].filter((id) => !peopleRef.current.has(id));
    if (ids.length === 0) return;
    const supabase = createClient();
    const found: Person[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ids.slice(i, i + 100));
      found.push(...((data ?? []) as Person[]));
    }
    setPeople((prev) => {
      const next = new Map(prev);
      for (const person of found) next.set(person.id, person);
      return next;
    });
  }, []);

  /**
   * Base query with the current filters applied. Wrapped in an object: a
   * query builder is awaitable, so returning it bare from an async function
   * would run it.
   */
  const buildQuery = React.useCallback(async () => {
    const supabase = createClient();
    let query = supabase.from("activity_log").select("*");
    if (category !== "all") query = query.eq("category", category);
    if (eventId !== "all") query = query.eq("event_id", eventId);
    if (search) {
      const q = search.replace(/[,()*%]/g, " ").trim();
      const { data: matches } = await supabase
        .from("profiles")
        .select("id")
        .or(`email.ilike.*${q}*,first_name.ilike.*${q}*,last_name.ilike.*${q}*`)
        .limit(100);
      const ids = (matches ?? []).map((m) => m.id as string);
      const clauses = [`email.ilike.*${q}*`, `ip.eq.${q}`];
      if (ids.length) {
        clauses.push(`actor_id.in.(${ids.join(",")})`, `subject_id.in.(${ids.join(",")})`);
      }
      query = query.or(clauses.join(","));
    }
    return { query };
  }, [category, eventId, search]);

  const loadStats = React.useCallback(async () => {
    const supabase = createClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const results = await Promise.all(
      STATS.map((stat) =>
        supabase
          .from("activity_log")
          .select("id", { count: "exact", head: true })
          .in("action", stat.actions)
          .gte("created_at", since),
      ),
    );
    setStats(results.map((r) => r.count ?? 0));
  }, []);

  // First page whenever the filters change.
  React.useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });
    (async () => {
      const { query } = await buildQuery();
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (!active) return;
      if (error) {
        setMissingTable(/activity_log|schema cache|does not exist/i.test(error.message));
        setRows([]);
        setLoading(false);
        return;
      }
      const list = (data ?? []) as ActivityRow[];
      setRows(list);
      setHasMore(list.length === PAGE_SIZE);
      setLoading(false);
      void loadPeople(list);
      void loadStats();
    })();
    return () => {
      active = false;
    };
  }, [buildQuery, loadPeople, loadStats]);

  // Live: fetch anything newer than the top row.
  React.useEffect(() => {
    if (!live || loading || missingTable) return;
    const timer = setInterval(async () => {
      const newest = rows[0]?.created_at;
      const { query } = await buildQuery();
      const { data } = await (newest ? query.gt("created_at", newest) : query)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      const fresh = (data ?? []) as ActivityRow[];
      if (fresh.length) {
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...fresh.filter((r) => !seen.has(r.id)), ...prev];
        });
        void loadPeople(fresh);
      }
      void loadStats();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [live, loading, missingTable, rows, buildQuery, loadPeople, loadStats]);

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const { query } = await buildQuery();
    const { data } = await query
      .or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    const list = (data ?? []) as ActivityRow[];
    setRows((prev) => [...prev, ...list]);
    setHasMore(list.length === PAGE_SIZE);
    setLoadingMore(false);
    void loadPeople(list);
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (missingTable) {
    return (
      <Card className="mx-auto max-w-2xl border-dashed border-gray-300 p-8 text-center">
        <Activity className="mx-auto size-6 text-gray-400" />
        <h2 className="mt-3 font-semibold text-gray-900">Activity log not set up yet</h2>
        <p className="mt-1 text-sm text-gray-600">
          Run <code>supabase/fixes/activity_log.sql</code> in the Supabase SQL editor, then reload this page.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Activity className="size-6 text-primary" />
            Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything that happens on the platform: sign-ins, registrations,
            check-ins, engagement and admin changes.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-gray-300")} />
          Live
          <Switch checked={live} onCheckedChange={setLive} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map((stat, i) => (
          <Card key={stat.label} className="gap-0 border-gray-200 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <stat.icon className="size-3.5" />
              {stat.label}
            </p>
            <p
              className={cn(
                "mt-1.5 text-2xl font-semibold tabular-nums",
                stat.alert && stats && stats[i] > 0 ? "text-destructive" : "text-gray-900",
              )}
            >
              {stats ? n(stats[i]) : "–"}
            </p>
            <p className="text-[11px] text-muted-foreground">last 24 hours</p>
          </Card>
        ))}
      </div>

      <Card className="gap-4 border-gray-200 p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, email or IP address"
              className="pl-9"
            />
          </div>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-full lg:w-72">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ value: "all", label: "All" }, ...CATEGORIES].map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                category === c.value
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-gray-700 hover:bg-slate-200",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center border-dashed border-gray-300 px-6 py-14 text-center">
          <Activity className="size-6 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">No activity matches these filters.</p>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-gray-200 p-0">
          {rows.map((row, index) => {
            const meta = CATEGORIES.find((c) => c.value === row.category) ?? CATEGORIES[5];
            const day = dayLabel(row.created_at);
            const showDay =
              index === 0 || day !== dayLabel(rows[index - 1].created_at);
            const isOpen = expanded.has(row.id);
            const failed = row.action === "auth.otp_failed" || row.action === "auth.otp_request_failed";
            const deviceName = device(row.user_agent);
            const hasDetails =
              Boolean(row.details.error) ||
              Boolean(row.details.changes) ||
              Boolean(row.details.record && Object.keys(row.details.record).length);
            return (
              <React.Fragment key={row.id}>
                {showDay && (
                  <div className="sticky top-0 z-10 border-b border-gray-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {day}
                  </div>
                )}
                <div className={cn("border-b border-gray-100 px-4 py-3 last:border-b-0", failed && "bg-red-50/40")}>
                  <div className="flex gap-3">
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", failed ? "bg-red-100 text-red-700" : meta.tone)}>
                      {failed ? <ShieldAlert className="size-4" /> : <meta.icon className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-gray-700">
                        {describe(row, people, eventTitles)}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">{timeLabel(row.created_at)}</span>
                        {row.ip && <span>· {row.ip}</span>}
                        {deviceName && <span>· {deviceName}</span>}
                        {row.details.backfilled && <span>· from earlier records</span>}
                        {hasDetails && (
                          <button
                            type="button"
                            onClick={() => toggle(row.id)}
                            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                          >
                            · Details
                            <ChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
                          </button>
                        )}
                      </p>
                      {isOpen && (
                        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-gray-700">
                          {row.details.error && (
                            <p>
                              <span className="font-semibold">Error:</span> {row.details.error}
                            </p>
                          )}
                          {row.details.changes && (
                            <ul className="space-y-0.5">
                              {Object.entries(row.details.changes).map(([key, c]) => (
                                <li key={key}>
                                  <span className="font-semibold">{fieldLabel(key)}:</span>{" "}
                                  {c.changed ? "changed" : <>{show(c.from)} → {show(c.to)}</>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {row.details.record && Object.keys(row.details.record).length > 0 && (
                            <dl className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[max-content_1fr]">
                              {Object.entries(row.details.record).map(([key, value]) => (
                                <React.Fragment key={key}>
                                  <dt className="font-semibold">{fieldLabel(key)}</dt>
                                  <dd className="break-all">{show(value)}</dd>
                                </React.Fragment>
                              ))}
                            </dl>
                          )}
                          {row.user_agent && <p className="break-all text-muted-foreground">{row.user_agent}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </Card>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <Loader2 className="size-4 animate-spin" />}
            Load older activity
          </Button>
        </div>
      )}
    </div>
  );
}
