import type { Metadata } from "next";
import { PlatformAbout } from "@/components/about/PlatformAbout";
import { AwardsAbout } from "@/components/about/AwardsAbout";
import { AboutContact } from "@/components/about/AboutContact";

export const metadata: Metadata = { title: "About" };
export const revalidate = 3600;

export default function AboutPage() {
  return (
    <>
      <PlatformAbout />
      <AwardsAbout />
      <AboutContact />
    </>
  );
}
