import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export const metadata: Metadata = {
  title: "Pengaturan — Firelle POS",
  description:
    "Identitas toko, pengaturan struk, dan preferensi inventori Firelle POS.",
};

export default function SettingsPage() {
  return (
    <AppShell breadcrumb={["Beranda", "Pengaturan"]}>
      <SettingsPanel />
    </AppShell>
  );
}
