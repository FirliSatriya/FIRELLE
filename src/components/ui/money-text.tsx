"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MoneyTextProps {
  value: number;
  direction?: "in" | "out" | "neutral";
  showSign?: boolean;
  className?: string;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MoneyText({
  value,
  direction = "neutral",
  showSign = false,
  className,
}: MoneyTextProps) {
  const formatted = formatRupiah(Math.abs(value));
  const sign = showSign && value !== 0 ? (value > 0 ? "+" : "−") : "";

  return (
    <span
      className={cn(
        "whitespace-nowrap font-mono tabular-nums",
        direction === "in" && "text-success-foreground font-medium",
        direction === "out" && "text-destructive font-medium",
        direction === "neutral" && "text-foreground",
        className
      )}
    >
      {sign}
      {formatted}
    </span>
  );
}
