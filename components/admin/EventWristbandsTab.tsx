"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Search, Users, Watch, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  WRISTBAND_COLORS,
  normalizeWristband,
  wristbandSwatch,
} from "@/lib/wristbands";

interface Registrant {
  id: string; // registration id
  name: string;
  email: string;
  personNumber: string | null;
  color: string | null;
}

interface Unmatched {
  line: string;
  reason: string;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const PAGE = 1000;
// Keeps the ?id=in.(...) filter well under URL length limits.
const UPDATE_CHUNK = 100;

function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-full border border-gray-300 bg-gray-200",
        className,
      )}
      style={{ backgroundColor: wristbandSwatch(color) }}
    />
  );
}

/**
 * Match pasted rows against people registered for the event. One person per
 * line: email, student/staff number or full name, optionally followed by a
 * colour (commas, semicolons or tabs, so Excel columns paste straight in).
 * Lines without a colour get the default colour.
 */
function parseList(
  text: string,
  registrants: Registrant[],
  defaultColor: string,
): { assignments: Map<string, string>; unmatched: Unmatched[] } {
  const byEmail = new Map<string, Registrant>();
  const byNumber = new Map<string, Registrant>();
  const byName = new Map<string, Registrant[]>();
  for (const r of registrants) {
    byEmail.set(r.email, r);
    if (r.personNumber) byNumber.set(r.personNumber, r);
    const key = r.name.toLowerCase().replace(/\s+/g, " ");
    if (key) byName.set(key, [...(byName.get(key) ?? []), r]);
  }
  const knownColors = new Set([
    ...Object.keys(WRISTBAND_COLORS),
    ...registrants.flatMap((r) => (r.color ? [r.color] : [])),
  ]);

  const assignments = new Map<string, string>();
  const unmatched: Unmatched[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line
      .split(/[\t,;]/)
      .map((cell) => cell.trim())
      .filter(Boolean);

    let person: Registrant | undefined;
    let ambiguous = false;
    let personCell = -1;
    cells.forEach((cell, i) => {
      if (person) return;
      const value = cell.toLowerCase();
      const found = EMAIL.test(value)
        ? (byEmail.get(value) ?? byNumber.get(value.split("@")[0]))
        : byNumber.get(value);
      const named = byName.get(value.replace(/\s+/g, " ")) ?? [];
      if (found) person = found;
      else if (named.length === 1) person = named[0];
      else if (named.length > 1) ambiguous = true;
      if (person) personCell = i;
    });
    // "First, Last" in two columns.
    if (!person && cells.length >= 2) {
      const named =
        byName.get(`${cells[0]} ${cells[1]}`.toLowerCase().replace(/\s+/g, " ")) ??
        [];
      if (named.length === 1) {
        person = named[0];
        personCell = 1;
      } else if (named.length > 1) ambiguous = true;
    }

    if (!person) {
      unmatched.push({
        line,
        reason: ambiguous
          ? "More than one registered person has this name. Use their email or student number."
          : "Not registered for this event.",
      });
      continue;
    }

    const colorCell = cells.find(
      (cell, i) => i !== personCell && knownColors.has(normalizeWristband(cell)),
    );
    const color = colorCell ? normalizeWristband(colorCell) : defaultColor;
    if (!color) {
      unmatched.push({ line, reason: "No colour on this line or selected above." });
      continue;
    }
    assignments.set(person.id, color);
  }

  return { assignments, unmatched };
}

