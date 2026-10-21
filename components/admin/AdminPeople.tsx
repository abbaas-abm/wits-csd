"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import type { Profile, UserRole } from "@/lib/types";

const PAGE_SIZE = 25;
const ALL_EVENTS = "all";

const ROLES: UserRole[] = ["user", "volunteer", "admin"];

const ROLE_BADGE: Record<UserRole, "secondary" | "blue" | "default"> = {
  user: "secondary",
  volunteer: "blue",
  admin: "default",
};

export function AdminPeople() {
  const [rows, setRows] = React.useState<Profile[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<{ id: string; title: string }[]>(
    [],
  );
  const [eventId, setEventId] = React.useState(ALL_EVENTS);

  // Events for the filter, most recent first.
  React.useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select("id, title")
        .order("start_date", { ascending: false });
      setEvents(data ?? []);
    })();
  }, []);

  // Debounce the search box; any change resets to the first page.
  React.useEffect(() => {
    const id = setTimeout(() => {
      setTerm(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch only the current page (25 rows) from Supabase.
  React.useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Filtering by event keeps only people with a confirmed registration.
      const byEvent = eventId !== ALL_EVENTS;
      let request = supabase
        .from("profiles")
        .select(
          byEvent
            ? "*, registrations!attendee_id!inner(event_id, status)"
            : "*",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (byEvent) {
        request = request
          .eq("registrations.event_id", eventId)
          .eq("registrations.status", "CONFIRMED");
      }

      const safe = term.replace(/[,()%\\*]/g, " ").trim();
      if (safe) {
        request = request.or(
          `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,faculty.ilike.%${safe}%`,
        );
      }

      const { data, count, error } = await request;
      if (!active) return;
      if (error) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setRows((data ?? []) as unknown as Profile[]);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [term, page, eventId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  async function updateRole(userId: string, role: UserRole) {
    setSavingId(userId);
    const previous = rows;
    setRows((prev) => prev.map((p) => (p.id === userId ? { ...p, role } : p)));
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);
      if (error) throw error;
      toast.success(`Role updated to ${roleLabel(role)}.`);
    } catch (error) {
      setRows(previous);
      toast.error(
        error instanceof Error ? error.message : "Could not update role.",
      );
    } finally {
      setSavingId(null);
    }
  }

  function goToPage(next: number) {
    setLoading(true);
    setPage(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          {total} {total === 1 ? "user" : "users"}
          {loading && <Loader2 className="size-3.5 animate-spin" />}
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Select
            value={eventId}
            onValueChange={(value) => {
              setLoading(true);
              setEventId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_EVENTS}>All users</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  Registered: {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => {
                setLoading(true);
                setQuery(e.target.value);
              }}
              placeholder="Search users..."
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <Card className="space-y-2 border-gray-200 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <Users className="size-6 text-gray-400" />
          <h3 className="mt-3 text-base font-semibold text-gray-900">
            No users found
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {term
              ? "Try a different search term."
              : eventId !== ALL_EVENTS
                ? "Nobody has registered for this event yet."
                : "No users yet."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-gray-200 p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Change role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((person) => (
                  <tr key={person.id} className="bg-white">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(person.first_name, person.last_name)}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {[person.first_name, person.last_name]
                              .filter(Boolean)
                              .join(" ") || "Unnamed"}
                          </p>
                          {person.person_number && (
                            <p className="text-xs text-muted-foreground">
                              ID: {person.person_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{person.email}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {person.position ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_BADGE[person.role]}>
                        {roleLabel(person.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={person.role}
                          onValueChange={(value) =>
                            updateRole(person.id, value as UserRole)
                          }
                          disabled={savingId === person.id}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue>{roleLabel(person.role)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {roleLabel(role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {savingId === person.id && (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 p-4 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    goToPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages || loading}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
