import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive/25 bg-destructive/12 text-destructive dark:bg-destructive/20 dark:text-destructive dark:border-destructive/30 font-medium",
        warning:
          "border-warning/25 bg-warning/12 text-warning-foreground dark:text-warning dark:bg-warning/20 dark:border-warning/30 font-medium",
        success:
          "border-success/25 bg-success/12 text-success-foreground dark:text-success dark:bg-success/20 dark:border-success/30 font-medium",
        info:
          "border-info/25 bg-info/12 text-info-foreground dark:text-info dark:bg-info/20 dark:border-info/30 font-medium",
        outline:
          "border-border text-foreground bg-transparent",
        muted:
          "border-border bg-muted text-muted-foreground",
        ghost:
          "border-transparent hover:bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
