import { SkeletonPipelineStage } from '@/components/ui/Skeleton'

export default function PipelineLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-48" />
        <div className="h-4 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-80" />
      </div>

      {/* Controls skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-24" />
          ))}
        </div>
        <div className="h-9 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-md w-28" />
      </div>

      {/* Pipeline stages skeleton (kanban board) */}
      <div className="flex gap-6 overflow-x-auto pb-4 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonPipelineStage key={i} />
        ))}
      </div>
    </div>
  )
}
