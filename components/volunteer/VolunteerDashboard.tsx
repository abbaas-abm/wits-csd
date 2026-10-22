"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScannerPanel } from "@/components/volunteer/ScannerPanel";
import { HistoryPanel } from "@/components/volunteer/HistoryPanel";
import { QnaPanel } from "@/components/volunteer/QnaPanel";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function VolunteerDashboard({
  profile,
  volunteerId,
}: {
  profile: Profile;
  volunteerId: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

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
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-primary text-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="CSD home"
          >
            <Image
              src="/wits-logo-light.png"
              alt="University of the Witwatersrand"
              width={148}
              height={90}
              className="h-9 w-auto"
            />
          </Link>
          <div className="flex items-center gap-2">
            {/* /user sends admins on to /admin. */}
            <Button
              asChild
              size="sm"
              className="bg-white text-primary hover:bg-slate-100"
            >
              <Link href="/user">
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-4">
          <h1 className="text-xl font-semibold text-white">
            Support Team Portal
          </h1>
          <p className="text-sm text-white/70">
            Welcome{profile.first_name ? `, ${profile.first_name}` : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <Tabs defaultValue="scanner">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-white p-1.5 shadow-sm">
            <TabsTrigger value="scanner" className="flex-col gap-1 py-2 text-xs">
              <ScanLine className="size-4" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="qna" className="flex-col gap-1 py-2 text-xs">
              <MessageSquare className="size-4" />
              Q&amp;A
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-col gap-1 py-2 text-xs">
              <History className="size-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner">
            <ScannerPanel volunteerId={volunteerId} />
          </TabsContent>
          <TabsContent value="qna">
            <QnaPanel />
          </TabsContent>
          <TabsContent value="history">
            <HistoryPanel volunteerId={volunteerId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