export function EventWristbandsTab({ event }: { event: { id: string } }) {
  const [registrants, setRegistrants] = React.useState<Registrant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [setupMissing, setSetupMissing] = React.useState(false);
  const [colorInput, setColorInput] = React.useState("");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [unmatched, setUnmatched] = React.useState<Unmatched[]>([]);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<string | null>(null);

  const color = normalizeWristband(colorInput);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const all: Registrant[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("registrations")
          .select(
            "id, wristband_color, attendee:profiles!attendee_id!inner(email, first_name, last_name, person_number)",
          )
          .eq("event_id", event.id)
          .eq("status", "CONFIRMED")
          .order("id")
          .range(from, from + PAGE - 1);
        if (!active) return;
        if (error) {
          // The SQL script (supabase/fixes/wristbands.sql) hasn't been run.
          setSetupMissing(true);
          setLoading(false);
          return;
        }
        for (const row of data ?? []) {
          const { id, wristband_color, attendee } = row as unknown as {
            id: string;
            wristband_color: string | null;
            attendee: {
              email: string | null;
              first_name: string | null;
              last_name: string | null;
              person_number: string | null;
            } | null;
          };
          all.push({
            id,
            name: [attendee?.first_name, attendee?.last_name]
              .filter(Boolean)
              .join(" "),
            email: attendee?.email?.toLowerCase() ?? "",
            personNumber: attendee?.person_number?.trim().toLowerCase() || null,
            color: wristband_color,
          });
        }
        if ((data ?? []).length < PAGE) break;
      }
      all.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
      setRegistrants(all);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [event.id]);

  const groups = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of registrants) {
      if (r.color) counts.set(r.color, (counts.get(r.color) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [registrants]);
  const unassigned = registrants.filter((r) => !r.color);

  const term = query.trim().toLowerCase();
  const shown = registrants.filter(
    (r) =>
      (filter === null ||
        (filter === "" ? !r.color : r.color === filter)) &&
      (!term ||
        r.name.toLowerCase().includes(term) ||
        r.email.includes(term) ||
        (r.personNumber ?? "").includes(term)),
  );

  /** Save colours (null clears) and mirror them locally. */
  async function save(changes: Map<string, string | null>, label: string) {
    if (changes.size === 0) return false;
    const byColor = new Map<string | null, string[]>();
    for (const [id, value] of changes) {
      byColor.set(value, [...(byColor.get(value) ?? []), id]);
    }
    setBusy(label);
    try {
      const supabase = createClient();
      for (const [value, ids] of byColor) {
        for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
          const { error } = await supabase
            .from("registrations")
            .update({ wristband_color: value })
            .eq("event_id", event.id)
            .in("id", ids.slice(i, i + UPDATE_CHUNK));
          if (error) throw error;
        }
      }
      setRegistrants((prev) =>
        prev.map((r) =>
          changes.has(r.id) ? { ...r, color: changes.get(r.id) ?? null } : r,
        ),
      );
      return true;
    } catch (error) {
      toast.error(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Could not save wristband colours.",
      );
      return false;
    } finally {
      setBusy(null);
    }
  }

  const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

  async function assignList() {
    const { assignments, unmatched: missed } = parseList(
      text,
      registrants,
      color,
    );
    setUnmatched(missed);
    if (assignments.size === 0) {
      toast.error(
        missed.length
          ? "No one on the list matched a registered person."
          : "Paste one person per line.",
      );
      return;
    }
    if (await save(assignments, "list")) {
      setText("");
      toast.success(
        `Wristband colour set for ${people(assignments.size)}.` +
          (missed.length ? ` ${missed.length} line(s) not matched.` : ""),
      );
    }
  }

  async function assignEveryone(onlyUnassigned: boolean) {
    if (!color) {
      toast.error("Choose a colour first.");
      return;
    }
    const targets = onlyUnassigned ? unassigned : registrants;
    if (
      !onlyUnassigned &&
      registrants.some((r) => r.color && r.color !== color) &&
      !window.confirm(
        `Give all ${registrants.length} registered people a ${color} wristband? This replaces colours already assigned.`,
      )
    ) {
      return;
    }
    const changes = new Map(targets.map((r) => [r.id, color] as const));
    if (await save(changes, onlyUnassigned ? "unassigned" : "everyone")) {
      toast.success(`${color} wristband set for ${people(changes.size)}.`);
    }
  }

  async function recolorGroup(from: string, to: string | null) {
    const members = registrants.filter((r) => r.color === from);
    if (
      !window.confirm(
        to
          ? `Change all ${members.length} ${from} wristbands to ${to}?`
          : `Remove the ${from} wristband from ${people(members.length)}?`,
      )
    ) {
      return;
    }
    const changes = new Map(members.map((r) => [r.id, to] as const));
    if (await save(changes, `group:${from}`)) {
      if (filter === from) setFilter(to);
      toast.success(
        to ? `${from} wristbands changed to ${to}.` : `${from} wristbands removed.`,
      );
    }
  }

  async function setOne(r: Registrant, value: string | null) {
    await save(new Map([[r.id, value]]), `one:${r.id}`);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (setupMissing) {
    return (
      <Card className="mx-auto max-w-3xl border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">Wristbands need setup</h2>
        <p className="mt-2 text-sm text-amber-800">
          Run <code>supabase/fixes/wristbands.sql</code> in the Supabase SQL
          editor, then reload this page.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Wristbands</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign a wristband colour to people registered for this event.
          Volunteers see the colour when they check someone in.
        </p>
      </div>

      <Card className="space-y-3 border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-900">Colour</p>
        <div className="flex items-center gap-3">
          {color && <Swatch color={color} className="size-6" />}
          <Input
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            list="wristband-colours"
            placeholder="Type or pick a colour, e.g. Blue"
            className="max-w-xs"
          />
          <datalist id="wristband-colours">
            {[
              ...new Set([
                ...groups.map(([name]) => name),
                ...Object.keys(WRISTBAND_COLORS),
              ]),
            ].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(WRISTBAND_COLORS).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setColorInput(name)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                color === name
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50",
              )}
            >
              <Swatch color={name} />
              {name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 border-gray-200 p-5">
        <div>
          <p className="text-sm font-medium text-gray-900">Assign by list</p>
          <p className="text-xs text-muted-foreground">
            One person per line: email, student/staff number or full name. Add a
            colour after it (e.g. <code>1234567, Gold</code>) to override the
            colour above. Only people already registered for this event are
            matched.
          </p>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={
            "1234567@students.wits.ac.za\n2345678, Gold\nThabo Nkosi, Blue\n(you can paste columns straight from Excel)"
          }
        />
        <Button onClick={assignList} disabled={busy !== null || !text.trim()}>
          {busy === "list" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Watch className="size-4" />
          )}
          Assign to listed people
        </Button>

        {unmatched.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="size-4" />
                {unmatched.length} line(s) not assigned
              </p>
              <button
                type="button"
                onClick={() => setUnmatched([])}
                aria-label="Dismiss"
                className="text-amber-700 hover:text-amber-900"
              >
                <X className="size-4" />
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {unmatched.map((item, i) => (
                <li key={i}>
                  <span className="font-medium">{item.line}</span>
                  <span className="text-amber-800"> · {item.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="space-y-3 border-gray-200 p-5">
        <div>
          <p className="text-sm font-medium text-gray-900">Assign to everyone</p>
          <p className="text-xs text-muted-foreground">
            Uses the colour selected above.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => assignEveryone(false)}
            disabled={busy !== null || !color || registrants.length === 0}
          >
            {busy === "everyone" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Users className="size-4" />
            )}
            All registered ({registrants.length})
          </Button>
          <Button
            variant="outline"
            onClick={() => assignEveryone(true)}
            disabled={busy !== null || !color || unassigned.length === 0}
          >
            {busy === "unassigned" && <Loader2 className="size-4 animate-spin" />}
            Only those without a wristband ({unassigned.length})
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-gray-200 p-0">
        <div className="border-b border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-900">Summary</p>
          <p className="text-xs text-muted-foreground">
            Click a colour to filter the list below.
          </p>
        </div>
        <ul className="divide-y divide-gray-100">
          {groups.map(([name, count]) => (
            <li
              key={name}
              className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <button
                type="button"
                onClick={() => setFilter(filter === name ? null : name)}
                className={cn(
                  "flex items-center gap-2 text-left",
                  filter === name && "font-semibold text-primary",
                )}
              >
                <Swatch color={name} className="size-4" />
                {name}
                <span className="text-muted-foreground">· {people(count)}</span>
              </button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null || !color || color === name}
                  onClick={() => recolorGroup(name, color)}
                >
                  {busy === `group:${name}` && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {color && color !== name
                    ? `Change all to ${color}`
                    : "Change all to…"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => recolorGroup(name, null)}
                >
                  Clear
                </Button>
              </div>
            </li>
          ))}
          <li className="px-4 py-3 text-sm">
            <button
              type="button"
              onClick={() => setFilter(filter === "" ? null : "")}
              className={cn(
                "flex items-center gap-2 text-left",
                filter === "" && "font-semibold text-primary",
              )}
            >
              <span className="inline-block size-4 rounded-full border border-dashed border-gray-400" />
              No wristband
              <span className="text-muted-foreground">
                · {people(unassigned.length)}
              </span>
            </button>
          </li>
        </ul>
      </Card>

      <Card className="overflow-hidden border-gray-200 p-0">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-900">
            {filter === null
              ? `${registrants.length} registered`
              : `${shown.length} ${filter === "" ? "without a wristband" : `with ${filter}`}`}
            {filter !== null && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="ml-2 text-xs font-normal text-primary hover:underline"
              >
                Show all
              </button>
            )}
          </p>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people..."
              className="pl-9"
            />
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {registrants.length === 0
              ? "No one is registered for this event yet."
              : "No matches."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {r.name || r.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[r.email, r.personNumber].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.color ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-800">
                      <Swatch color={r.color} />
                      {r.color}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No wristband
                    </span>
                  )}
                  {color && color !== r.color && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setOne(r, color)}
                    >
                      {busy === `one:${r.id}` && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Set {color}
                    </Button>
                  )}
                  {r.color && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setOne(r, null)}
                      aria-label={`Remove wristband from ${r.name || r.email}`}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
