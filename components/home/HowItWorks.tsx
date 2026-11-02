import { ArrowUpRight, Mail } from "lucide-react";
import { DLU_EMAIL, DLU_SITE, HOW_IT_WORKS } from "@/lib/programmes";

/**
 * How attending works on the platform, plus a pointer to the DLU for
 * structures that want a programme of their own.
 */
export function HowItWorks() {
  return (
    <section className="border-t border-gray-200 bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C59B27]">
            How it works
          </span>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">
            From registration to the room
          </h2>
        </div>

        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title}>
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-medium text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-14 flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Want a programme for your structure?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              House Committees, student councils, clubs and societies can ask
              the DLU to design a development session around their needs.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center">
            <a
              href={`mailto:${DLU_EMAIL}`}
              className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
            >
              <Mail className="size-4" />
              {DLU_EMAIL}
            </a>
            <a
              href={DLU_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-gray-700 underline-offset-4 hover:text-primary hover:underline"
            >
              About the DLU
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
