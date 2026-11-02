import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PwaChrome } from "@/components/pwa/PwaChrome";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <PwaChrome />
      <main className="flex flex-1 flex-col pwa:pt-14 pwa:pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
