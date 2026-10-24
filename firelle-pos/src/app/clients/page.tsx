import type { Metadata } from "next";
import { ClientDirectory } from "@/components/clients/ClientDirectory";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Klien — Firelle POS",
  description:
    "Kelola data pelanggan butik Firélle: kontak, alamat, dan riwayat transaksi.",
};

export default function ClientsPage() {
  return (
    <AppShell breadcrumb={["Beranda", "Klien"]}>
      <ClientDirectory />
    </AppShell>
  );
}