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

/**
 * Someone getting wristbands: either registered for the event (colours live
 * on their registration) or not registered yet (colours wait in
 * event_wristbands under their email or student/staff number, and move onto
 * the registration when they register).
 */
interface Person {
  key: string;
  kind: "registered" | "pending";
  id: string; // registration id, or the pending identifier
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

const NONE = "__none__";
const PENDING = "__pending__";

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const PERSON_NUMBER = /^[a-z]{0,2}\d{5,}$/i;
const PAGE = 1000;
// Keeps the ?id=in.(...) filter well under URL length limits.
const UPDATE_CHUNK = 100;

const sameColors = (a: string[], b: string[]) =>
  a.length === b.length && a.every((c) => b.includes(c));

const normalizeName = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

function applyMode(current: string[], selected: string[], mode: Mode) {
  return mode === "add" ? [...new Set([...current, ...selected])] : selected;
}

function pendingPerson(
  identifier: string,
  name: string,
  colors: string[],
): Person {
  const isEmail = identifier.includes("@");
  return {
    key: `p:${identifier}`,
    kind: "pending",
    id: identifier,
    name,
    email: isEmail ? identifier : "",
    personNumber: isEmail ? null : identifier,
    colors,
  };
}

function sortPeople(people: Person[]) {
  return [...people].sort((a, b) =>
    (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id),
  );
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

interface ParsedList {
  assignments: Map<string, string[]>; // person key -> colours
  added: Person[]; // new people not registered yet
  byName: { line: string; name: string; colors: string[] }[]; // to look up
  unmatched: Unmatched[];
}

/**
 * Match pasted rows. One person per line: email, student/staff number or
 * full name, optionally followed by one or more colours (commas, semicolons
 * or tabs, so Excel columns paste straight in). Lines without a colour get
 * the selected colours. People not registered for the event are kept by
 * email or number; name-only lines are looked up on the platform afterwards.
 */
function parseList(
  text: string,
  people: Person[],
  selected: string[],
): ParsedList {
  const byEmail = new Map<string, Person>();
  const byNumber = new Map<string, Person>();
  const byName = new Map<string, Person[]>();
  // Registered people win over pending entries for the same person.
  for (const p of [
    ...people.filter((p) => p.kind === "pending"),
    ...people.filter((p) => p.kind === "registered"),
  ]) {
    if (p.email) byEmail.set(p.email, p);
    if (p.personNumber) byNumber.set(p.personNumber, p);
    const key = normalizeName(p.name);
    if (key && p.kind === "registered") {
      byName.set(key, [...(byName.get(key) ?? []), p]);
    }
  }
  const knownColors = new Set([
    ...Object.keys(WRISTBAND_COLORS),
    ...selected,
    ...people.flatMap((p) => p.colors),
  ]);
  const isColorCell = (cell: string) => {
    const colors = parseWristbands(cell);
    return colors.length > 0 && colors.every((c) => knownColors.has(c));
  };

  const result: ParsedList = {
    assignments: new Map(),
    added: [],
    byName: [],
    unmatched: [],
  };
  const added = new Map<string, Person>();

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line
      .split(/[\t,;]/)
      .map((cell) => cell.trim())
      .filter(Boolean);

    let person: Person | undefined;
    let ambiguous = false;
    let personCell = -1;
    cells.forEach((cell, i) => {
      if (person) return;
      const value = cell.toLowerCase();
      const found = EMAIL.test(value)
        ? (byEmail.get(value) ?? byNumber.get(value.split("@")[0]))
        : byNumber.get(value);
      const named = byName.get(normalizeName(value)) ?? [];
      if (found) person = found;
      else if (named.length === 1) person = named[0];
      else if (named.length > 1) ambiguous = true;
      if (person) personCell = i;
    });
    // "First, Last" in two columns.
    if (!person && cells.length >= 2) {
      const named = byName.get(normalizeName(`${cells[0]} ${cells[1]}`)) ?? [];
      if (named.length === 1) {
        person = named[0];
        personCell = 1;
      } else if (named.length > 1) ambiguous = true;
    }

    // Not on the list yet: identify them by email or student/staff number.
    const idCell = person
      ? -1
      : cells.findIndex(
          (cell) => EMAIL.test(cell) || PERSON_NUMBER.test(cell),
        );
    const skip = person ? personCell : idCell;
    const colorCells = cells.filter(
      (cell, i) => i !== skip && isColorCell(cell),
    );
    const lineColors = [...new Set(colorCells.flatMap(parseWristbands))];
    const colors = lineColors.length ? lineColors : selected;
    const name = cells
      .filter((cell, i) => i !== skip && !colorCells.includes(cell))
      .join(" ");

    if (colors.length === 0) {
      result.unmatched.push({
        line,
        reason: "No colour on this line or selected above.",
      });
      continue;
    }
    if (person) {
      result.assignments.set(person.key, colors);
    } else if (idCell !== -1) {
      const identifier = cells[idCell].toLowerCase();
      added.set(identifier, pendingPerson(identifier, name, colors));
    } else if (ambiguous) {
      result.unmatched.push({
        line,
        reason:
          "More than one registered person has this name. Use their email or student number.",
      });
    } else {
      result.byName.push({ line, name, colors });
    }
  }

  result.added = [...added.values()];
  return result;
}

export function EventWristbandsTab({ event }: { event: { id: string } }) {
  const [people, setPeople] = React.useState<Person[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [setupMissing, setSetupMissing] = React.useState(false);
  const [pendingReady, setPendingReady] = React.useState(true);
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
      const registered: Person[] = [];
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
          registered.push({
            key: `r:${id}`,
            kind: "registered",
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

      const { data: pendingRows, error: pendingError } = await supabase
        .from("event_wristbands")
        .select("identifier, name, colors")
        .eq("event_id", event.id);
      if (!active) return;

      // Hide entries for people who have since registered (the database
      // moves their colours across when they do).
      const registeredIds = new Set(
        registered.flatMap((p) => [p.email, p.personNumber ?? ""]),
      );
      const pending = (pendingRows ?? [])
        .filter(
          (row) =>
            !registeredIds.has(row.identifier) &&
            !registeredIds.has(row.identifier.split("@")[0]),
        )
        .map((row) =>
          pendingPerson(
            row.identifier,
            row.name ?? "",
            parseWristbands(row.colors),
          ),
        );

      setPendingReady(!pendingError);
      setPeople(sortPeople([...registered, ...pending]));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [event.id]);

  // People with several wristbands count once under each colour.
  const groups = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of people) {
      for (const c of p.colors) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [people]);
  const registeredCount = people.filter((p) => p.kind === "registered").length;
  const pendingCount = people.length - registeredCount;
  const unassigned = people.filter(
    (p) => p.kind === "registered" && p.colors.length === 0,
  );

  const term = query.trim().toLowerCase();
  const shown = people.filter(
    (p) =>
      (filter === null ||
        (filter === NONE
          ? p.kind === "registered" && p.colors.length === 0
          : filter === PENDING
            ? p.kind === "pending"
            : p.colors.includes(filter))) &&
      (!term ||
        p.name.toLowerCase().includes(term) ||
        p.email.includes(term) ||
        (p.personNumber ?? "").includes(term)),
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

  /**
   * Save each person's full colour list and mirror it locally. `added` are
   * new not-yet-registered people whose colours are in `changes`.
   */
  async function save(
    changes: Map<string, string[]>,
    label: string,
    added: Person[] = [],
  ) {
    const known = new Map([...people, ...added].map((p) => [p.key, p]));
    const addedKeys = new Set(added.map((p) => p.key));
    for (const [key, colors] of changes) {
      const person = known.get(key);
      if (!person) changes.delete(key);
      else if (!addedKeys.has(key) && sameColors(person.colors, colors)) {
        changes.delete(key);
      }
    }
    if (changes.size === 0) {
      toast.info("Nothing to change.");
      return false;
    }

    const registeredByValue = new Map<string | null, string[]>();
    const upserts: {
      event_id: string;
      identifier: string;
      name: string | null;
      colors: string;
    }[] = [];
    const removals: string[] = [];
    for (const [key, colors] of changes) {
      const person = known.get(key)!;
      const value = formatWristbands(colors);
      if (person.kind === "registered") {
        registeredByValue.set(value, [
          ...(registeredByValue.get(value) ?? []),
          person.id,
        ]);
      } else if (value) {
        upserts.push({
          event_id: event.id,
          identifier: person.id,
          name: person.name || null,
          colors: value,
        });
      } else {
        removals.push(person.id);
      }
    }

    setBusy(label);
    try {
      const supabase = createClient();
      for (const [value, ids] of registeredByValue) {
        for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
          const { error } = await supabase
            .from("registrations")
            .update({ wristband_color: value })
            .eq("event_id", event.id)
            .in("id", ids.slice(i, i + UPDATE_CHUNK));
          if (error) throw error;
        }
      }
      for (let i = 0; i < upserts.length; i += PAGE) {
        const { error } = await supabase
          .from("event_wristbands")
          .upsert(upserts.slice(i, i + PAGE), {
            onConflict: "event_id,identifier",
          });
        if (error) throw error;
      }
      for (let i = 0; i < removals.length; i += UPDATE_CHUNK) {
        const { error } = await supabase
          .from("event_wristbands")
          .delete()
          .eq("event_id", event.id)
          .in("identifier", removals.slice(i, i + UPDATE_CHUNK));
        if (error) throw error;
      }
      setPeople((prev) => {
        const existing = new Set(prev.map((p) => p.key));
        return sortPeople(
          [...prev, ...added.filter((p) => !existing.has(p.key))]
            .map((p) => {
              const next = changes.get(p.key);
              return next ? { ...p, colors: next } : p;
            })
            // A not-yet-registered person with no colours is just removed.
            .filter((p) => p.kind === "registered" || p.colors.length > 0),
        );
      });
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

  const count = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

  /** Find a platform account by full name; returns its email if unique. */
  async function findByName(name: string): Promise<string | null> {
    const first = name.split(" ")[0]?.replace(/[%_\\]/g, "\\$&");
    if (!first) return null;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .ilike("first_name", `${first}%`)
      .limit(200);
    const matches = (data ?? []).filter(
      (p) =>
        p.email &&
        normalizeName(`${p.first_name ?? ""} ${p.last_name ?? ""}`) ===
          normalizeName(name),
    );
    return matches.length === 1 ? matches[0].email.toLowerCase() : null;
  }

  async function assignList() {
    const parsed = parseList(text, people, selected);
    const missed = [...parsed.unmatched];
    let added = parsed.added;

    if (!pendingReady && (added.length || parsed.byName.length)) {
      for (const p of added) {
        missed.push({
          line: p.name ? `${p.id}, ${p.name}` : p.id,
          reason:
            "Not registered yet. Re-run supabase/fixes/wristbands.sql to assign people before they register.",
        });
      }
      for (const item of parsed.byName) {
        missed.push({ line: item.line, reason: "Not registered for this event." });
      }
      added = [];
    } else if (parsed.byName.length) {
      setBusy("list");
      const found = await Promise.all(
        parsed.byName.map((item) => findByName(item.name)),
      );
      setBusy(null);
      parsed.byName.forEach((item, i) => {
        const email = found[i];
        if (email) added.push(pendingPerson(email, item.name, item.colors));
        else {
          missed.push({
            line: item.line,
            reason:
              "No single account on the platform with this name. Use their email or student number.",
          });
        }
      });
    }

    // A "new" person may already be waiting from an earlier list.
    const changes = new Map<string, string[]>();
    const current = new Map(people.map((p) => [p.key, p]));
    for (const [key, colors] of parsed.assignments) {
      changes.set(key, applyMode(current.get(key)?.colors ?? [], colors, mode));
    }
    const fresh: Person[] = [];
    for (const p of added) {
      const existing = current.get(p.key);
      changes.set(
        p.key,
        existing ? applyMode(existing.colors, p.colors, mode) : p.colors,
      );
      if (!existing) fresh.push(p);
    }

    setUnmatched(missed);
    if (changes.size === 0) {
      toast.error(
        missed.length
          ? "No one on the list could be assigned."
          : "Paste one person per line.",
      );
      return;
    }
    const total = changes.size;
    const waiting = added.length;
    if (await save(changes, "list", fresh)) {
      setText("");
      toast.success(
        `Wristbands updated for ${count(total)}` +
          (waiting ? ` (${waiting} not registered yet).` : ".") +
          (missed.length ? ` ${missed.length} line(s) not assigned.` : ""),
      );
    }
  }

  async function assignEveryone(onlyUnassigned: boolean) {
    if (selected.length === 0) {
      toast.error("Choose at least one colour first.");
      return;
    }
    const targets = onlyUnassigned ? unassigned : people;
    if (
      !onlyUnassigned &&
      mode === "replace" &&
      people.some((p) => p.colors.length && !sameColors(p.colors, selected)) &&
      !window.confirm(
        `Give all ${people.length} people ${selectionLabel}? This replaces colours already assigned.`,
      )
    ) {
      return;
    }
    const changes = new Map(
      targets.map((p) => [p.key, applyMode(p.colors, selected, mode)] as const),
    );
    const total = changes.size;
    if (await save(changes, onlyUnassigned ? "unassigned" : "everyone")) {
      toast.success(`${selectionLabel} set for ${count(total)}.`);
    }
  }

  /** Swap one colour for the selection (or remove it) for everyone who has it. */
  async function recolorGroup(from: string, to: string[]) {
    const members = people.filter((p) => p.colors.includes(from));
    if (
      !window.confirm(
        to.length
          ? `Change ${from} to ${to.join(" + ")} for ${count(members.length)}?`
          : `Remove the ${from} wristband from ${count(members.length)}?`,
      )
    ) {
      return;
    }
    const changes = new Map<string, string[]>(
      members.map((p) => {
        const index = p.colors.indexOf(from);
        const next = [
          ...p.colors.slice(0, index),
          ...to,
          ...p.colors.slice(index + 1),
        ];
        return [p.key, [...new Set(next)]];
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

  async function setOne(p: Person, colors: string[]) {
    await save(new Map([[p.key, colors]]), `one:${p.key}`);
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
          Assign one or more wristband colours to people for this event,
          including people who haven&apos;t registered yet: their colours are
          applied when they register. Volunteers see the colours when they
          check someone in.
        </p>
      </div>

      {!pendingReady && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          To assign people who haven&apos;t registered yet, run the updated{" "}
          <code>supabase/fixes/wristbands.sql</code> in the Supabase SQL
          editor, then reload this page.
        </Card>
      )}

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
            those instead of the selection above. People who haven&apos;t
            registered yet get their colours when they register; a name on its
            own only works if they already have an account on the platform.
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
              ? `${mode === "add" ? "Adds" : "Gives"} ${selectionLabel}. Everyone means the ${registeredCount} registered plus the ${pendingCount} not registered yet on this page.`
              : "Select colours above first."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => assignEveryone(false)}
            disabled={busy !== null || selected.length === 0 || people.length === 0}
          >
            {busy === "everyone" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Users className="size-4" />
            )}
            Everyone ({people.length})
          </Button>
          <Button
            variant="outline"
            onClick={() => assignEveryone(true)}
            disabled={
              busy !== null || selected.length === 0 || unassigned.length === 0
            }
          >
            {busy === "unassigned" && <Loader2 className="size-4 animate-spin" />}
            Only registered people without a wristband ({unassigned.length})
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-gray-200 p-0">
        <div className="border-b border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-900">Summary</p>
          <p className="text-xs text-muted-foreground">
            People with several wristbands count under each colour. Click a
            row to filter the list below.
          </p>
        </div>
        <ul className="divide-y divide-gray-100">
          {groups.map(([name, n]) => (
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
                <span className="text-muted-foreground">· {count(n)}</span>
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
              onClick={() => setFilter(filter === NONE ? null : NONE)}
              className={cn(
                "flex items-center gap-2 text-left",
                filter === NONE && "font-semibold text-primary",
              )}
            >
              <span className="inline-block size-4 rounded-full border border-dashed border-gray-400" />
              Registered, no wristband
              <span className="text-muted-foreground">
                · {count(unassigned.length)}
              </span>
            </button>
          </li>
          {pendingCount > 0 && (
            <li className="px-4 py-3 text-sm">
              <button
                type="button"
                onClick={() => setFilter(filter === PENDING ? null : PENDING)}
                className={cn(
                  "flex items-center gap-2 text-left",
                  filter === PENDING && "font-semibold text-primary",
                )}
              >
                <span className="inline-block size-4 rounded-full border border-amber-300 bg-amber-100" />
                Not registered yet
                <span className="text-muted-foreground">
                  · {count(pendingCount)}
                </span>
              </button>
            </li>
          )}
        </ul>
      </Card>

      <Card className="overflow-hidden border-gray-200 p-0">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-900">
            {filter === null
              ? `${registeredCount} registered` +
                (pendingCount ? ` · ${pendingCount} not registered yet` : "")
              : `${shown.length} ${
                  filter === NONE
                    ? "registered without a wristband"
                    : filter === PENDING
                      ? "not registered yet"
                      : `with ${filter}`
                }`}
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
            {people.length === 0
              ? "No one is registered or assigned yet."
              : "No matches."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((p) => {
              const next = applyMode(p.colors, selected, mode);
              return (
                <li
                  key={p.key}
                  className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium text-gray-900">
                      <span className="truncate">
                        {p.name || p.email || p.personNumber}
                      </span>
                      {p.kind === "pending" && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          Not registered yet
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.email, p.personNumber].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {p.colors.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No wristband
                      </span>
                    ) : (
                      p.colors.map((c) => (
                        <ColorChip
                          key={c}
                          color={c}
                          onRemove={
                            busy === null
                              ? () =>
                                  setOne(
                                    p,
                                    p.colors.filter((x) => x !== c),
                                  )
                              : undefined
                          }
                        />
                      ))
                    )}
                    {selected.length > 0 && !sameColors(next, p.colors) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setOne(p, next)}
                      >
                        {busy === `one:${p.key}` && (
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
