import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroCountdown } from "@/components/home/HeroCountdown";
import { AWARDS, AWARDS_PHOTOS } from "@/lib/awards";
import { secondsUntil } from "@/lib/utils";

/**
 * Homepage hero for the 2026 Student Leadership Awards. Invite-only, so no
 * venue and no registration button.
 */
export function AwardsHero() {
  return (
    <section className="relative isolate flex min-h-[86vh] items-center overflow-hidden bg-primary">
      <Image
        src={AWARDS_PHOTOS.hero.src}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/75 via-primary/55 to-primary/95" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#d9b45b] to-transparent" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9b45b] text-balance sm:text-sm sm:tracking-[0.35em]">
          A Division of Student Affairs presents
        </p>

        <h1 className="mt-5 text-white">
          <span className="block bg-gradient-to-b from-[#f3dc9a] via-[#d9b45b] to-[#b8902f] bg-clip-text text-7xl font-bold leading-none tracking-tight text-transparent sm:text-8xl lg:text-9xl">
            {AWARDS.year}
          </span>
          <span className="mt-3 block text-3xl font-semibold leading-tight text-balance sm:text-5xl lg:text-6xl">
            {AWARDS.title}
          </span>
        </h1>

        <div className="mx-auto mt-8 flex max-w-xs items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d9b45b]" />
          <span className="size-2 rotate-45 bg-[#d9b45b]" />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d9b45b]" />
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm sm:text-base">
            <CalendarDays className="size-4 text-[#d9b45b]" />
            {AWARDS.dateLabel}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#d9b45b] px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary">
            <Mail className="size-4" />
            By invitation only
          </span>
        </div>

        <div className="mt-10 flex justify-center">
          <HeroCountdown initialSeconds={secondsUntil(AWARDS.date)} />
        </div>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-white text-primary hover:bg-slate-100"
          >
            <Link href="/about#awards">
              About the awards
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/user">
              <LogIn className="size-4" />
              Attendee access
            </Link>
          </Button>
        </div>

        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/75">
          Invited? Sign in to the platform to get your attendee tag, view the
          programme and everything you need on the night.
        </p>
      </div>
    </section>
  );
}
