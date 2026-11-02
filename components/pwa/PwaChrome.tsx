"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, LayoutDashboard, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { logAuthActivity } from "@/lib/activity";

const NAV_ITEMS = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/user", label: "Dashboard", icon: LayoutDashboard },
];

/**
 * App-only chrome. Rendered on every public page but hidden unless the site is
 * running as an installed PWA (`data-pwa="true"` on <html>, set before paint).
 * On the normal website it is completely invisible.
 */
export function PwaChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [name, setName] = React.useState("");

  // In the installed app the dashboard is home, so bounce "/" to it.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    if (standalone && window.location.pathname === "/") {
      router.replace("/app");
    }
  }, [router]);

  const loadProfile = React.useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setName("");
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>();
    setProfile(data ?? null);
    const full = [data?.first_name, data?.last_name].filter(Boolean).join(" ");
    setName(full || data?.email || "");
  }, []);

  React.useEffect(() => {
    queueMicrotask(() => {
      void loadProfile();
    });
    const supabase = createClient();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });
    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  async function handleSignOut() {
    const supabase = createClient();
    // Log first: the session is needed to know who signed out.
    logAuthActivity("signed_out");
    await supabase.auth.signOut();
    toast.success("Signed out.");
    // Hard redirect straight to the auth screen so the (now empty) dashboard
    // is never shown again.
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 hidden h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 pwa:flex">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(profile?.first_name ?? "", profile?.last_name ?? "")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {name || "Wits CSD"}
            </p>
            <p className="truncate text-xs text-muted-foreground">Wits CSD</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="rounded-full p-2 text-gray-500 transition-colors hover:bg-slate-100 hover:text-gray-900"
        >
          <LogOut className="size-5" />
        </button>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] pwa:flex">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-gray-400 hover:text-gray-600",
              )}
            >
              <Icon className={cn("size-5", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
