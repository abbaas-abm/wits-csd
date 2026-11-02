import Image from "next/image";
import {
  Award,
  Compass,
  GraduationCap,
  MessagesSquare,
  Rocket,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { FLAGSHIP, PROGRAMMES, type ProgrammeIcon } from "@/lib/programmes";

const ICONS: Record<ProgrammeIcon, LucideIcon> = {
  compass: Compass,
  messages: MessagesSquare,
  users: UsersRound,
  rocket: Rocket,
  sparkles: Sparkles,
  award: Award,
};

/**
 * The kinds of programmes the DLU hosts on the platform, led by the Emerging
 * Leaders Programme. Anchored at `#programmes` for the hero link.
 */
export function ProgrammeStrands() {
  return (
    <section id="programmes" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C59B27]">
            What we host
          </span>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">
            Programmes that grow leaders
          </h2>
          <p className="mt-3 text-base leading-relaxed text-gray-600">
            Every event on this platform belongs to one of the programme
            areas below. Look out for them in the events calendar.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl bg-primary text-white shadow-lg">
          <div className="grid lg:grid-cols-5">
            <div className="relative min-h-56 lg:col-span-2">
              <Image
                src="/dlu.jpg"
                alt="Students taking part in a DLU leadership programme"
                fill
                sizes="(max-width: 1024px) 100vw, 480px"
                className="object-cover"
              />
            </div>
            <div className="p-6 sm:p-8 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9b45b]">
                {FLAGSHIP.eyebrow}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                {FLAGSHIP.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                {FLAGSHIP.text}
              </p>
              <ol className="mt-6 grid gap-4 sm:grid-cols-3">
                {FLAGSHIP.stages.map((stage, i) => (
                  <li key={stage.title} className="border-l-2 border-[#d9b45b] pl-3">
                    <span className="text-xs font-semibold text-[#d9b45b]">
                      0{i + 1}
                    </span>
                    <p className="mt-0.5 text-sm font-medium text-white">
                      {stage.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/70">
                      {stage.text}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white">
                <GraduationCap className="size-4 text-[#d9b45b]" />
                {FLAGSHIP.outcome}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMMES.map((programme) => {
            const Icon = ICONS[programme.icon];
            return (
              <Card key={programme.title} className="h-full border-gray-200 p-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[#d9b45b]/15 text-[#a07a1c]">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-medium text-gray-900">
                  {programme.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {programme.text}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {programme.formats.map((format) => (
                    <li
                      key={format}
                      className="rounded-full border border-gray-200 bg-slate-50 px-2.5 py-1 text-xs text-gray-700"
                    >
                      {format}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
