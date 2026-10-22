"use client";

import * as React from "react";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Search,
  Users,
  Watch,
  X,
} from "lucide-react";
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
  formatWristbands,
  parseWristbands,
  wristbandSwatch,
} from "@/lib/wristbands";

interface Registrant {
  id: string; // registration id
  name: string;
  email: string;
  personNumber: string | null;
  colors: string[];
}

interface Unmatched {
  line: string;
  reason: string;
}

// Replace a person's colours with the selection, or add the selection to them.
type Mode = "replace" | "add";

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const PAGE = 1000;
// Keeps the ?id=in.(...) filter well under URL length limits.
const UPDATE_CHUNK = 100;

const sameColors = (a: string[], b: string[]) =>
  a.length === b.length && a.every((c) => b.includes(c));

function applyMode(current: string[], selected: string[], mode: Mode) {
  return mode === "add" ? [...new Set([...current, ...selected])] : selected;
}

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

function ColorChip({
  color,
  onRemove,
}: {
  color: string;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800">
      <Swatch color={color} />
      {color}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${color}`}
          className="-mr-1 text-gray-400 hover:text-gray-700"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/**
 * Match pasted rows against people registered for the event. One person per
 * line: email, student/staff number or full name, optionally followed by one
 * or more colours (commas, semicolons or tabs, so Excel columns paste straight
 * in). Lines without a colour get the selected colours.
 */
function parseList(
  text: string,
  registrants: Registrant[],
  selected: string[],
): { assignments: Map<string, string[]>; unmatched: Unmatched[] } {
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
    ...selected,
    ...registrants.flatMap((r) => r.colors),
  ]);
  const isColorCell = (cell: string) => {
    const colors = parseWristbands(cell);
    return colors.length > 0 && colors.every((c) => knownColors.has(c));
  };

  const assignments = new Map<string, string[]>();
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

    const lineColors = [
      ...new Set(
        cells
          .filter((cell, i) => i !== personCell && isColorCell(cell))
          .flatMap(parseWristbands),
      ),
    ];
    const colors = lineColors.length ? lineColors : selected;
    if (colors.length === 0) {
      unmatched.push({ line, reason: "No colour on this line or selected above." });
      continue;
    }
    assignments.set(person.id, colors);
  }

  return { assignments, unmatched };
}

export function EventWristbandsTab({ event }: { event: { id: string } }) {
  const [registrants, setRegistrants] = React.useState<Registrant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [setupMissing, setSetupMissing] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [colorInput, setColorInput] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("replace");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [unmatched, setUnmatched] = React.useState<Unmatched[]>([]);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<string | null>(null);

  const selectionLabel = selected.join(" + ");

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
            colors: parseWristbands(wristband_color),
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

  // People with several wristbands count once under each colour.
  const groups = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of registrants) {
      for (const c of r.colors) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [registrants]);
  const unassigned = registrants.filter((r) => r.colors.length === 0);

  const term = query.trim().toLowerCase();
  const shown = registrants.filter(
    (r) =>
      (filter === null ||
        (filter === "" ? r.colors.length === 0 : r.colors.includes(filter))) &&
      (!term ||
        r.name.toLowerCase().includes(term) ||
        r.email.includes(term) ||
        (r.personNumber ?? "").includes(term)),
  );

  function toggleColor(color: string) {
    setSelected((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color],
    );
  }

  function addTypedColors() {
    const typed = parseWristbands(colorInput);
    if (typed.length === 0) return;
    setSelected((prev) => [...new Set([...prev, ...typed])]);
    setColorInput("");
  }

  /** Save each person's full colour list and mirror it locally. */
  async function save(changes: Map<string, string[]>, label: string) {
    const current = new Map(registrants.map((r) => [r.id, r.colors]));
    for (const [id, colors] of changes) {
      if (sameColors(current.get(id) ?? [], colors)) changes.delete(id);
    }
    if (changes.size === 0) {
      toast.info("Nothing to change.");
      return false;
    }
    const byValue = new Map<string | null, string[]>();
    for (const [id, colors] of changes) {
      const value = formatWristbands(colors);
      byValue.set(value, [...(byValue.get(value) ?? []), id]);
    }
    setBusy(label);
    try {
      const supabase = createClient();
      for (const [value, ids] of byValue) {
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
        prev.map((r) => {
          const next = changes.get(r.id);
          return next ? { ...r, colors: next } : r;
        }),
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
      selected,
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
    const byId = new Map(registrants.map((r) => [r.id, r]));
    const changes = new Map(
      [...assignments].map(([id, colors]) => [
        id,
        applyMode(byId.get(id)?.colors ?? [], colors, mode),
      ]),
    );
    const count = changes.size;
    if (await save(changes, "list")) {
      setText("");
      toast.success(
        `Wristbands updated for ${people(count)}.` +
          (missed.length ? ` ${missed.length} line(s) not matched.` : ""),
      );
    }
  }

  async function assignEveryone(onlyUnassigned: boolean) {
    if (selected.length === 0) {
      toast.error("Choose at least one colour first.");
      return;
    }
    const targets = onlyUnassigned ? unassigned : registrants;
    if (
      !onlyUnassigned &&
      mode === "replace" &&
      registrants.some(
        (r) => r.colors.length && !sameColors(r.colors, selected),
      ) &&
      !window.confirm(
        `Give all ${registrants.length} registered people ${selectionLabel}? This replaces colours already assigned.`,
      )
    ) {
      return;
    }
    const changes = new Map(
      targets.map((r) => [r.id, applyMode(r.colors, selected, mode)] as const),
    );
    const count = changes.size;
    if (await save(changes, onlyUnassigned ? "unassigned" : "everyone")) {
      toast.success(`${selectionLabel} set for ${people(count)}.`);
    }
  }

  /** Swap one colour for the selection (or remove it) for everyone who has it. */
  async function recolorGroup(from: string, to: string[]) {
    const members = registrants.filter((r) => r.colors.includes(from));
    if (
      !window.confirm(
        to.length
          ? `Change ${from} to ${to.join(" + ")} for ${people(members.length)}?`
          : `Remove the ${from} wristband from ${people(members.length)}?`,
      )
    ) {
      return;
    }
    const changes = new Map<string, string[]>(
      members.map((r) => {
        const index = r.colors.indexOf(from);
        const next = [
          ...r.colors.slice(0, index),
          ...to,
          ...r.colors.slice(index + 1),
        ];
        return [r.id, [...new Set(next)]];
      }),
    );
    if (await save(changes, `group:${from}`)) {
      if (filter === from) setFilter(to[0] ?? null);
      toast.success(
        to.length
          ? `${from} changed to ${to.join(" + ")}.`
          : `${from} wristbands removed.`,
      );
    }
  }

  async function setOne(r: Registrant, colors: string[]) {
    await save(new Map([[r.id, colors]]), `one:${r.id}`);
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
          Assign one or more wristband colours to people registered for this
          event. Volunteers see the colours when they check someone in.
        </p>
      </div>

      <Card className="space-y-4 border-gray-200 p-5">
        <div>
          <p className="text-sm font-medium text-gray-900">Colours</p>
          <p className="text-xs text-muted-foreground">
            Pick one or more. The actions below use this selection.
          </p>
        </div>
        <div className="flex min-h-9 flex-wrap items-center gap-2">
          {selected.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No colours selected
            </span>
          ) : (
            selected.map((c) => (
              <ColorChip key={c} color={c} onRemove={() => toggleColor(c)} />
            ))
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTypedColors();
          }}
        >
          <Input
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            list="wristband-colours"
            placeholder="Type a colour, e.g. Gold or Blue + Gold"
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
          <Button type="submit" variant="outline" disabled={!colorInput.trim()}>
            <Plus className="size-4" />
            Add
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {Object.keys(WRISTBAND_COLORS).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => toggleColor(name)}
              aria-pressed={selected.includes(name)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                selected.includes(name)
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50",
              )}
            >
              <Swatch color={name} />
              {name}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-gray-700">
            When someone already has a wristband
          </p>
          <div className="inline-flex rounded-full bg-gray-100 p-1">
            {(
              [
                ["replace", "Replace their colours"],
                ["add", "Add to their colours"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  mode === value
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-3 border-gray-200 p-5">
        <div>
          <p className="text-sm font-medium text-gray-900">Assign by list</p>
          <p className="text-xs text-muted-foreground">
            One person per line: email, student/staff number or full name. Add
            colours after it (e.g. <code>1234567, Gold, Blue</code>) to use
            those instead of the selection above. Only people already registered
            for this event are matched.
          </p>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={
            "1234567@students.wits.ac.za\n2345678, Gold\nThabo Nkosi, Blue, Gold\n(you can paste columns straight from Excel)"
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
            {selected.length
              ? `${mode === "add" ? "Adds" : "Gives"} ${selectionLabel}.`
              : "Select colours above first."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => assignEveryone(false)}
            disabled={
              busy !== null || selected.length === 0 || registrants.length === 0
            }
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
            disabled={
              busy !== null || selected.length === 0 || unassigned.length === 0
            }
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
            People with several wristbands count under each colour. Click a
            colour to filter the list below.
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
                  disabled={
                    busy !== null ||
                    selected.length === 0 ||
                    sameColors(selected, [name])
                  }
                  onClick={() => recolorGroup(name, selected)}
                >
                  {busy === `group:${name}` && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {selected.length && !sameColors(selected, [name])
                    ? `Change to ${selectionLabel}`
                    : "Change to…"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => recolorGroup(name, [])}
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
            {shown.map((r) => {
              const next = applyMode(r.colors, selected, mode);
              return (
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
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {r.colors.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No wristband
                      </span>
                    ) : (
                      r.colors.map((c) => (
                        <ColorChip
                          key={c}
                          color={c}
                          onRemove={
                            busy === null
                              ? () =>
                                  setOne(
                                    r,
                                    r.colors.filter((x) => x !== c),
                                  )
                              : undefined
                          }
                        />
                      ))
                    )}
                    {selected.length > 0 && !sameColors(next, r.colors) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setOne(r, next)}
                      >
                        {busy === `one:${r.id}` && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        {mode === "add" ? "Add" : "Set"} {selectionLabel}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
