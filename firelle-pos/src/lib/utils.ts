import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard Shadcn UI cn helper with tailwind-merge and clsx */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format WIB date from ISO string */
export function formatDateWIB(isoString: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}
