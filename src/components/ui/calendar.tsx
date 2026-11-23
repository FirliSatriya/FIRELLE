"use client"

import * as React from "react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { cn } from "@/lib/utils"

export type CalendarProps = DayPickerProps

/**
 * shadcn Base UI calendar ("basic" example) styled with the project tokens.
 *
 * Uses the default single caption (no dropdown) — the dropdown layout renders
 * a second caption element that duplicates the month/year text.
 */
function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      data-slot="calendar"
      showOutsideDays
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-3 sm:flex-row",
        month: "flex w-full flex-col gap-3",
        month_caption: "flex h-9 items-center justify-center px-8",
        caption_label: "text-sm font-semibold text-foreground",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between px-1",
        button_previous:
          "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        button_next:
          "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "size-9 p-0 text-center text-sm",
        day_button:
          "inline-flex size-9 items-center justify-center rounded-md text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40",
        selected:
          "[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:hover:bg-primary/90",
        today: "[&_button]:font-semibold [&_button]:text-primary",
        outside: "[&_button]:text-muted-foreground/50",
        disabled: "[&_button]:text-muted-foreground/40",
        range_start: "rounded-l-md",
        range_middle: "bg-secondary [&_button]:bg-transparent [&_button]:text-foreground",
        range_end: "rounded-r-md",
        hidden: "invisible",
      }}
      {...props}
    />
  )
}

export { Calendar }
