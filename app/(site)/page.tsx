import { ProgrammesHero } from "@/components/home/ProgrammesHero";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { ProgrammeStrands } from "@/components/home/ProgrammeStrands";
import { HowItWorks } from "@/components/home/HowItWorks";

export const revalidate = 60;

export default function HomePage() {
  return (
    <div className="pwa:hidden">
      <ProgrammesHero />
      <UpcomingEvents />
      <ProgrammeStrands />
      <HowItWorks />
    </div>
  );
}
