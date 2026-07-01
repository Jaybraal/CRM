import { SkeletonClientCard } from '@/components/ui/Skeleton'

export default function ClientsLoading() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left panel: contact list skeleton */}
      <div className="flex flex-col w-full lg:w-80 xl:w-96 bg-white dark:bg-[#0F1829] border-r border-[#E3E6EC] dark:border-[#1A2540] flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#F4F5F7] dark:bg-[#0F1829]/50 border-b border-[#E3E6EC] dark:border-[#1A2540]">
          <div className="flex items-center gap-2">
            <div className="h-5 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-12" />
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-9 h-9 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full" />
            <div className="w-9 h-9 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full" />
            <div className="w-9 h-9 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full" />
          </div>
        </div>

        {/* Search skeleton */}
        <div className="px-3 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540]">
          <div className="h-8 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540] overflow-x-auto scrollbar-none">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full w-16 flex-shrink-0" />
          ))}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonClientCard key={i} />
          ))}
        </div>
      </div>

      {/* Right panel: desktop only skeleton */}
      <div className="hidden lg:flex flex-col flex-1 min-w-0 min-h-0 bg-[#F4F5F7] dark:bg-[#0F1829] animate-pulse items-center justify-center">
        <div className="w-24 h-24 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full mb-5" />
        <div className="h-5 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-40 mb-3" />
        <div className="h-4 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-56" />
      </div>
    </div>
  )
}
