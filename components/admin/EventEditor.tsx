"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Eye, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { revalidateEvents } from "@/lib/cache-actions";
import { cn, formatDate } from "@/lib/utils";
import type { EventRecord, EventMode, EventStatus } from "@/lib/types";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { AdminSpeakers } from "@/components/admin/AdminSpeakers";
import { EventMediaTab } from "@/components/admin/EventMediaTab";
import { EventProgramTab } from "@/components/admin/EventProgramTab";
import { EventRegistrationsTab } from "@/components/admin/EventRegistrationsTab";
import { EventFeedbackTab } from "@/components/admin/EventFeedbackTab";
import { EventAttendanceTab } from "@/components/admin/EventAttendanceTab";
import { EventAnnouncementsTab } from "@/components/admin/EventAnnouncementsTab";
import { EventFeaturedTab } from "@/components/admin/EventFeaturedTab";
import { EventRemindersTab } from "@/components/admin/EventRemindersTab";
import { EventInvitesTab } from "@/components/admin/EventInvitesTab";
import { EventWristbandsTab } from "@/components/admin/EventWristbandsTab";

const TABS = [
  "Information",
  "About",
  "Programme",
  "Speakers",
  "Media",
  "Registrations",
  "Attendance",
  "Feedback",
  "Announcements",
  "Preferences",
] as const;

// Secondary tabs revealed by the "More" dropdown next to Preferences.
const MORE_TABS = ["Featured", "Reminders", "Invites", "Wristbands"] as const;

type Tab = (typeof TABS)[number] | (typeof MORE_TABS)[number];

const ALL_TABS: readonly Tab[] = [...TABS, ...MORE_TABS];

const MODES: EventMode[] = ["IN_PERSON", "ONLINE"];
const STATUSES: EventStatus[] = ["OPEN", "CLOSED", "ENDED"];

interface FormState {
  title: string;
  theme: string;
  description: string;
  about: string;
  start_date: string;
  end_date: string;
  venue: string;
  mode: EventMode;
  status: EventStatus;
}

