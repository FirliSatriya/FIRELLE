import { cn } from "@/lib/utils"

/**
 * Warm skeleton placeholder.
 * Uses the `.skeleton` shimmer defined in globals.css so every module
 * automatically inherits the earth-tone loading state.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton h-4 w-full", className)}
      {...props}
    />
  )
}

export { Skeleton }
