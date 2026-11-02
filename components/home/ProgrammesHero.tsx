import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Homepage hero for the DLU's general programmes and events. Matches the
 * About page hero so the two read as one site.
 */
export function ProgrammesHero() {
  return (
    <section className="relative isolate overflow-hidden bg-primary text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9b45b]">
            Development and Leadership Unit
          </span>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-balance text-white sm:text-4xl lg:text-5xl">
            Programmes and events for Wits change-makers
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            Leadership workshops, critical engagements, entrepreneurship
            sessions and more, open to students across all faculties. Find
            what&apos;s coming up and reserve your seat.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-[#d9b45b] text-primary hover:bg-[#e6c677]"
            >
              <Link href="/events">
                <CalendarDays className="size-4" />
                Browse events
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="#programmes">
                What we host
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/15 shadow-2xl lg:justify-self-end">
          <Image
            src="/stage-speaker.JPG"
            alt="A speaker addressing students at a DLU event"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 600px"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
