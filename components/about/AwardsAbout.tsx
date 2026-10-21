import Image from "next/image";
import {
  Award,
  CalendarDays,
  Crown,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  Mail,
  Rocket,
  Trophy,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  AWARDS,
  AWARDS_ABOUT,
  AWARDS_CATEGORIES,
  AWARDS_ENQUIRIES,
  AWARDS_PHOTOS,
  AWARDS_THEMES,
} from "@/lib/awards";

const THEME_ICONS: LucideIcon[] = [
  GraduationCap,
  Users,
  Lightbulb,
  HeartHandshake,
  UsersRound,
  Rocket,
];

/**
 * About page section on the Wits Student Leadership Awards, using the
 * official information pack wording. Anchored at `#awards` so the homepage
 * can link straight to it.
 */
export function AwardsAbout() {
  const enquiriesHref = `mailto:${AWARDS_ENQUIRIES.email}?subject=${encodeURIComponent(AWARDS_ENQUIRIES.subject)}`;

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
              {AWARDS_ABOUT}
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
                #WitsForGood
              </span>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">
                Celebrating leadership in line with Wits values
              </h2>
              <div className="mt-5 space-y-4 text-base leading-relaxed text-gray-600">
                <p>
                  Nominees are students, student structures and community
                  engagement projects that have promoted the values of the
                  University, demonstrated exemplary leadership, and advanced
                  diversity, inclusiveness, social justice and transformation
                  in the student community.
                </p>
                <p>
                  Any registered Wits student could nominate themselves,
                  another student, an officially recognised student structure
                  or organisation, or a community engagement project.
                  Nominations for {AWARDS.year} closed on 30 September{" "}
                  {AWARDS.year}.
                </p>
                <p>
                  The ceremony takes place on {AWARDS.dateShort} and is by
                  invitation only. The highest honour of the evening is the{" "}
                  <span className="font-medium text-gray-900">
                    Vice-Chancellor&apos;s Student Leader of the Year
                  </span>
                  .
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
              Leadership themes
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
              The contribution of students is recognised under six themes.
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {AWARDS_THEMES.map((theme, i) => {
                const Icon = THEME_ICONS[i];
                return (
                  <Card key={theme.title} className="h-full border-gray-200 p-6">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-[#d9b45b]/15 text-[#a07a1c]">
                      <Icon className="size-5" />
                    </div>
                    <h4 className="mt-4 font-medium text-gray-900">
                      {theme.title}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {theme.text}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C59B27]">
              {AWARDS.year} awards
            </span>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">
              Award categories
            </h2>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-lg sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#d9b45b] text-primary">
                <Crown className="size-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9b45b]">
                  Highest honour
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                  Vice-Chancellor&apos;s Student Leader of the Year
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/80">
                  For a change-maker who has promoted equality and inclusivity
                  on campus, inspired student leadership, championed Wits
                  values and Graduate Attributes, and helped create and advance
                  global knowledge.
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AWARDS_CATEGORIES.map((category) => (
              <li
                key={category}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-900"
              >
                <Trophy className="mt-0.5 size-4 shrink-0 text-[#C59B27]" />
                {category}
              </li>
            ))}
          </ul>

          <p className="mt-10 text-sm text-gray-600">
            For enquiries, please email{" "}
            <a
              href={enquiriesHref}
              className="font-medium text-primary underline underline-offset-4"
            >
              {AWARDS_ENQUIRIES.email}
            </a>{" "}
            with the subject &ldquo;{AWARDS_ENQUIRIES.subject}&rdquo;.
          </p>
        </div>
      </section>
    </>
  );
}
