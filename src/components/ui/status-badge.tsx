"use client";

import React from "react";
import {
  LuCircleCheck,
  LuCircleX,
  LuArrowDownLeft,
  LuArrowUpRight,
  LuTriangleAlert,
  LuArchive,
} from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadgeVariant =
  | "completed"
  | "void"
  | "in"
  | "out"
  | "low"
  | "out-of-stock"
  | "archived";

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  className?: string;
}

const variantConfig: Record<
  StatusBadgeVariant,
  {
    badgeVariant: "muted" | "success" | "destructive" | "warning" | "secondary" | "outline";
    defaultLabel: string;
    icon: React.ReactNode;
  }
> = {
  completed: {
    badgeVariant: "success",
    defaultLabel: "Selesai",
    icon: <LuCircleCheck size={12} className="shrink-0" />,
  },
  void: {
    badgeVariant: "destructive",
    defaultLabel: "Dibatalkan",
    icon: <LuCircleX size={12} className="shrink-0" />,
  },
  in: {
    badgeVariant: "success",
    defaultLabel: "Masuk",
    icon: <LuArrowDownLeft size={12} className="shrink-0" />,
  },
  out: {
    badgeVariant: "destructive",
    defaultLabel: "Keluar",
    icon: <LuArrowUpRight size={12} className="shrink-0" />,
  },
  low: {
    badgeVariant: "warning",
    defaultLabel: "Stok Rendah",
    icon: <LuTriangleAlert size={12} className="shrink-0" />,
  },
  "out-of-stock": {
    badgeVariant: "destructive",
    defaultLabel: "Stok Habis",
    icon: <LuCircleX size={12} className="shrink-0" />,
  },
  archived: {
    badgeVariant: "muted",
    defaultLabel: "Diarsipkan",
    icon: <LuArchive size={12} className="shrink-0" />,
  },
};

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  const config = variantConfig[variant];
  const displayLabel = label || config.defaultLabel;

  return (
    <Badge
      variant={config.badgeVariant}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        className
      )}
      role="status"
    >
      <span aria-hidden="true" className="inline-flex items-center">
        {config.icon}
      </span>
      <span>{displayLabel}</span>
    </Badge>
  );
}
