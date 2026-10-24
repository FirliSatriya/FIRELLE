import type { Metadata } from "next";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Kasir (POS) — Firelle POS",
  description: "Layar kasir untuk mencatat penjualan, diskon, dan pembayaran.",
};

export default function PosPage() {
  return (
    <AppShell breadcrumb={["Beranda", "Kasir (POS)"]}>
      <PosTerminal />
    </AppShell>
  );
}