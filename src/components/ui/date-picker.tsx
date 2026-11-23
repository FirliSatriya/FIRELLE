"use client"

import * as React from "react"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { LuCalendar } from "react-icons/lu"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * `yyyy-mm-dd` <-> `Date` helpers.
 *
 * The app stores due/expense dates as plain calendar days (no time, no zone
 * drift), so every conversion goes through the local wall-clock components
 * rather than `toISOString()` (which shifts by the UTC offset).
 */
export function toDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function fromDateValue(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? undefined : date
}

export interface DatePickerProps {
  /** `yyyy-mm-dd`, or "" when nothing is selected. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Extra classes for the trigger button. */
  triggerClassName?: string
  id?: string
  /** Earliest selectable day, as `yyyy-mm-dd`. */
  min?: string
  /** Latest selectable day, as `yyyy-mm-dd`. */
  max?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

/**
 * shadcn Base UI date picker (Popover + Calendar) bound to the app's
 * `yyyy-mm-dd` string format, so it can replace `<input type="date">` directly.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  disabled,
  className,
  triggerClassName,
  id,
  min,
  max,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = fromDateValue(value)
  const from = fromDateValue(min)
  const to = fromDateValue(max)
  const disabledDays =
    from || to ? [{ before: from ?? new Date(0), after: to }] : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            data-empty={!selected}
            className={cn(
              "w-full justify-start gap-2 text-left font-normal data-[empty=true]:text-muted-foreground",
              ariaInvalid && "border-destructive",
              triggerClassName
            )}
          />
        }
      >
        <LuCalendar className="text-muted-foreground" aria-hidden="true" />
        {selected ? (
          format(selected, "d MMM yyyy", { locale: localeId })
        ) : (
          <span>{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", className)} align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disabledDays}
          onSelect={(date) => {
            onChange(date ? toDateValue(date) : "")
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
