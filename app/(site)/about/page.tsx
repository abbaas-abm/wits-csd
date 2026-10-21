import type { Metadata } from "next";
import { AwardsAbout } from "@/components/about/AwardsAbout";

export const metadata: Metadata = { title: "About CSD" };
export const revalidate = 3600;

export default function AboutPage() {
  return <AwardsAbout />;
}
