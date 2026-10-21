import Image from "next/image";
import {
  Award,
  CalendarDays,
  Crown,
  HeartHandshake,
  Mail,
  Megaphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { AWARDS, AWARDS_PHOTOS } from "@/lib/awards";

const RECOGNISES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Crown,
    title: "Individual leadership",
    text: "Students who lead with integrity and lift others up, culminating in the Vice-Chancellor's Student Leader of the Year.",
  },
  {
    icon: Users,
    title: "Structures & societies",
    text: "SRC, house committees, faculty councils, clubs and societies whose collective work strengthens the Wits community.",
  },
  {
    icon: HeartHandshake,
    title: "Service & citizenship",
    text: "Volunteers and community builders whose outreach makes a lasting difference beyond the campus walls.",
  },
  {
    icon: Megaphone,
    title: "Governance & advocacy",
    text: "Leaders who champion student voices through accountable, democratic and inclusive representation.",
  },
];

/**
 * About page section on the Wits Student Leadership Awards. Anchored at
 * `#awards` so the homepage can link straight to it.
 */
export function AwardsAbout() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-primary text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9b45b]">
              About the awards
            </span>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-balance text-white sm:text-4xl lg:text-5xl">
              The Wits Student Leadership Awards
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              Hosted by the Centre for Student Development, the Student
              Leadership Awards are the University&apos;s annual celebration of
              the students who lead, serve and inspire. They honour the
              individuals and student structures whose commitment shapes a
              vibrant, inclusive and engaged Wits.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 text-sm sm:text-base">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white">
                <CalendarDays className="size-4 text-[#d9b45b]" />
                {AWARDS.dateLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#d9b45b] px-4 py-2 font-semibold text-primary">
                <Mail className="size-4" />
                By invitation only
              </span>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/15 shadow-2xl lg:justify-self-end">
            <Image
              src={AWARDS_PHOTOS.cheque.src}
              alt={AWARDS_PHOTOS.cheque.alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section id="awards" className="scroll-mt-20 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C59B27]">
                Why we celebrate
              </span>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">
                Leadership that leaves a legacy
              </h2>
              <div className="mt-5 space-y-4 text-base leading-relaxed text-gray-600">
                <p>
                  Student leaders carry much of what makes Wits a community:
                  they represent their peers, run societies and residences,
                  mentor first-years and reach out to the communities around
                  the University — often while balancing demanding studies.
                </p>
                <p>
                  The awards evening brings these leaders together with
                  University leadership, staff and guests to recognise their
                  contribution, share their stories and inspire the next
                  generation of leaders. The highest honour of the night is
                  the{" "}
                  <span className="font-medium text-gray-900">
                    Vice-Chancellor&apos;s Student Leader of the Year
                  </span>
                  .
                </p>
                <p>
                  The {AWARDS.year} ceremony takes place on{" "}
                  {AWARDS.dateShort}. Attendance is by
                  invitation only — nominees and guests will receive their
                  invitation and event details directly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="relative col-span-2 aspect-[16/9] overflow-hidden rounded-2xl">
                <Image
                  src={AWARDS_PHOTOS.winners.src}
                  alt={AWARDS_PHOTOS.winners.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 600px"
                  className="object-cover"
                />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image
                  src={AWARDS_PHOTOS.certificate.src}
                  alt={AWARDS_PHOTOS.certificate.alt}
                  fill
                  sizes="(max-width: 1024px) 50vw, 300px"
                  className="object-cover"
                />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image
                  src={AWARDS_PHOTOS.society.src}
                  alt={AWARDS_PHOTOS.society.alt}
                  fill
                  sizes="(max-width: 1024px) 50vw, 300px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          <div className="mt-16">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Award className="size-5 text-[#C59B27]" />
              What the awards recognise
            </h3>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {RECOGNISES.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="h-full border-gray-200 p-6">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-[#d9b45b]/15 text-[#a07a1c]">
                      <Icon className="size-5" />
                    </div>
                    <h4 className="mt-4 font-medium text-gray-900">
                      {item.title}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {item.text}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
