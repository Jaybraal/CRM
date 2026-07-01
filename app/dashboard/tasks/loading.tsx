import { SkeletonTaskRow } from '@/components/ui/Skeleton'

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-48" />
        <div className="h-4 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-72" />
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full w-24" />
        ))}
      </div>

      {/* Task list skeleton */}
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonTaskRow key={i} />
        ))}
      </div>
    </div>
  )
}
