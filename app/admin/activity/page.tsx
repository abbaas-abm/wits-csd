import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { AdminActivity } from "@/components/admin/AdminActivity";

export const metadata: Metadata = { title: "Admin · Activity" };

export default async function AdminActivityPage() {
  const events = await getEvents();

  return (
    <div className="p-4 sm:p-6">
      <AdminActivity
        events={events.map((event) => ({ id: event.id, title: event.title }))}
      />
    </div>
  );
}
