import type { Metadata } from "next";
import { CashflowReport } from "@/components/finance/CashflowReport";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Keuangan — Firelle POS",
  description:
    "Ringkasan arus kas, laba kotor dan laba bersih, serta pencatatan kas manual.",
};

export default function FinancePage() {
  return (
    <AppShell breadcrumb={["Beranda", "Keuangan"]}>
      <CashflowReport />
    </AppShell>
  );
}
