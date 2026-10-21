import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileSignature,
  ImageOff,
  MapPin,
  MessageSquare,
  Star,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RegisterButton } from "@/components/events/RegisterButton";
import { EventCountdown } from "@/components/events/EventCountdown";
import { ExpandableSection } from "@/components/events/ExpandableSection";
import { EventProgramme } from "@/components/events/EventProgramme";
import { EventSpeakers } from "@/components/events/EventSpeakers";
import { EventFeatured } from "@/components/events/EventFeatured";
import { EventSideTabs } from "@/components/events/EventSideTabs";
import { EventAnnouncementsButton } from "@/components/events/EventAnnouncementsButton";
import { SectionPlaceholder } from "@/components/events/SectionPlaceholder";
import { getCurrentUser } from "@/lib/auth";
import {
  getEventById,
  getCachedEventProgram,
  getCachedSpeakersByEvent,
  getEventAnnouncements,
  getCachedEventFeatured,
} from "@/lib/data";
import { cn, formatDate, formatTime, secondsUntil } from "@/lib/utils";
import { sanitizeHtml, hasMarkup, richTextToPlain } from "@/lib/rich-text";
import type { RegistrationStatus } from "@/lib/types";

// This page shows per-user registration state, live event data, and the
// preference-driven action set, so it must stay dynamic (never cached).
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function EventDetailPage(
  props: PageProps<"/events/[id]">,
) {
  const { id } = await props.params;
  const [
    // The event row carries the visibility/preference flags that staff toggle
    // during the event, so it is fetched uncached — never served stale.
    event,
    program,
    eventSpeakers,
    announcements,
    featured,
    { supabase, user, profile },
  ] = await Promise.all([
    getEventById(id),
    getCachedEventProgram(id),
    getCachedSpeakersByEvent(id),
    getEventAnnouncements(id),
    getCachedEventFeatured(id),
    getCurrentUser(),
  ]);

  if (!event) notFound();

  let myStatus: RegistrationStatus | null = null;
  if (supabase && user) {
    const { data } = await supabase
      .from("registrations")
      .select("status")
      .eq("event_id", id)
      .eq("attendee_id", user.id)
      .maybeSingle();
    myStatus = (data?.status as RegistrationStatus) ?? null;
  }

  const eventOpen = event.status === "OPEN";
  // Attendee-only actions (reflections, pledges, feedback) require a confirmed
  // registration for this event, regardless of the event's preferences.
  const isRegistered = myStatus === "CONFIRMED";
  const speakers = Array.from(
    new Map(
      [...eventSpeakers, ...program.flatMap((block) => block.speakers)].map(
        (speaker) => [speaker.id, speaker],
      ),
    ).values(),
  ).sort((a, b) => {
    const aOrder = a.speaker_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.speaker_order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.created_at.localeCompare(b.created_at);
  });

  // Section content, rendered both in the page column and inside the fixed
  // side-tab panel.
  const featuredSection =
    event.has_featured && featured.length > 0 ? (
      <EventFeatured items={featured} />
    ) : (
      <SectionPlaceholder
        title="Featured"
        message="The event organizers are still working on this."
      />
    );

  const aboutSection = event.has_about ? (
    <Card className="border-gray-200 p-6 sm:p-8">
      {event.about ? (
        <ExpandableSection
          enabled={richTextToPlain(event.about).length > 400}
        >
          {hasMarkup(event.about) ? (
            <div
              className="prose prose-slate max-w-none text-gray-600 prose-headings:text-gray-900 prose-headings:font-semibold prose-a:text-primary prose-strong:text-gray-900 prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 prose-blockquote:border-l-primary prose-blockquote:text-gray-500 prose-code:text-primary"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(event.about),
              }}
            />
          ) : (
            <p className="whitespace-pre-line text-base leading-relaxed text-gray-600">
              {event.about}
            </p>
          )}
        </ExpandableSection>
      ) : (
        <p className="text-sm text-gray-500">
          Full event details will be published shortly.
        </p>
      )}
    </Card>
  ) : (
    <SectionPlaceholder title="About this event" />
  );

  const programmeSection = event.has_programme ? (
    <Card className="border-gray-200 p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-gray-900">
        Programme &amp; agenda
      </h2>
      {program.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          The programme for this event is being finalised.
        </p>
      ) : (
        <EventProgramme program={program} isAuthenticated={Boolean(user)} />
      )}
    </Card>
  ) : (
    <SectionPlaceholder title="Programme &amp; agenda" />
  );

  // Private speakers are hidden entirely rather than shown as a placeholder.
  const speakersSection =
    event.has_speakers && speakers.length > 0 ? (
      <EventSpeakers speakers={speakers} />
    ) : null;

  return (
    <div className="w-full overflow-x-hidden bg-white pb-16">
      <EventAnnouncementsButton announcements={announcements} />
      {event.has_information && (
        <EventCountdown
          initialSeconds={secondsUntil(event.start_date)}
          compact
          className="lg:hidden"
        />
      )}
      <section className="relative w-full bg-slate-900">
        <div className="relative mx-auto aspect-[4/3] max-h-[560px] w-full overflow-hidden sm:aspect-[5/2]">
          {event.has_media && event.cover_image_url ? (
            <Image
              src={event.cover_image_url}
              alt={event.title}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-200 text-gray-400">
              <ImageOff className="size-10" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Media coming soon
              </span>
            </div>
          )}

          {/* Deep blue overlay — light enough to keep the image visible */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/40 to-primary/15" />

          <Link
            href="/events"
            className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-sm font-medium text-white shadow-sm backdrop-blur transition-colors hover:bg-white/25 sm:right-6 sm:top-6"
          >
            <ArrowLeft className="size-4" />
            Back to events
          </Link>

          <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5 sm:px-6 sm:pb-8 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                {event.mode === "ONLINE" ? (
                  <>
                    <Video className="size-3" /> Online
                  </>
                ) : (
                  <>
                    <MapPin className="size-3" /> In Person
                  </>
                )}
              </span>

              <h1 className="mt-2 max-w-3xl break-words text-2xl font-semibold leading-tight text-white sm:text-4xl">
                {event.title}
              </h1>

              {event.theme && (
                <p className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-[#d9b45b] sm:text-sm">
                  {event.theme}
                </p>
              )}

              {event.has_information && (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-white/85 sm:text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-[#d9b45b]" />
                    <span>
                      <span className="font-medium text-white">Starts</span>{" "}
                      {formatDate(event.start_date)} ·{" "}
                      {formatTime(event.start_date)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-[#d9b45b]" />
                    <span>
                      <span className="font-medium text-white">Ends</span>{" "}
                      {formatDate(event.end_date)} · {formatTime(event.end_date)}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-[#d9b45b]" />
                    <span>
                      <span className="font-medium text-white">Venue</span>{" "}
                      {event.mode === "ONLINE"
                        ? "Online"
                        : (event.venue ?? "Wits Campus")}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6 lg:order-1">
            {featuredSection}
            {aboutSection}
            {programmeSection}
            {speakersSection}
          </div>

          <aside className="order-first min-w-0 space-y-6 lg:order-2 lg:sticky lg:top-20 lg:h-fit">
            {event.has_information && (
              <div className="hidden lg:block">
                <EventCountdown
                  initialSeconds={secondsUntil(event.start_date)}
                />
              </div>
            )}
            <Card
              className={cn(
                "border-gray-200 p-6",
                // On mobile the cover already shows the details, so registered
                // attendees don't need this block. Desktop always shows it.
                isRegistered && "hidden lg:block",
              )}
            >
              <h2 className="text-lg font-semibold text-gray-900">
                Event details
              </h2>
              {event.has_information ? (
                <div className="mt-5 space-y-4 text-sm">
                  <DetailRow icon={CalendarDays} label="Starts">
                    {formatDate(event.start_date, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    · {formatTime(event.start_date)}
                  </DetailRow>
                  <Separator />
                  <DetailRow icon={CalendarDays} label="Ends">
                    {formatDate(event.end_date, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    · {formatTime(event.end_date)}
                  </DetailRow>
                  <Separator />
                  <DetailRow icon={MapPin} label="Venue">
                    {event.mode === "ONLINE"
                      ? "Online (link shared on registration)"
                      : (event.venue ?? "Wits Campus")}
                  </DetailRow>
                </div>
              ) : (
                <p className="mt-5 text-sm leading-relaxed text-gray-500">
                  The event organizers are still confirming these details.
                  Please check back soon.
                </p>
              )}

              <div className="mt-6">
                <RegisterButton
                  eventId={event.id}
                  isAuthenticated={Boolean(user)}
                  initialStatus={myStatus}
                  eventStatus={event.status}
                  profilePosition={profile?.position ?? null}
                  className="w-full"
                />
                {!user && eventOpen && (
                  <p className="mt-3 text-center text-xs text-gray-500">
                    You will be asked to sign in with your email.
                  </p>
                )}
                {myStatus === "CONFIRMED" && (
                  <p className="mt-3 text-center text-xs font-medium text-emerald-600">
                    Your seat is confirmed. Show your attendee tag at the door.
                  </p>
                )}

                {event.has_reflections && isRegistered && (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="mt-3 w-full"
                  >
                    <Link
                      href={
                        user
                          ? `/reflections?event=${event.id}`
                          : `/login?redirectTo=${encodeURIComponent(
                              `/reflections?event=${event.id}`,
                            )}`
                      }
                    >
                      Reflections
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}

                {event.has_questions && isRegistered && (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="mt-3 w-full"
                  >
                    <Link
                      href={
                        user
                          ? `/events/${event.id}/questions`
                          : `/login?redirectTo=${encodeURIComponent(
                              `/events/${event.id}/questions`,
                            )}`
                      }
                    >
                      Q&amp;A
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}

                {event.has_pledges && isRegistered && (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="mt-3 w-full"
                  >
                    <Link
                      href={
                        user
                          ? `/pledges/${event.id}`
                          : `/login?redirectTo=${encodeURIComponent(
                              `/pledges/${event.id}`,
                            )}`
                      }
                    >
                      Pledge
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}

                {event.has_feedback && isRegistered && (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="mt-3 w-full"
                  >
                    <Link href={`/feedback/${event.id}`}>
                      Feedback
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </Card>

            {isRegistered &&
              (event.has_reflections ||
                event.has_pledges ||
                event.has_feedback ||
                event.has_questions) && (
                <Card className="border-gray-200 p-5 lg:hidden">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Actions
                  </h2>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {event.has_reflections && (
                      <ActionButton
                        href={`/reflections?event=${event.id}`}
                        icon={MessageSquare}
                        label="Reflections"
                      />
                    )}
                    {event.has_questions && (
                      <ActionButton
                        href={`/events/${event.id}/questions`}
                        icon={MessageSquare}
                        label="Q&A"
                      />
                    )}
                    {event.has_pledges && (
                      <ActionButton
                        href={`/pledges/${event.id}`}
                        icon={FileSignature}
                        label="Pledge"
                      />
                    )}
                    {event.has_feedback && (
                      <ActionButton
                        href={`/feedback/${event.id}`}
                        icon={Star}
                        label="Feedback"
                      />
                    )}
                  </div>
                </Card>
              )}
          </aside>
        </div>
      </div>

      {event.has_side_notch && (
        <EventSideTabs
          enabled={{
            about: event.has_about,
            programme: event.has_programme,
            speakers: event.has_speakers,
            featured: event.has_featured,
          }}
          about={event.about}
          program={program}
          speakers={speakers}
          featured={featured}
          isAuthenticated={Boolean(user)}
          eventId={event.id}
        />
      )}
    </div>
  );
}

function ActionButton({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="flex h-auto w-full flex-col items-center gap-2 rounded-lg py-3.5 text-xs font-medium"
    >
      <Link href={href}>
        <Icon className="size-5 text-primary" />
        {label}
      </Link>
    </Button>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="mt-0.5 break-words text-gray-700">{children}</p>
      </div>
    </div>
  );
}
