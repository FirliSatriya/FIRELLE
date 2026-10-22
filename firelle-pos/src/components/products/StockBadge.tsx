"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  LuCircleCheck,
  LuTriangleAlert,
  LuCircleX,
  LuArchive,
} from "react-icons/lu";
import { StockStatus } from "@/types/product";
import { cn } from "@/lib/utils";

export type ExtendedStockStatus = StockStatus | "ARCHIVED";

interface StockBadgeProps {
  status: ExtendedStockStatus;
  className?: string;
}

const config: Record<
  ExtendedStockStatus,
  {
    label: string;
    icon: React.ReactNode;
    variant: "success" | "warning" | "destructive" | "muted";
  }
> = {
  OK: {
    label: "Aman",
    icon: <LuCircleCheck size={12} className="shrink-0" />,
    variant: "success",
  },
  WARNING: {
    label: "Menipis",
    icon: <LuTriangleAlert size={12} className="shrink-0" />,
    variant: "warning",
  },
  LOW: {
    label: "Rendah",
    icon: <LuTriangleAlert size={12} className="shrink-0" />,
    variant: "warning",
  },
  OUT: {
    label: "Habis",
    icon: <LuCircleX size={12} className="shrink-0" />,
    variant: "destructive",
  },
  ARCHIVED: {
    label: "Arsip",
    icon: <LuArchive size={12} className="shrink-0" />,
    variant: "muted",
  },
};

export function StockBadge({ status, className }: StockBadgeProps) {
  const item = config[status] || config.OK;
  return (
    <Badge
      variant={item.variant}
      className={cn(
        "gap-1.5 px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        className
      )}
      role="status"
      aria-label={`Stok ${item.label}`}
    >
      <span aria-hidden="true" className="inline-flex items-center">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Badge>
  );
}
