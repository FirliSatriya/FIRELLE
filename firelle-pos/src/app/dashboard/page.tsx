import type { Metadata } from "next";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Dashboard — Firelle POS",
  description:
    "Ringkasan penjualan, stok yang perlu restok, dan arus kas butik Firélle.",
};

export default function DashboardPage() {
  return (
    <AppShell breadcrumb={["Beranda", "Dashboard"]}>
      <DashboardOverview />
    </AppShell>
  );
}