function toLocalInput(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toForm(event: EventRecord): FormState {
  return {
    title: event.title,
    theme: event.theme ?? "",
    description: event.description ?? "",
    about: event.about ?? "",
    start_date: toLocalInput(event.start_date),
    end_date: toLocalInput(event.end_date),
    venue: event.venue ?? "",
    mode: event.mode,
    status: event.status,
  };
}

export function EventEditor({
  event,
  initialTab,
}: {
  event: EventRecord;
  initialTab?: string;
}) {
  const [tab, setTab] = React.useState<Tab>(() =>
    initialTab && (ALL_TABS as readonly string[]).includes(initialTab)
      ? (initialTab as Tab)
      : "Information",
  );
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(toForm(event));
  const [visibility, setVisibility] = React.useState({
    has_information: event.has_information,
    has_about: event.has_about,
    has_programme: event.has_programme,
    has_speakers: event.has_speakers,
    has_media: event.has_media,
    has_featured: event.has_featured,
  });

  const visibilityByTab: Partial<Record<Tab, keyof typeof visibility>> = {
    Information: "has_information",
    About: "has_about",
    Programme: "has_programme",
    Speakers: "has_speakers",
    Media: "has_media",
    Featured: "has_featured",
  };
  const activeVisibilityKey = visibilityByTab[tab];

  const [preferences, setPreferences] = React.useState({
    has_pledges: event.has_pledges,
    has_reflections: event.has_reflections,
    has_feedback: event.has_feedback,
    has_side_notch: event.has_side_notch,
    has_questions: event.has_questions,
  });
  const [preferenceStatus, setPreferenceStatus] = React.useState<EventStatus>(
    event.status,
  );

  async function updateEventStatus(next: EventStatus) {
    const previous = preferenceStatus;
    setPreferenceStatus(next);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("events")
        .update({ status: next })
        .eq("id", event.id);
      if (error) throw error;
      setForm((prev) => ({ ...prev, status: next }));
      void revalidateEvents();
      toast.success(`Event status set to ${next}.`);
    } catch (error) {
      setPreferenceStatus(previous);
      toast.error(
        error instanceof Error ? error.message : "Could not update status.",
      );
    }
  }

  async function togglePreference(key: keyof typeof preferences) {
    const next = !preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: next }));
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("events")
        .update({ [key]: next })
        .eq("id", event.id);
      if (error) throw error;
      void revalidateEvents();
      toast.success(next ? "Feature enabled." : "Feature disabled.");
    } catch (error) {
      setPreferences((prev) => ({ ...prev, [key]: !next }));
      toast.error(
        error instanceof Error ? error.message : "Could not update preference.",
      );
    }
  }

  async function toggleVisibility(key: keyof typeof visibility) {
    const next = !visibility[key];
    setVisibility((prev) => ({ ...prev, [key]: next }));
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("events")
        .update({ [key]: next })
        .eq("id", event.id);
      if (error) throw error;
      void revalidateEvents();
      toast.success(
        next ? "Section is now visible." : "Section hidden from the event page.",
      );
    } catch (error) {
      setVisibility((prev) => ({ ...prev, [key]: !next }));
      toast.error(
        error instanceof Error ? error.message : "Could not update visibility.",
      );
    }
  }

  function selectTab(next: Tab) {
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url.toString());
    }
  }

  async function save(draft?: FormState) {
    const data = draft ?? form;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: updated, error } = await supabase
        .from("events")
        .update({
          title: data.title.trim() || "Draft",
          theme: data.theme.trim() || null,
          description: data.description.trim() || null,
          about: data.about.trim() || null,
          start_date: new Date(data.start_date).toISOString(),
          end_date: new Date(data.end_date).toISOString(),
          venue: data.venue.trim() || null,
          mode: data.mode,
          status: data.status,
        })
        .eq("id", event.id)
        .select("*")
        .single();
      if (error) throw error;
      setForm(toForm(updated as EventRecord));
      void revalidateEvents();
      toast.success("Event saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save event.",
      );
    } finally {
      setSaving(false);
    }
  }

  function update(patch: Partial<FormState>, persist = false) {
    const next = { ...form, ...patch };
    setForm(next);
    if (persist) void save(next);
  }

  const isDraft = form.title.trim().toLowerCase() === "draft";

  return (
    <div className="flex flex-col">
      <div className="border-b border-gray-200 bg-white px-4 pt-5 sm:px-6">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to events
        </Link>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">
                {form.title || "Untitled event"}
              </h2>
              {isDraft && <Badge variant="warning">Draft</Badge>}
              <Badge
                variant={
                  form.status === "OPEN"
                    ? "success"
                    : form.status === "CLOSED"
                      ? "warning"
                      : "destructive"
                }
              >
                {form.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Event ID {event.id.slice(0, 8).toUpperCase()} · Updated{" "}
              {formatDate(event.updated_at)}
            </p>
          </div>
          <Button onClick={() => save()} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>

        <nav className="mt-5 -mb-px flex items-stretch overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => selectTab(item)}
              className={cn(
                "relative whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === item
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-600 hover:text-gray-900",
              )}
            >
              {item}
            </button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative inline-flex items-center gap-1 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  (MORE_TABS as readonly string[]).includes(tab)
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-600 hover:text-gray-900",
                )}
              >
                More
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MORE_TABS.map((item) => (
                <DropdownMenuItem key={item} onSelect={() => selectTab(item)}>
                  {item}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>

      {activeVisibilityKey && (
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Visibility</p>
              <p className="text-xs text-muted-foreground">
                {visibility[activeVisibilityKey] ? "Public" : "Private"}
              </p>
            </div>
          </div>
          <Switch
            checked={visibility[activeVisibilityKey]}
            onCheckedChange={() => toggleVisibility(activeVisibilityKey)}
            aria-label={`Toggle ${tab} visibility`}
          />
        </div>
      )}

      <div className="p-4 sm:p-6">
        {tab === "Information" ? (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  placeholder="Draft"
                  onChange={(e) => update({ title: e.target.value })}
                  onBlur={() => save()}
                />
              </div>
              <div className="space-y-2">
                <Label>Theme</Label>
                <Input
                  value={form.theme}
                  placeholder="e.g. Leadership"
                  onChange={(e) => update({ theme: e.target.value })}
                  onBlur={() => save()}
                />
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <Input
                  value={form.venue}
                  placeholder="e.g. Matrix, East Campus"
                  onChange={(e) => update({ venue: e.target.value })}
                  onBlur={() => save()}
                />
              </div>
              <div className="space-y-2">
                <Label>Starts</Label>
                <Input
                  type="datetime-local"
                  value={form.start_date}
                  onChange={(e) => update({ start_date: e.target.value })}
                  onBlur={() => save()}
                />
              </div>
              <div className="space-y-2">
                <Label>Ends</Label>
                <Input
                  type="datetime-local"
                  value={form.end_date}
                  onChange={(e) => update({ end_date: e.target.value })}
                  onBlur={() => save()}
                />
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={form.mode}
                  onValueChange={(value) =>
                    update({ mode: value as EventMode }, true)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode === "IN_PERSON" ? "In Person" : "Online"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    update({ status: value as EventStatus }, true)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Short description</Label>
                <Textarea
                  value={form.description}
                  placeholder="A short summary shown on event cards."
                  onChange={(e) => update({ description: e.target.value })}
                  onBlur={() => save()}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Changes save automatically when you leave a field, or click Save
              changes.
            </p>
          </div>
        ) : tab === "About" ? (
          <div className="mx-auto max-w-3xl space-y-3">
            <div>
              <Label>About this event</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the toolbar to format headings, lists, links and emphasis.
                This content is shown on the public event page.
              </p>
            </div>
            <RichTextEditor
              value={form.about}
              onChange={(html) => update({ about: html })}
              onBlur={() => save()}
              placeholder="Write a rich description of the event, its objectives, what attendees will gain..."
            />
            <p className="text-xs text-muted-foreground">
              Changes save automatically when you leave the editor, or click
              Save changes.
            </p>
          </div>
        ) : tab === "Speakers" ? (
          <div className="mx-auto max-w-6xl">
            <AdminSpeakers eventId={event.id} />
          </div>
        ) : tab === "Media" ? (
          <EventMediaTab event={event} />
        ) : tab === "Programme" ? (
          <EventProgramTab event={event} />
        ) : tab === "Registrations" ? (
          <EventRegistrationsTab event={event} />
        ) : tab === "Feedback" ? (
          <EventFeedbackTab event={event} />
        ) : tab === "Attendance" ? (
          <EventAttendanceTab event={event} />
        ) : tab === "Announcements" ? (
          <EventAnnouncementsTab event={event} />
        ) : tab === "Preferences" ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Event preferences
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enable or disable attendee features for this event. When off,
                the buttons are hidden and the pages are disabled.
              </p>
            </div>

            <Card className="border-gray-200 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Event status
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Controls the registration button on the event page.
                  </p>
                </div>
                <Select
                  value={preferenceStatus}
                  onValueChange={(value) =>
                    updateEventStatus(value as EventStatus)
                  }
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <Card className="divide-y divide-gray-100 border-gray-200 p-0">
              {(
                [
                  {
                    key: "has_pledges" as const,
                    label: "Pledges",
                    description:
                      "Allow attendees to sign a pledge and receive a certificate.",
                  },
                  {
                    key: "has_reflections" as const,
                    label: "Reflections",
                    description: "Show the live reflections wall for this event.",
                  },
                  {
                    key: "has_feedback" as const,
                    label: "Feedback",
                    description: "Allow attendees to submit event feedback.",
                  },
                  {
                    key: "has_side_notch" as const,
                    label: "Side notch",
                    description:
                      "Show the fixed side tabs (About, Programme, Speakers, Featured) on the event page.",
                  },
                  {
                    key: "has_questions" as const,
                    label: "Q&A",
                    description:
                      "Let attendees ask speakers questions from the event page.",
                  },
                ]
              ).map((preference) => (
                <div
                  key={preference.key}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {preference.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {preference.description}
                    </p>
                  </div>
                  <Switch
                    checked={preferences[preference.key]}
                    onCheckedChange={() =>
                      togglePreference(preference.key)
                    }
                    aria-label={`Toggle ${preference.label}`}
                  />
                </div>
              ))}
            </Card>
          </div>
        ) : tab === "Featured" ? (
          <EventFeaturedTab event={event} />
        ) : tab === "Reminders" ? (
          <EventRemindersTab event={event} />
        ) : tab === "Invites" ? (
          <EventInvitesTab event={event} />
        ) : tab === "Wristbands" ? (
          <EventWristbandsTab event={event} />
        ) : null}
      </div>
    </div>
  );
}
