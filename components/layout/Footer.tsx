import Link from "next/link";
import Image from "next/image";
import { Clock, Mail, Phone } from "lucide-react";

const QUICK_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-slate-50 pwa:hidden">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <Image
            src="/wits-logo-white.png"
            alt="University of the Witwatersrand"
            width={150}
            height={42}
            className="h-9 w-auto"
          />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-600">
            This platform is managed by the Development and Leadership Unit,
            Centre for Student Development, a Division of Student Affairs.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">Quick Links</h3>
          <ul className="mt-3 space-y-2.5 text-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-gray-600 transition-colors hover:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">Contact</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-gray-600">
            <li className="flex items-center gap-2.5">
              <Mail className="size-4 shrink-0 text-gray-400" />
              <a
                href="mailto:ask.wits@wits.ac.za"
                className="hover:text-primary"
              >
                ask.wits@wits.ac.za
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-gray-400" />
              <span>+27 (0) 11 717 1888</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="size-4 shrink-0 text-gray-400" />
              <span>Mon – Fri, 08:00 – 16:30 SAST</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-gray-500 sm:flex-row sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} Centre for Student Development,
            University of the Witwatersrand.
          </p>
          <p>Nurturing purpose, leadership &amp; student success.</p>
        </div>
      </div>
    </footer>
  );
}
