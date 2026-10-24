import type { Metadata } from "next";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Katalog Produk — Firelle POS",
  description: "Kelola katalog produk, harga, dan stok butik Firelle.",
};

export default function ProductsPage() {
  return (
    <AppShell breadcrumb={["Beranda", "Katalog Produk"]}>
      <ProductCatalog />
    </AppShell>
  );
}