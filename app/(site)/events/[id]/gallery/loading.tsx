import { Skeleton } from "@/components/ui/skeleton";

const HEIGHTS = ["h-48", "h-64", "h-56", "h-72", "h-52", "h-60", "h-48", "h-64"];

export default function Loading() {
  return (
    <div className="w-full bg-white pb-16">
      <Skeleton className="h-[60vh] w-full rounded-none sm:h-[70vh]" />
      <div className="mx-auto max-w-[1600px] px-2 pt-8 sm:px-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-full" />
          ))}
        </div>
        <div className="mt-4 columns-2 gap-2 sm:columns-3 lg:columns-4">
          {HEIGHTS.map((height, i) => (
            <Skeleton key={i} className={`mb-2 w-full rounded-none ${height}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
