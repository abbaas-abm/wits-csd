"use client";

import * as React from "react";
import { AlertTriangle, Loader2, MailCheck, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface Invite {
  email: string;
  name: string | null;
}

interface Registrant {
  email: string;
  name: string;
  personNumber: string | null;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/**
 * Parse pasted rows: one person per line, "email" or "email, name" (commas,
 * semicolons or tabs, so rows pasted straight from Excel work too).
 */
function parseInvites(text: string): { invites: Invite[]; skipped: number } {
  const seen = new Map<string, Invite>();
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split(/[\t,;]/).map((cell) => cell.trim());
    const emailIndex = cells.findIndex((cell) => EMAIL.test(cell));
    if (emailIndex === -1) {
      skipped++;
      continue;
    }
    const email = cells[emailIndex].toLowerCase();
    const name =
      cells.filter((cell, i) => i !== emailIndex && cell).join(" ") || null;
    seen.set(email, { email, name });
  }
  return { invites: [...seen.values()], skipped };
}

export function EventInvitesTab({ event }: { event: { id: string } }) {
  const [inviteOnly, setInviteOnly] = React.useState(false);
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [registrants, setRegistrants] = React.useState<Registrant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [setupMissing, setSetupMissing] = React.useState(false);
  const [text, setText] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [removing, setRemoving] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const [eventRes, invitesRes, registrationsRes] = await Promise.all([
        supabase
          .from("events")
          .select("invite_only")
          .eq("id", event.id)
          .maybeSingle(),
        supabase
          .from("event_invites")
          .select("email, name")
          .eq("event_id", event.id)
          .order("email"),
        supabase
          .from("registrations")
          .select(
            "attendee:profiles!attendee_id!inner(email, first_name, last_name, person_number)",
          )
          .eq("event_id", event.id)
          .eq("status", "CONFIRMED"),
      ]);
      if (!active) return;
      if (eventRes.error || invitesRes.error) {
        // The SQL script (supabase/fixes/event_invites.sql) hasn't been run.
        setSetupMissing(true);
        setLoading(false);
        return;
      }
      setInviteOnly(Boolean(eventRes.data?.invite_only));
      setInvites((invitesRes.data ?? []) as Invite[]);
      setRegistrants(
        (registrationsRes.data ?? []).flatMap((row) => {
          const attendee = (row as unknown as {
            attendee: {
              email: string | null;
              first_name: string | null;
              last_name: string | null;
              person_number: string | null;
            } | null;
          }).attendee;
          if (!attendee?.email) return [];
          return [
            {
              email: attendee.email.toLowerCase(),
              name: [attendee.first_name, attendee.last_name]
                .filter(Boolean)
                .join(" "),
              personNumber:
                attendee.person_number?.trim().toLowerCase() || null,
            },
          ];
        }),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [event.id]);

  // Same matching as the database: email, or student/staff number against
  // the part of the invite email before the @.
  const invitedEmails = React.useMemo(
    () => new Set(invites.map((invite) => invite.email)),
    [invites],
  );
  const invitedNumbers = React.useMemo(
    () => new Set(invites.map((invite) => invite.email.split("@")[0])),
    [invites],
  );
  const isInvited = (r: Registrant) =>
    invitedEmails.has(r.email) ||
    (r.personNumber !== null && invitedNumbers.has(r.personNumber));
  const notInvited = registrants.filter((r) => !isInvited(r));
  const registered = new Set(
    registrants.flatMap((r) => [r.email, r.personNumber ?? ""]),
  );
  const isRegistered = (invite: Invite) =>
    registered.has(invite.email) || registered.has(invite.email.split("@")[0]);
  const term = query.trim().toLowerCase();
  const shown = term
    ? invites.filter(
        (invite) =>
          invite.email.includes(term) ||
          (invite.name ?? "").toLowerCase().includes(term),
      )
    : invites;

  async function toggleInviteOnly(next: boolean) {
    setInviteOnly(next);
    const supabase = createClient();
    const { error } = await supabase
      .from("events")
      .update({ invite_only: next })
      .eq("id", event.id);
    if (error) {
      setInviteOnly(!next);
      toast.error(error.message);
      return;
    }
    toast.success(
      next
        ? "Registration is now limited to the invite list."
        : "Registration is open to everyone.",
    );
  }

  async function addInvites() {
    const { invites: parsed, skipped } = parseInvites(text);
    if (parsed.length === 0) {
      toast.error("No email addresses found. Paste one person per line.");
      return;
    }
    setAdding(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("event_invites")
        .upsert(
          parsed.map((invite) => ({ event_id: event.id, ...invite })),
          { onConflict: "event_id,email" },
        );
      if (error) throw error;
      setInvites((prev) => {
        const merged = new Map(prev.map((invite) => [invite.email, invite]));
        for (const invite of parsed) merged.set(invite.email, invite);
        return [...merged.values()].sort((a, b) =>
          a.email.localeCompare(b.email),
        );
      });
      setText("");
      toast.success(
        `${parsed.length} ${parsed.length === 1 ? "person" : "people"} added to the invite list.` +
          (skipped ? ` ${skipped} line(s) without an email were skipped.` : ""),
      );
    } catch (error) {
      toast.error(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Could not add invites.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function removeInvite(email: string) {
    setRemoving(email);
    const supabase = createClient();
    const { error } = await supabase
      .from("event_invites")
      .delete()
      .eq("event_id", event.id)
      .eq("email", email);
    setRemoving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInvites((prev) => prev.filter((invite) => invite.email !== email));
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
        <h2 className="font-semibold text-amber-900">Invite lists need setup</h2>
        <p className="mt-2 text-sm text-amber-800">
          Run <code>supabase/fixes/event_invites.sql</code> in the Supabase SQL
          editor, then reload this page.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Invite list</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          When invite-only is on, only people who sign in with an email on this
          list can register for the event.
        </p>
      </div>

      <Card className="flex flex-col gap-3 border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Invite only</p>
          <p className="text-xs text-muted-foreground">
            {inviteOnly
              ? `Only the ${invites.length} invited ${invites.length === 1 ? "person" : "people"} can register.`
              : "Anyone with an account can register."}
          </p>
        </div>
        <Switch
          checked={inviteOnly}
          onCheckedChange={toggleInviteOnly}
          aria-label="Toggle invite only"
        />
      </Card>

      {notInvited.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="size-4" />
            {notInvited.length} registered{" "}
            {notInvited.length === 1 ? "person is" : "people are"} not on the
            invite list
          </p>
          <ul className="mt-3 space-y-1 text-sm text-amber-900">
            {notInvited.map((person) => (
              <li key={person.email}>
                {person.name || "Unnamed"} · {person.email}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-800">
            Their existing registrations stay in place. Add them to the list, or
            cancel their registration from the Registrations tab.
          </p>
        </Card>
      )}

      <Card className="space-y-3 border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-900">Add people</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={
            "One person per line: email, name\n(you can paste the Email and Name columns straight from Excel)"
          }
        />
        <Button onClick={addInvites} disabled={adding}>
          {adding ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MailCheck className="size-4" />
          )}
          Add to invite list
        </Button>
      </Card>

      <Card className="overflow-hidden border-gray-200 p-0">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-900">
            {invites.length} invited
          </p>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invites..."
              className="pl-9"
            />
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {invites.length === 0 ? "No one invited yet." : "No matches."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((invite) => (
              <li
                key={invite.email}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {invite.name || invite.email}
                  </p>
                  {invite.name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {invite.email}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isRegistered(invite) && (
                    <Badge variant="success">Registered</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInvite(invite.email)}
                    disabled={removing === invite.email}
                    aria-label={`Remove ${invite.email}`}
                  >
                    {removing === invite.email ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
