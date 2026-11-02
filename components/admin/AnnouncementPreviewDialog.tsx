"use client";

import * as React from "react";
import Image from "next/image";
import { BellRing, Loader2, Mail, Megaphone, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementBubble } from "@/components/events/EventAnnouncementsButton";
import { absoluteLink } from "@/lib/announcements";
import { renderAnnouncementHtml } from "@/lib/email/announcement-template";

export interface AnnouncementDraft {
  text: string;
  link_url: string | null;
  link_label: string | null;
}

/**
 * Shows an announcement exactly as people will get it (event page, push
 * notification, email) and who it goes to, before anything is posted or sent.
 */
export function AnnouncementPreviewDialog({
  open,
  onOpenChange,
  draft,
  eventId,
  eventTitle,
  push,
  email,
  subject,
  recipients,
  confirmLabel,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AnnouncementDraft | null;
  eventId: string;
  eventTitle: string;
  push: boolean;
  email: boolean;
  subject: string;
  /** e.g. "a push notification to 116 people's devices and an email to 1,131 people" */
  recipients: string | null;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  // Rendered once per draft; the iframe shows the real email markup.
  const emailHtml = React.useMemo(
    () =>
      draft
        ? renderAnnouncementHtml("[First name]", {
            text: draft.text,
            linkUrl: draft.link_url,
            linkLabel: draft.link_label,
            eventId,
            eventTitle,
          })
        : "",
    [draft, eventId, eventTitle],
  );
  // Stable "now" for the preview's timestamp.
  const [now] = React.useState(() => new Date().toISOString());

  if (!draft) return null;
  const tapTarget = absoluteLink(draft.link_url ?? `/events/${eventId}`);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preview announcement</DialogTitle>
          <DialogDescription>
            Check how it looks before {recipients ? "sending" : "posting"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-slate-50 p-3 text-sm text-gray-700">
          <Users className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            {recipients ? (
              <>
                Posts on the event page and sends{" "}
                <span className="font-medium text-gray-900">{recipients}</span>.
              </>
            ) : (
              <>Posts on the event page only. No notification or email is sent.</>
            )}
          </p>
        </div>

        <Tabs defaultValue="page" className="min-w-0">
          <TabsList>
            <TabsTrigger value="page">
              <Megaphone className="size-4" />
              Event page
            </TabsTrigger>
            {push && (
              <TabsTrigger value="push">
                <BellRing className="size-4" />
                Notification
              </TabsTrigger>
            )}
            {email && (
              <TabsTrigger value="email">
                <Mail className="size-4" />
                Email
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="page" className="pt-3">
            <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="bg-primary px-4 py-3 text-white">
                <p className="text-sm font-semibold">Announcements</p>
                <p className="text-xs text-white/70">From the CSD Team</p>
              </div>
              <div className="p-4">
                <AnnouncementBubble announcement={{ ...draft, created_at: now }} />
              </div>
            </div>
          </TabsContent>

          {push && (
            <TabsContent value="push" className="pt-3">
              <div className="mx-auto w-full max-w-sm rounded-2xl bg-slate-800 p-3 shadow-lg">
                <div className="rounded-xl bg-white/95 p-3">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <Image src="/icons/icon-192.png" alt="" width={16} height={16} className="rounded" />
                    <span>witscsd.co.za</span>
                    <span>· now</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-gray-900">{eventTitle}</p>
                  <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-sm text-gray-700">
                    {draft.text}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Tapping it opens <span className="break-all font-medium text-gray-700">{tapTarget}</span>.
                Long messages are cut short on most phones.
              </p>
            </TabsContent>
          )}

          {email && (
            <TabsContent value="email" className="space-y-2 pt-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Subject:</span>{" "}
                <span className="font-medium text-gray-900">
                  {subject.trim() || `Update: ${eventTitle}`}
                </span>
              </p>
              <iframe
                title="Email preview"
                srcDoc={emailHtml}
                sandbox=""
                className="h-[28rem] w-full rounded-lg border border-gray-200 bg-[#eef2f7]"
              />
              <p className="text-xs text-muted-foreground">
                “[First name]” is replaced with each person&apos;s first name.
              </p>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Back to editing
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
