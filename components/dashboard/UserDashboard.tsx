"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, HeartHandshake, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfilePanel } from "./ProfilePanel";
import { MyEventsPanel } from "./MyEventsPanel";
import type { Profile } from "@/lib/types";
import type { RegistrationWithEvent } from "@/lib/data";

export function UserDashboard({
  profile,
  registrations,
}: {
  profile: Profile;
  registrations: RegistrationWithEvent[];
}) {
  const [tab, setTab] = React.useState("events");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {profile.role === "volunteer" && (
        <div className="mb-5 flex justify-end">
          <Button asChild>
            <Link href="/volunteer">
              <HeartHandshake className="size-4" />
              Support Team Portal
            </Link>
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-white p-1.5 shadow-sm">
          <TabsTrigger value="events">
            <CalendarCheck className="size-4" />
            My Events
          </TabsTrigger>
          <TabsTrigger value="profile">
            <UserRound className="size-4" />
            Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <MyEventsPanel registrations={registrations} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfilePanel profile={profile} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
