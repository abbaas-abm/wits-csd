"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  FileSignature,
  FileText,
  LogOut,
  MessageSquare,
  StickyNote,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/admin/profile", label: "Profile", icon: User },
  { href: "/admin/people", label: "Users", icon: Users },
  { href: "/admin/residence", label: "Residence", icon: Building2 },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/reflections", label: "Reflections", icon: StickyNote },
  { href: "/admin/pledges", label: "Pledges", icon: FileSignature },
  { href: "/admin/questions", label: "Questions", icon: MessageSquare },
];

export function AdminShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const activeItem =
    NAV_ITEMS.find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? NAV_ITEMS[0];

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SidebarProvider className="bg-slate-50">
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-14 justify-center px-3">
          <Link
            href="/"
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
          >
            <Image
              src="/wits-logo-light.png"
              alt="Wits University"
              width={148}
              height={90}
              className="h-9 w-auto group-data-[collapsible=icon]:hidden"
            />
            <span className="sr-only">CSD Admin</span>
          </Link>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeItem.href === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={isActive}
                    >
                      <Link href={item.href}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleSignOut}
                disabled={signingOut}
                tooltip="Sign out"
              >
                <LogOut className="size-4" />
                <span>{signingOut ? "Signing out..." : "Sign out"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-slate-50">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div className="h-5 w-px bg-gray-200" />
            <h1 className="text-base font-semibold text-gray-900">
              {activeItem.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-900">
                {[profile.first_name, profile.last_name]
                  .filter(Boolean)
                  .join(" ") || profile.email}
              </p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {initials(profile.first_name, profile.last_name)}
            </span>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
