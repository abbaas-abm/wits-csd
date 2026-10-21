import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AWARDS_PHOTOS } from "@/lib/awards";

const TILES = [
  { ...AWARDS_PHOTOS.cheque, className: "sm:col-span-2 sm:row-span-2" },
  { ...AWARDS_PHOTOS.society, className: "" },
  { ...AWARDS_PHOTOS.trophy, className: "" },
  { ...AWARDS_PHOTOS.team, className: "" },
  { ...AWARDS_PHOTOS.handshake, className: "" },
];

/** Homepage photo mosaic from past Student Leadership Awards ceremonies. */
export function AwardsGallery() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C59B27]">
              Celebrating excellence
            </p>
            <h2 className="mt-2 text-2xl font-semibold leading-snug text-gray-900 sm:text-3xl">
              Honouring the students who lead Wits
            </h2>
            <p className="mt-3 text-base leading-relaxed text-gray-600">
              Every year the Student Leadership Awards recognise students whose
              leadership, service, innovation and social impact give meaning to
              the idea of #WitsForGood, on campus and in communities beyond the
              University. Some moments from past ceremonies.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/about#awards">
              Learn more
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-10 grid auto-rows-[200px] gap-3 sm:grid-cols-4 sm:gap-4 lg:auto-rows-[240px]">
          {TILES.map((tile) => (
            <div
              key={tile.src}
              className={`group relative overflow-hidden rounded-2xl bg-slate-100 ${tile.className}`}
            >
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
