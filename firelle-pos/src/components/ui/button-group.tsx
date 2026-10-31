"use client"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonGroupVariants = cva(
  "flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2",
  {
    variants: {
      orientation: {
        horizontal:
          "*:data-[slot]:data-[variant=outline]:not-first:rounded-l-none *:data-[slot]:data-[variant=outline]:not-last:rounded-r-none *:data-[slot]:data-[variant=outline]:not-last:border-r-0 [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-lg [&>[data-slot]:not(:has(~[data-slot]))]:border-r",
        vertical:
          "flex-col *:data-[slot]:data-[variant=outline]:not-first:rounded-t-none *:data-[slot]:data-[variant=outline]:not-last:rounded-b-none *:data-[slot]:data-[variant=outline]:not-last:border-b-0 [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-lg [&>[data-slot]:not(:has(~[data-slot]))]:border-b",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
)

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

function ButtonGroupText({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & { render?: React.ReactElement }) {
  return useRender({
    render,
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          className
        ),
      },
      props
    ),
  })
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical"
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      data-slot="button-group-separator"
      data-orientation={orientation}
      className={cn(
        "relative self-stretch bg-border data-[orientation=vertical]:w-px data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        className
      )}
      {...props}
    />
  )
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants }
