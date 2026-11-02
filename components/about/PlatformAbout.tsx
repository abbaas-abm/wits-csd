import Image from "next/image";
import {
  CalendarDays,
  MessagesSquare,
  PenLine,
  QrCode,
  Star,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  APPROACHES,
  PLATFORM_FEATURES,
  THEMES,
  type FeatureIcon,
} from "@/lib/programmes";

const FEATURE_ICONS: Record<FeatureIcon, LucideIcon> = {
  calendar: CalendarDays,
  ticket: Ticket,
  qr: QrCode,
  messages: MessagesSquare,
  pen: PenLine,
  star: Star,
};

/**
 * Top of the About page: what this platform is, how DLU programmes are put
 * together, and what attendees can do on it. Unit background lives on the
 * official DLU site, not here.
 */
export function PlatformAbout() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-primary text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9b45b]">
              About this platform
            </span>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-balance text-white sm:text-4xl lg:text-5xl">
              The home of DLU programmes and events
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              Run by the Development and Leadership Unit in the Centre for
              Student Development, Division of Student Affairs. This is where
              Wits students find, register for and take part in our
              programmes.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 text-sm sm:text-base">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white">
                Open to students across all faculties
              </span>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/15 shadow-2xl lg:justify-self-end">
            <Image
              src="/img-about-1.jpg"
              alt="Wits students at a DLU event"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C59B27]">
              Our approach
            </span>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">
              How our programmes are built
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-600">
              Every DLU programme is designed for students who want to grow
              personally, socially and professionally, and is built in one of
              three ways.
            </p>
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-900">
                Ideas our programmes explore
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {THEMES.map((theme) => (
                  <li
                    key={theme}
                    className="rounded-full bg-[#d9b45b]/15 px-3 py-1.5 text-sm font-medium text-[#7a5c12]"
                  >
                    {theme}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ol className="space-y-3">
            {APPROACHES.map((approach, i) => (
              <li
                key={approach.title}
                className="flex gap-4 rounded-xl border border-gray-200 p-5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium text-gray-900">{approach.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">
                    {approach.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C59B27]">
              On the platform
            </span>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">
              Everything for the day, in one place
            </h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_FEATURES.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon];
              return (
                <Card key={feature.title} className="h-full border-gray-200 p-6">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-medium text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {feature.text}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
