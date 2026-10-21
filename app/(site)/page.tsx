import { AwardsHero } from "@/components/home/AwardsHero";
import { AwardsGallery } from "@/components/home/AwardsGallery";

export const revalidate = 60;

export default function HomePage() {
  return (
    <div className="pwa:hidden">
      <AwardsHero />
      <AwardsGallery />
    </div>
  );
}
