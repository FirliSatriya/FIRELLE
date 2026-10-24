import type { Metadata } from "next";
import { TransactionHistory } from "@/components/transactions/TransactionHistory";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Riwayat Transaksi — Firelle POS",
  description: "Daftar transaksi penjualan, detail struk, dan pembatalan (void).",
};

export default function TransactionsPage() {
  return (
    <AppShell breadcrumb={["Beranda", "Transaksi"]}>
      <TransactionHistory />
    </AppShell>
  );
}