import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[76vh] items-center justify-center overflow-hidden">
      <Image
        src="/wits-hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-primary/85" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
        <Image
          src="/wits-logo-light.png"
          alt="University of the Witwatersrand"
          width={164}
          height={100}
          priority
          className="mx-auto h-12 w-auto sm:h-14"
        />

        <h1 className="mt-8 text-3xl font-semibold leading-tight text-balance text-white sm:text-5xl">
          Nurturing purpose, leadership &amp; student success at Wits
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
          The Centre for Student Development integrates leadership, civic
          engagement, governance and persistence support to create empowered,
          well-rounded graduates.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-white text-primary hover:bg-slate-100"
          >
            <Link href="/events">
              Explore events &amp; Register now
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/about">Discover our 4 core units</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
