export function SkeletonClientCard() {
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 dark:border-[#1A2540]/50 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-[#E3E6EC] dark:bg-[#1A2540] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-3/4" />
        <div className="h-3 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-1/2" />
      </div>
    </div>
  )
}

export function SkeletonDealRow() {
  return (
    <tr className="border-b border-[#E3E6EC] dark:border-[#1A2540] animate-pulse">
      <td className="px-4 py-4">
        <div className="h-4 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-3/4" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-1/2" />
      </td>
      <td className="px-4 py-4">
        <div className="h-6 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full w-20" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-2/4" />
      </td>
      <td className="px-4 py-4">
        <div className="h-8 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-16" />
      </td>
    </tr>
  )
}

export function SkeletonTaskRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-[#E3E6EC] dark:border-[#1A2540] animate-pulse">
      <div className="w-5 h-5 bg-[#E3E6EC] dark:bg-[#1A2540] rounded" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-3/4" />
        <div className="h-3 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-1/2" />
      </div>
      <div className="h-6 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-md w-20 flex-shrink-0" />
    </div>
  )
}

export function SkeletonPipelineStage() {
  return (
    <div className="space-y-3 min-w-96 animate-pulse">
      <div className="h-6 bg-[#E3E6EC] dark:bg-[#1A2540] rounded w-1/3" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-lg border border-[#E3E6EC] dark:border-[#1A2540]"
          />
        ))}
      </div>
    </div>
  )
}
