import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemePreview } from "@/components/dev/ThemePreview";

export const metadata: Metadata = {
  title: "Design System — Firelle",
  description: "Token, tipografi, dan komponen tema earth tones Firelle.",
};

/**
 * Dev-only visual spec for the design system.
 * Renders a 404 in production builds.
 */
export default function DevThemePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ThemePreview />;
}
