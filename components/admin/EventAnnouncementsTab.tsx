"use client";

import * as React from "react";
import {
  ArrowUpRight,
  BellRing,
  Eye,
  Link2,
  Loader2,
  Mail,
  Megaphone,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AnnouncementPreviewDialog,
  type AnnouncementDraft,
} from "@/components/admin/AnnouncementPreviewDialog";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate, formatTime } from "@/lib/utils";
import {
  isInternalLink,
  normaliseLink,
  type AnnouncementAudience,
  type AudienceCounts,
} from "@/lib/announcements";
import type { Announcement } from "@/lib/types";

type LinkMode = "none" | "internal" | "external";

interface PageOption {
  value: string;
  label: string;
  /** Suggested button text when this page is picked. */
  cta: string;
}

interface PageGroup {
  label: string;
  options: PageOption[];
}

const SITE_PAGES: PageOption[] = [
  { value: "/", label: "Home", cta: "Visit the platform" },
  { value: "/events", label: "All events", cta: "Browse events" },
  { value: "/about", label: "About", cta: "Learn more" },
  { value: "/contact", label: "Contact", cta: "Contact us" },
  { value: "/user", label: "My dashboard", cta: "Open my dashboard" },
];

const n = (value: number) => value.toLocaleString("en-ZA");

