import { ArrowUpRight, AtSign, Mail, MapPin, Phone } from "lucide-react";
import { DLU_CONTACT, DLU_EMAIL, DLU_SITE } from "@/lib/programmes";

/** Closing strip on the About page: where to find and reach the DLU. */
export function AboutContact() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 rounded-2xl bg-primary p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-md">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">
              Get in touch with the DLU
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Questions about a programme, or want one for your structure? Our
              team is happy to help.
            </p>
            <a
              href={DLU_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#d9b45b] underline-offset-4 hover:underline"
            >
              More about the DLU on wits.ac.za
              <ArrowUpRight className="size-4" />
            </a>
          </div>

          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            <li className="flex items-start gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-[#d9b45b]" />
              <a href={`mailto:${DLU_EMAIL}`} className="hover:underline">
                {DLU_EMAIL}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-[#d9b45b]" />
              {DLU_CONTACT.phone}
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[#d9b45b]" />
              {DLU_CONTACT.office}
            </li>
            <li className="flex items-start gap-2.5">
              <AtSign className="mt-0.5 size-4 shrink-0 text-[#d9b45b]" />
              <a
                href={DLU_CONTACT.instagram.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {DLU_CONTACT.instagram.handle}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