export function EventAnnouncementsTab({
  event,
}: {
  event: { id: string; title: string };
}) {
  const [items, setItems] = React.useState<Announcement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [groups, setGroups] = React.useState<PageGroup[]>([]);
  const [counts, setCounts] = React.useState<AudienceCounts | null>(null);

  const [text, setText] = React.useState("");
  const [linkMode, setLinkMode] = React.useState<LinkMode>("none");
  const [internalPath, setInternalPath] = React.useState("");
  const [externalUrl, setExternalUrl] = React.useState("");
  const [linkLabel, setLinkLabel] = React.useState("");

  const [audience, setAudience] =
    React.useState<AnnouncementAudience>("registered");
  const [sendPush, setSendPush] = React.useState(true);
  const [sendEmail, setSendEmail] = React.useState(false);
  const [subject, setSubject] = React.useState("");

  const [posting, setPosting] = React.useState(false);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  // What the preview dialog is showing: a new draft, or a posted
  // announcement about to be sent again.
  const [preview, setPreview] = React.useState<
    | { kind: "new"; draft: AnnouncementDraft }
    | { kind: "resend"; item: Announcement }
    | null
  >(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const [announcements, events, albums] = await Promise.all([
        supabase
          .from("announcements")
          .select("*")
          .eq("event_id", event.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, title, start_date")
          .order("start_date", { ascending: false }),
        supabase
          .from("event_gallery_images")
          .select("album")
          .eq("event_id", event.id)
          .eq("media_type", "image")
          .order("display_order", { ascending: true })
          .limit(5000),
      ]);
      if (!active) return;

      setItems((announcements.data ?? []) as Announcement[]);
      setLoading(false);

      const base = `/events/${event.id}`;
      const albumNames = [
        ...new Set(
          (albums.data ?? [])
            .map((row) => (row.album as string | null)?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      setGroups([
        {
          label: "This event",
          options: [
            { value: base, label: "Event page", cta: "View event" },
            { value: `${base}/gallery`, label: "Gallery", cta: "View photos & videos" },
            ...albumNames.map((album) => ({
              value: `${base}/gallery?album=${encodeURIComponent(album)}`,
              label: `Gallery – ${album}`,
              cta: "View photos",
            })),
            { value: `${base}/questions`, label: "Q&A", cta: "Ask a question" },
            { value: `/pledges/${event.id}`, label: "Pledges", cta: "Make your pledge" },
            { value: `/reflections?event=${event.id}`, label: "Reflections", cta: "Share a reflection" },
            { value: `/feedback/${event.id}`, label: "Feedback form", cta: "Give feedback" },
          ],
        },
        { label: "Site pages", options: SITE_PAGES },
        {
          label: "Other events",
          options: (events.data ?? [])
            .filter((e) => e.id !== event.id)
            .flatMap((e) => [
              { value: `/events/${e.id}`, label: e.title, cta: "View event" },
              {
                value: `/events/${e.id}/gallery`,
                label: `${e.title} – Gallery`,
                cta: "View photos",
              },
            ]),
        },
      ]);
    })();
    fetch(`/api/admin/announce?eventId=${event.id}`)
      .then((res) => res.json())
      .then((data: { counts?: AudienceCounts }) => {
        if (active && data.counts) setCounts(data.counts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [event.id]);

  const allOptions = groups.flatMap((group) => group.options);
  const link =
    linkMode === "internal"
      ? internalPath || null
      : linkMode === "external"
        ? normaliseLink(externalUrl)
        : null;
  const linkInvalid = linkMode === "external" && externalUrl.trim() !== "" && !link;
  const emailAllowed = audience !== "all-devices";

  function pickInternal(value: string) {
    setInternalPath(value);
    const option = allOptions.find((o) => o.value === value);
    // Suggest button text unless the admin already typed their own.
    if (option && (!linkLabel || allOptions.some((o) => o.cta === linkLabel))) {
      setLinkLabel(option.cta);
    }
  }

  function describeSend(): string | null {
    const parts: string[] = [];
    if (sendPush) {
      const devices = !counts
        ? "their"
        : audience === "registered"
          ? `${n(counts.registeredWithPush)} people's`
          : audience === "checked-in"
            ? `${n(counts.checkedInWithPush)} people's`
            : `${n(counts.allDevices)}`;
      parts.push(`a push notification to ${devices} devices`);
    }
    if (sendEmail && emailAllowed) {
      const people = !counts
        ? "the audience"
        : `${n(audience === "registered" ? counts.registered : counts.checkedIn)} people`;
      parts.push(`an email to ${people}`);
    }
    return parts.length ? parts.join(" and ") : null;
  }

  async function notify(announcementId: string) {
    const response = await fetch("/api/admin/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        announcementId,
        audience,
        push: sendPush,
        email: sendEmail && emailAllowed,
        subject: subject.trim() || undefined,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      push?: { sent: number; failed: number } | { error: string };
      email?: { mode: string; queued: number; failed?: number };
    };
    if (!response.ok) throw new Error(data.error ?? "Sending failed.");

    if (data.push && "error" in data.push) toast.error(data.push.error);
    else if (data.push)
      toast.success(
        `Push notification sent to ${n(data.push.sent)} device${data.push.sent === 1 ? "" : "s"}${data.push.failed ? ` (${n(data.push.failed)} no longer reachable)` : ""}.`,
      );
    if (data.email)
      toast.success(
        data.email.mode === "queued"
          ? `${n(data.email.queued)} emails queued. They go out over the next few minutes.`
          : `${n(data.email.queued - (data.email.failed ?? 0))} emails sent.`,
        { duration: 8000 },
      );
  }

  /** Checks the form, then opens the preview. Nothing is posted yet. */
  function openPreview() {
    const value = text.trim();
    if (!value) {
      toast.error("Please write an announcement first.");
      return;
    }
    if (linkMode !== "none" && !link) {
      toast.error(
        linkMode === "internal"
          ? "Choose a page to link to, or switch the link off."
          : "Enter a valid link starting with https://",
      );
      return;
    }
    setPreview({
      kind: "new",
      draft: {
        text: value,
        link_url: link,
        link_label: link ? linkLabel.trim() || null : null,
      },
    });
  }

  async function post(draft: AnnouncementDraft) {
    setPosting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("announcements")
        .insert({ event_id: event.id, ...draft })
        .select("*")
        .single();
      if (error) {
        if (/link_url|link_label|schema cache/i.test(error.message)) {
          throw new Error(
            "Announcement links need a database update. Run supabase/fixes/announcement_links_gallery_cover.sql in the Supabase SQL editor.",
          );
        }
        throw error;
      }
      const created = data as Announcement;
      setItems((prev) => [created, ...prev]);
      setText("");
      setLinkMode("none");
      setInternalPath("");
      setExternalUrl("");
      setLinkLabel("");
      setPreview(null);
      toast.success("Announcement posted.");
      if (sendPush || (sendEmail && emailAllowed)) await notify(created.id);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Could not post the announcement.",
      );
    } finally {
      setPosting(false);
    }
  }

  function previewResend(item: Announcement) {
    if (!describeSend()) {
      toast.error("Turn on push or email under “Send to” first.");
      return;
    }
    setPreview({ kind: "resend", item });
  }

  async function resend(item: Announcement) {
    setSendingId(item.id);
    try {
      await notify(item.id);
      setPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sending failed.");
    } finally {
      setSendingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this announcement?")) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Announcement deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the announcement.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const audiences: {
    value: AnnouncementAudience;
    title: string;
    detail: string;
  }[] = [
    {
      value: "registered",
      title: "Everyone registered",
      detail: counts
        ? `${n(counts.registered)} people · ${n(counts.registeredWithPush)} with notifications on`
        : "Loading…",
    },
    {
      value: "checked-in",
      title: "Checked in at the event",
      detail: counts
        ? `${n(counts.checkedIn)} people · ${n(counts.checkedInWithPush)} with notifications on`
        : "Loading…",
    },
    {
      value: "all-devices",
      title: "Every device with notifications on",
      detail: counts
        ? `${n(counts.allDevices)} devices, including people not at this event · push only`
        : "Loading…",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="space-y-6 border-gray-200 p-6">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Megaphone className="size-4 text-primary" />
            New announcement
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Posted announcements appear on this event&apos;s page, signed
            “From the CSD Team”.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write an announcement for attendees..."
            className="mt-4 min-h-28"
          />
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Link
          </Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["none", "No link"],
                ["internal", "Page on this site"],
                ["external", "External link"],
              ] as const
            ).map(([value, label]) => (
              <OptionButton
                key={value}
                active={linkMode === value}
                onClick={() => setLinkMode(value)}
              >
                {label}
              </OptionButton>
            ))}
          </div>

          {linkMode === "internal" && (
            <Select value={internalPath} onValueChange={pickInternal}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a page" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {groups
                  .filter((group) => group.options.length > 0)
                  .map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
              </SelectContent>
            </Select>
          )}

          {linkMode === "external" && (
            <div className="space-y-1.5">
              <Input
                type="url"
                placeholder="https://"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
              {linkInvalid && (
                <p className="text-xs text-destructive">
                  Enter a full link starting with https://
                </p>
              )}
            </div>
          )}

          {linkMode !== "none" && (
            <div className="space-y-1.5">
              <Label htmlFor="link-label" className="text-xs text-muted-foreground">
                Button text
              </Label>
              <Input
                id="link-label"
                placeholder={linkMode === "external" ? "e.g. Read more" : "e.g. View photos & videos"}
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Send className="size-4 text-primary" />
            Send to
          </Label>
          <div className="space-y-2">
            {audiences.map((option) => (
              <OptionButton
                key={option.value}
                active={audience === option.value}
                onClick={() => {
                  setAudience(option.value);
                  if (option.value === "all-devices") setSendEmail(false);
                }}
                className="flex w-full flex-col items-start text-left"
              >
                <span className="font-medium">{option.title}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {option.detail}
                </span>
              </OptionButton>
            ))}
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-gray-900">
                <BellRing className="size-4 text-gray-500" />
                Push notification
              </span>
              <Switch checked={sendPush} onCheckedChange={setSendPush} />
            </label>
            <label
              className={cn(
                "flex items-center justify-between gap-3 text-sm",
                !emailAllowed && "opacity-50",
              )}
            >
              <span className="flex items-center gap-2 font-medium text-gray-900">
                <Mail className="size-4 text-gray-500" />
                Email
                {!emailAllowed && (
                  <span className="font-normal text-muted-foreground">
                    (event audiences only)
                  </span>
                )}
              </span>
              <Switch
                checked={sendEmail && emailAllowed}
                onCheckedChange={setSendEmail}
                disabled={!emailAllowed}
              />
            </label>
            {sendEmail && emailAllowed && (
              <Input
                placeholder={`Email subject (default: “Update: ${event.title}”)`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Push only reaches people who turned on notifications on their
              device. Use email to reach everyone in the audience.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={openPreview} disabled={posting}>
            {posting ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            {posting
              ? "Posting..."
              : sendPush || (sendEmail && emailAllowed)
                ? "Preview & send"
                : "Preview & post"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Posted announcements</h3>
        {loading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : items.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <Megaphone className="size-6 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No announcements posted yet.</p>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    From the CSD Team
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                    {item.text}
                  </p>
                  {item.link_url && (
                    <p className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-medium text-primary">
                      {isInternalLink(item.link_url) ? (
                        <Link2 className="size-3.5 shrink-0" />
                      ) : (
                        <ArrowUpRight className="size-3.5 shrink-0" />
                      )}
                      <span className="truncate">
                        {item.link_label || "Link"} · {item.link_url}
                      </span>
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDate(item.created_at)} · {formatTime(item.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Send again with the “Send to” settings above"
                    title="Send again with the “Send to” settings above"
                    onClick={() => previewResend(item)}
                    disabled={sendingId === item.id}
                  >
                    {sendingId === item.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BellRing className="size-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete announcement"
                    className="text-destructive hover:bg-red-50 hover:text-destructive"
                    onClick={() => remove(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <AnnouncementPreviewDialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        draft={
          preview?.kind === "new"
            ? preview.draft
            : preview
              ? {
                  text: preview.item.text,
                  link_url: preview.item.link_url,
                  link_label: preview.item.link_label,
                }
              : null
        }
        eventId={event.id}
        eventTitle={event.title}
        push={sendPush}
        email={sendEmail && emailAllowed}
        subject={subject}
        recipients={describeSend()}
        confirmLabel={
          preview?.kind === "resend"
            ? "Send now"
            : describeSend()
              ? "Post & send"
              : "Post announcement"
        }
        busy={posting || sendingId !== null}
        onConfirm={() => {
          if (preview?.kind === "new") void post(preview.draft);
          else if (preview?.kind === "resend") void resend(preview.item);
        }}
      />
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-gray-200 text-gray-700 hover:bg-slate-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
